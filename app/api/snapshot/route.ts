/**
 * Vercel Cron (vercel.json): `0 0 * * *` runs this route at 00:00 UTC daily,
 * which is 09:00 KST (Asia/Seoul) the same calendar day.
 */
import { NextResponse } from "next/server";

import {
  computeSnapshotSummary,
  fetchLatestHoldings,
  fetchUsdKrwForSnapshot,
  holdingsToSnapshotItems,
  originFromRequest,
  snapshotDateSeoul,
  type SnapshotItemRow,
} from "@/lib/snapshotAutoSave";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function missingEnvResponse() {
  return NextResponse.json(
    {
      success: false,
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
  holdings_source_snapshot_date: string | null;
  repair: boolean;
  deleted_item_count: number;
  inserted_item_count: number;
}) {
  console.log("[snapshot API]", payload);
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
 * - repair=1: 오늘 상세만 삭제 후 최신 holdings로 재삽입; 요약은 유지(옵션 recalc_summary=1 로 재계산).
 * - 저장 순서: 해당 일자 상세 삭제 → 상세 insert → 요약 insert (요약 실패 시 재시도 가능).
 */
export async function GET(request: Request) {
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
          success: false,
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
        holdings_source_snapshot_date: null,
        repair: false,
        deleted_item_count: 0,
        inserted_item_count: 0,
      });
      return NextResponse.json({
        success: true,
        inserted: false,
        reason: "already_exists",
        mode: "normal" as const,
        snapshot_date: snapshotDate,
      });
    }

    if (repair) {
      const usdkrw_rate = await fetchUsdKrwForSnapshot(baseUrl);
      const { holdings, sourceSnapshotDate } = await fetchLatestHoldings(supabase);
      const summary = computeSnapshotSummary(holdings, usdkrw_rate);
      const itemRows = holdingsToSnapshotItems(snapshotDate, holdings);

      const itemsResult = await deleteAndInsertSnapshotItems(snapshotDate, itemRows);
      if (!itemsResult.ok) {
        return NextResponse.json(
          {
            success: false,
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
        holdings_source_snapshot_date: sourceSnapshotDate,
        repair: true,
        deleted_item_count: itemsResult.deletedCount,
        inserted_item_count: itemsResult.insertedCount,
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
            })
            .eq("snapshot_date", snapshotDate);
          if (updErr) {
            return NextResponse.json(
              {
                success: false,
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
            created_at: new Date().toISOString(),
          });
          if (insertSummaryErr) {
            return NextResponse.json(
              {
                success: false,
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
        success: true,
        inserted: true,
        reason: "repaired",
        mode: "repair" as const,
        snapshot_date: snapshotDate,
        holdings_source_snapshot_date: sourceSnapshotDate,
        items_count: itemsResult.insertedCount,
        deleted_items_count: itemsResult.deletedCount,
        summary_recalculated: summaryRecalculated,
        usdkrw_rate,
      });
    }

    const usdkrw_rate = await fetchUsdKrwForSnapshot(baseUrl);
    const { holdings, sourceSnapshotDate } = await fetchLatestHoldings(supabase);
    const summary = computeSnapshotSummary(holdings, usdkrw_rate);
    const itemRows = holdingsToSnapshotItems(snapshotDate, holdings);

    const itemsResult = await deleteAndInsertSnapshotItems(snapshotDate, itemRows);
    if (!itemsResult.ok) {
      return NextResponse.json(
        {
          success: false,
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
      holdings_source_snapshot_date: sourceSnapshotDate,
      repair: false,
      deleted_item_count: itemsResult.deletedCount,
      inserted_item_count: itemsResult.insertedCount,
    });

    const { error: insertSummaryErr } = await supabase.from("asset_snapshots").insert({
      snapshot_date: snapshotDate,
      total_asset: summary.total_asset,
      stock_asset: summary.stock_asset,
      cash_asset: summary.cash_asset,
      kr_asset: summary.kr_asset,
      us_asset: summary.us_asset,
      usdkrw_rate: usdkrw_rate,
      created_at: new Date().toISOString(),
    });

    if (insertSummaryErr) {
      return NextResponse.json(
        {
          success: false,
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
      success: true,
      inserted: true,
      reason: "inserted",
      mode: "normal" as const,
      snapshot_date: snapshotDate,
      holdings_source_snapshot_date: sourceSnapshotDate,
      items_count: itemRows.length,
      deleted_items_count: itemsResult.deletedCount,
      usdkrw_rate,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        success: false,
        inserted: false,
        mode: repair ? ("repair" as const) : ("normal" as const),
        reason: "unexpected_error",
        error: message,
      },
      { status: 500 }
    );
  }
}
