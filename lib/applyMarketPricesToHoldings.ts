/**
 * market_data_cache에 저장된 최신 종목가를 보유현황에 반영합니다.
 *
 * - holdings 테이블(현재 source of truth): current_price / evaluated_amount 갱신
 *   → DB 트리거(trg_holdings_updated_at)가 updated_at 을 자동 갱신합니다.
 * - asset_snapshot_holdings 최신 일자 행: 동일 가격 적용 (이력 동기화)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchLatestHoldings } from "@/lib/snapshotAutoSave";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param priceMap — 내부 심볼 키 (예: 005930, NVDA) → 현재가
 * @returns 갱신된 holdings 행 수 + 갱신된 asset_snapshot_holdings 행 수
 */
export async function applyStockPricesToLatestHoldings(
  supabase: SupabaseClient,
  priceMap: Record<string, number>
): Promise<{ updatedRows: number; updatedHoldingRows: number }> {
  // ── holdings 테이블 현재가 갱신 (updated_at 트리거 보장) ─────────────────
  const { data: holdingRows, error: holdingsErr } = await supabase
    .from("holdings")
    .select("id, symbol, quantity, asset_type");

  let updatedHoldingRows = 0;
  if (holdingsErr) {
    console.error("[applyMarketPricesToHoldings] holdings 조회 오류:", holdingsErr.message);
  } else {
    for (const h of holdingRows ?? []) {
      if (h.asset_type !== "STOCK" || !h.symbol) continue;
      const sym = String(h.symbol).trim();
      const price = priceMap[sym];
      if (price == null || price <= 0) continue;

      const qty = num(h.quantity);
      const ev = qty * price;
      const { error } = await supabase
        .from("holdings")
        .update({ current_price: price, evaluated_amount: ev })
        .eq("id", h.id);

      if (error) {
        console.error("[applyMarketPricesToHoldings] holdings update 실패:", h.id, error.message);
      } else {
        updatedHoldingRows += 1;
      }
    }
  }

  // ── asset_snapshot_holdings 최신 일자 행 동기화 ──────────────────────────
  const { holdings, sourceSnapshotDate } = await fetchLatestHoldings(supabase);
  if (!sourceSnapshotDate || holdings.length === 0) {
    return { updatedRows: 0, updatedHoldingRows };
  }

  let updated = 0;
  for (const h of holdings) {
    if (h.asset_type !== "STOCK" || !h.symbol) continue;
    const sym = h.symbol.trim();
    const price = priceMap[sym];
    if (price == null || price <= 0) continue;

    const qty = num(h.quantity);
    const ev = qty * price;
    const { error } = await supabase
      .from("asset_snapshot_holdings")
      .update({
        current_price: price,
        evaluated_amount: ev,
      })
      .eq("id", h.id);

    if (error) {
      console.error("[applyMarketPricesToHoldings] asset_snapshot_holdings update 실패:", h.id, error.message);
    } else {
      updated += 1;
    }
  }

  return { updatedRows: updated, updatedHoldingRows };
}
