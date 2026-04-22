/**
 * Vercel Cron (vercel.json): `0 0 * * *` runs this route at 00:00 UTC daily,
 * which is 09:00 KST (Asia/Seoul) the same calendar day.
 *
 * 스냅샷 생성 흐름:
 *   1. getHoldings() — holdings 테이블(현재 source of truth)에서 보유현황 조회
 *   2. 현재가(market_data_cache) 적용 → holdingsForCalc
 *   3. asset_snapshot_holdings 해당 날짜 삭제 → holdingsForCalc 기준 재저장
 *   4. asset_snapshot_items 해당 날짜 삭제 → holdingsForCalc 기준 재생성
 *   5. asset_snapshots 요약 계산 및 저장 (asset_snapshot_holdings 재조회 없음)
 */
import { NextResponse } from "next/server";

import { computeSnapshotInvestmentMetrics } from "@/lib/netInvestment";
import { mergeQuotesIntoHoldings } from "@/lib/mergeQuotesIntoHoldings";
import { fetchMarketDataBundleFromDb } from "@/lib/marketDataDb";
import {
  computeSnapshotSummary,
  fetchUsdKrwForSnapshot,
  holdingsToSnapshotItems,
  originFromRequest,
  snapshotDateSeoul,
  type SnapshotItemRow,
} from "@/lib/snapshotAutoSave";
import { getCashflows, getHoldings } from "@/lib/storage";
import { supabase } from "@/lib/supabaseClient";
import type { AssetSnapshotHolding, Holding } from "@/types/assets";

export const dynamic = "force-dynamic";

const IS_DEV = process.env.NODE_ENV === "development";

function missingEnvResponse() {
  return NextResponse.json(
    {
      ok: false as const,
      inserted: false,
      mode: "normal" as const,
      reason: "missing_env",
      error:
        "NEXT_PUBLIC_SUPABASE_URL 또는 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 설정되지 않았습니다.",
    },
    { status: 500 }
  );
}

function snapshotApiLog(payload: {
  snapshot_date: string;
  holdings_count: number;
  repair: boolean;
  deleted_item_count: number;
  inserted_item_count: number;
  deleted_snapshot_holding_count: number;
  inserted_snapshot_holding_count: number;
}) {
  console.log("[snapshot API]", payload);
}

/**
 * Holding[] → AssetSnapshotHolding[]: snapshot_date 를 추가하고 updated_at 는 제거합니다.
 */
function holdingsToSnapshotHoldings(
  holdings: Holding[],
  snapshotDate: string
): AssetSnapshotHolding[] {
  return holdings.map(({ updated_at: _u, ...h }) => ({
    ...h,
    snapshot_date: snapshotDate,
  }));
}

/**
 * asset_snapshot_holdings 해당 날짜 삭제 → holdingsForCalc 기준 재저장.
 * 요약·items 계산에는 이 함수 반환값이 아닌 holdingsForCalc 를 직접 사용합니다.
 */
async function saveSnapshotHoldingsForDate(
  holdings: AssetSnapshotHolding[],
  snapshotDate: string
): Promise<{ deletedCount: number; insertedCount: number }> {
  const { data: deleted, error: delErr } = await supabase
    .from("asset_snapshot_holdings")
    .delete()
    .eq("snapshot_date", snapshotDate)
    .select("id");
  if (delErr) {
    console.error("[snapshot] asset_snapshot_holdings 삭제 오류:", delErr.message);
  }
  const deletedCount = deleted?.length ?? 0;

  if (holdings.length === 0) {
    return { deletedCount, insertedCount: 0 };
  }

  const rows = holdings.map((h) => ({
    snapshot_date:     snapshotDate,
    name:              h.name,
    symbol:            h.symbol ?? null,
    market:            h.market ?? null,
    currency:          h.currency ?? null,
    account:           h.account ?? null,
    quantity:          h.quantity,
    avg_price:         h.avg_price,
    current_price:     h.current_price,
    evaluated_amount:  h.evaluated_amount,
    weight:            h.weight ?? null,
    target_min_weight: h.target_min_weight ?? null,
    target_max_weight: h.target_max_weight ?? null,
    asset_type:        h.asset_type ?? null,
    created_at:        new Date().toISOString(),
  }));

  const { data: inserted, error: insErr } = await supabase
    .from("asset_snapshot_holdings")
    .insert(rows)
    .select("id");
  if (insErr) {
    console.error("[snapshot] asset_snapshot_holdings 삽입 오류:", insErr.message);
  }

  return { deletedCount, insertedCount: inserted?.length ?? 0 };
}

async function deleteAndInsertSnapshotItems(
  snapshotDate: string,
  itemRows: SnapshotItemRow[]
): Promise<
  | { ok: true; deletedCount: number; insertedCount: number }
  | { ok: false; reason: string; error: string }
> {
  const { data: deletedRows, error: delItemsErr } = await supabase
    .from("asset_snapshot_items")
    .delete()
    .eq("snapshot_date", snapshotDate)
    .select("id");

  if (delItemsErr) {
    return { ok: false, reason: "delete_items_failed", error: delItemsErr.message };
  }

  const deletedCount = deletedRows?.length ?? 0;

  if (itemRows.length === 0) {
    return { ok: true, deletedCount, insertedCount: 0 };
  }

  const { data: insertedItemRows, error: itemsInsertErr } = await supabase
    .from("asset_snapshot_items")
    .insert(
      itemRows.map((r) => ({
        ...r,
        created_at: new Date().toISOString(),
      }))
    )
    .select("id");

  if (itemsInsertErr) {
    return { ok: false, reason: "insert_items_failed", error: itemsInsertErr.message };
  }

  return {
    ok: true,
    deletedCount,
    insertedCount: insertedItemRows?.length ?? 0,
  };
}

/**
 * 하루 1회: 요약 1행 + 상세 N행 (같은 snapshot_date).
 * - 일반: 요약이 이미 있으면 스킵(중복 요약 방지).
 * - repair=1: 상세 삭제 후 holdings 기준으로 재삽입; 요약은 유지(옵션 recalc_summary=1 로 재계산).
 */
export async function GET(request: Request) {
  if (IS_DEV) {
    console.log("[snapshot] GET", { requestUrl: request.url });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !key) {
    return missingEnvResponse();
  }

  const reqUrl = new URL(request.url);
  const repair = reqUrl.searchParams.get("repair") === "1";
  const recalcSummary = repair && reqUrl.searchParams.get("recalc_summary") === "1";

  const snapshotDate = snapshotDateSeoul();
  const baseUrl = originFromRequest(request);

  try {
    const { data: existing, error: selectError } = await supabase
      .from("asset_snapshots")
      .select("id")
      .eq("snapshot_date", snapshotDate)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json(
        {
          ok: false as const,
          inserted: false,
          mode: repair ? ("repair" as const) : ("normal" as const),
          reason: "query_failed",
          error: selectError.message,
        },
        { status: 500 }
      );
    }

    if (!repair && existing != null) {
      snapshotApiLog({
        snapshot_date: snapshotDate,
        holdings_count: 0,
        repair: false,
        deleted_item_count: 0,
        inserted_item_count: 0,
        deleted_snapshot_holding_count: 0,
        inserted_snapshot_holding_count: 0,
      });
      return NextResponse.json({
        ok: true as const,
        inserted: false,
        reason: "already_exists",
        mode: "normal" as const,
        snapshot_date: snapshotDate,
      });
    }

    // ── 1. holdings 테이블에서 현재 보유현황 조회 ────────────────────────
    const usdkrw_rate = await fetchUsdKrwForSnapshot(supabase, baseUrl);
    const currentHoldings = await getHoldings();

    if (currentHoldings.length === 0) {
      console.warn("[snapshot] holdings 테이블이 비어 있어 스냅샷을 생성할 수 없습니다.");
      return NextResponse.json(
        {
          ok: false as const,
          inserted: false,
          mode: repair ? ("repair" as const) : ("normal" as const),
          reason: "empty_holdings",
          error: "holdings 테이블이 비어 있어 스냅샷을 생성할 수 없습니다.",
          snapshot_date: snapshotDate,
        },
        { status: 400 }
      );
    }

    // ── 2. Holding[] → AssetSnapshotHolding[] (snapshot_date 추가) ──────────
    const snapshotHoldings = holdingsToSnapshotHoldings(currentHoldings, snapshotDate);

    // ── 3. 현재가(market_data_cache)로 STOCK evaluated_amount 보정 ──────────
    const quoteBundle = await fetchMarketDataBundleFromDb(supabase);
    const holdingsForCalc = mergeQuotesIntoHoldings(snapshotHoldings, quoteBundle.quotes);

    // ── 4. asset_snapshot_holdings 해당 날짜 삭제 → holdingsForCalc 기준 재저장 ──
    const ashResult = await saveSnapshotHoldingsForDate(holdingsForCalc, snapshotDate);

    // ── 5. 요약 계산 — holdingsForCalc 직접 사용 (asset_snapshot_holdings 재조회 없음) ──
    const summary = computeSnapshotSummary(holdingsForCalc, usdkrw_rate);
    const cashflows = await getCashflows();
    const inv = computeSnapshotInvestmentMetrics(snapshotDate, summary.total_asset, cashflows);
    const itemRows = holdingsToSnapshotItems(snapshotDate, holdingsForCalc);

    // ── 검증 로그: holdings 합산 vs 요약 ─────────────────────────────────────
    console.log("[snapshot] holdings → summary 검증", {
      snapshot_date: snapshotDate,
      source: "holdings_table",
      holdings_count: currentHoldings.length,
      total_asset: Math.round(summary.total_asset),
      kr_asset: Math.round(summary.kr_asset),
      us_asset: Math.round(summary.us_asset),
      stock_asset: Math.round(summary.stock_asset),
      cash_asset: Math.round(summary.cash_asset),
      usdkrw_rate,
    });

    if (repair) {
      // ── 6a. repair: asset_snapshot_items 삭제 후 재삽입 ─────────────────
      const itemsResult = await deleteAndInsertSnapshotItems(snapshotDate, itemRows);
      if (!itemsResult.ok) {
        return NextResponse.json(
          {
            ok: false as const,
            inserted: false,
            mode: "repair" as const,
            reason: itemsResult.reason,
            error: itemsResult.error,
            snapshot_date: snapshotDate,
          },
          { status: 500 }
        );
      }

      snapshotApiLog({
        snapshot_date: snapshotDate,
        holdings_count: currentHoldings.length,
        repair: true,
        deleted_item_count: itemsResult.deletedCount,
        inserted_item_count: itemsResult.insertedCount,
        deleted_snapshot_holding_count: ashResult.deletedCount,
        inserted_snapshot_holding_count: ashResult.insertedCount,
      });

      let summaryRecalculated = false;
      if (recalcSummary) {
        if (existing != null) {
          const { error: updErr } = await supabase
            .from("asset_snapshots")
            .update({
              total_asset: summary.total_asset,
              stock_asset: summary.stock_asset,
              cash_asset: summary.cash_asset,
              kr_asset: summary.kr_asset,
              us_asset: summary.us_asset,
              usdkrw_rate: usdkrw_rate,
              net_investment: inv.net_investment,
              profit: inv.profit,
              return_rate: inv.return_rate,
            })
            .eq("snapshot_date", snapshotDate);
          if (updErr) {
            return NextResponse.json(
              {
                ok: false as const,
                inserted: false,
                mode: "repair" as const,
                reason: "update_summary_failed",
                error: updErr.message,
                snapshot_date: snapshotDate,
              },
              { status: 500 }
            );
          }
        } else {
          const { error: insertSummaryErr } = await supabase.from("asset_snapshots").insert({
            snapshot_date: snapshotDate,
            total_asset: summary.total_asset,
            stock_asset: summary.stock_asset,
            cash_asset: summary.cash_asset,
            kr_asset: summary.kr_asset,
            us_asset: summary.us_asset,
            usdkrw_rate: usdkrw_rate,
            net_investment: inv.net_investment,
            profit: inv.profit,
            return_rate: inv.return_rate,
            created_at: new Date().toISOString(),
          });
          if (insertSummaryErr) {
            return NextResponse.json(
              {
                ok: false as const,
                inserted: false,
                mode: "repair" as const,
                reason: "insert_summary_failed",
                error: insertSummaryErr.message,
                snapshot_date: snapshotDate,
              },
              { status: 500 }
            );
          }
        }
        summaryRecalculated = true;
      }

      return NextResponse.json({
        ok: true as const,
        inserted: true,
        reason: "repaired",
        mode: "repair" as const,
        snapshot_date: snapshotDate,
        holdings_count: currentHoldings.length,
        items_count: itemsResult.insertedCount,
        deleted_items_count: itemsResult.deletedCount,
        snapshot_holding_count: ashResult.insertedCount,
        summary_recalculated: summaryRecalculated,
        usdkrw_rate,
        summary: {
          total_asset: Math.round(summary.total_asset),
          kr_asset: Math.round(summary.kr_asset),
          us_asset: Math.round(summary.us_asset),
          stock_asset: Math.round(summary.stock_asset),
          cash_asset: Math.round(summary.cash_asset),
        },
      });
    }

    // ── 6b. normal: asset_snapshot_items 삭제 후 재삽입 ─────────────────
    const itemsResult = await deleteAndInsertSnapshotItems(snapshotDate, itemRows);
    if (!itemsResult.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          inserted: false,
          mode: "normal" as const,
          reason: itemsResult.reason,
          error: itemsResult.error,
          snapshot_date: snapshotDate,
        },
        { status: 500 }
      );
    }

    snapshotApiLog({
      snapshot_date: snapshotDate,
      holdings_count: currentHoldings.length,
      repair: false,
      deleted_item_count: itemsResult.deletedCount,
      inserted_item_count: itemsResult.insertedCount,
      deleted_snapshot_holding_count: ashResult.deletedCount,
      inserted_snapshot_holding_count: ashResult.insertedCount,
    });

    const { error: insertSummaryErr } = await supabase.from("asset_snapshots").insert({
      snapshot_date: snapshotDate,
      total_asset: summary.total_asset,
      stock_asset: summary.stock_asset,
      cash_asset: summary.cash_asset,
      kr_asset: summary.kr_asset,
      us_asset: summary.us_asset,
      usdkrw_rate: usdkrw_rate,
      net_investment: inv.net_investment,
      profit: inv.profit,
      return_rate: inv.return_rate,
      created_at: new Date().toISOString(),
    });

    if (insertSummaryErr) {
      return NextResponse.json(
        {
          ok: false as const,
          inserted: false,
          mode: "normal" as const,
          reason: "insert_summary_failed",
          error: insertSummaryErr.message,
          snapshot_date: snapshotDate,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true as const,
      inserted: true,
      reason: "inserted",
      mode: "normal" as const,
      snapshot_date: snapshotDate,
      holdings_count: currentHoldings.length,
      items_count: itemRows.length,
      deleted_items_count: itemsResult.deletedCount,
      snapshot_holding_count: ashResult.insertedCount,
      usdkrw_rate,
      summary: {
        total_asset: Math.round(summary.total_asset),
        kr_asset: Math.round(summary.kr_asset),
        us_asset: Math.round(summary.us_asset),
        stock_asset: Math.round(summary.stock_asset),
        cash_asset: Math.round(summary.cash_asset),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.error("[snapshot] GET 예외", {
        requestUrl: request.url,
        error: message.slice(0, 400),
        stack: e instanceof Error ? e.stack : undefined,
      });
    } else {
      console.error("[snapshot] GET 예외", message.slice(0, 300));
    }
    return NextResponse.json(
      {
        ok: false as const,
        inserted: false,
        mode: repair ? ("repair" as const) : ("normal" as const),
        reason: "unexpected_error",
        error: message,
      },
      { status: 500 }
    );
  }
}
