/**
 * market_data_cache에 저장된 최신 종목가를 asset_snapshot_holdings 최신 일자 행에 반영합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchLatestHoldings } from "@/lib/snapshotAutoSave";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param priceMap — 내부 심볼 키 (예: 005930, NVDA) → 현재가
 */
export async function applyStockPricesToLatestHoldings(
  supabase: SupabaseClient,
  priceMap: Record<string, number>
): Promise<{ updatedRows: number }> {
  const { holdings, sourceSnapshotDate } = await fetchLatestHoldings(supabase);
  if (!sourceSnapshotDate || holdings.length === 0) {
    return { updatedRows: 0 };
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
      console.error("[applyMarketPricesToHoldings] update 실패:", h.id, error.message);
    } else {
      updated += 1;
    }
  }

  return { updatedRows: updated };
}
