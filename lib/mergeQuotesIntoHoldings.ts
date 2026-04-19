import type { AssetSnapshotHolding } from "@/types/assets";

/**
 * `market_data_cache` quote 맵(symbol → 현재가)으로 STOCK 행의
 * current_price·evaluated_amount를 덮어씁니다. (DB 저장값은 그대로 두고 표시·집계용)
 */
export function mergeQuotesIntoHoldings(
  holdings: AssetSnapshotHolding[],
  quotes: Record<string, number>
): AssetSnapshotHolding[] {
  if (holdings.length === 0 || Object.keys(quotes).length === 0) return holdings;
  return holdings.map((h) => {
    if (h.asset_type !== "STOCK" || !h.symbol?.trim()) return h;
    const sym = h.symbol.trim();
    const p = quotes[sym];
    if (p == null || !Number.isFinite(p) || p <= 0) return h;
    const qty = h.quantity;
    return {
      ...h,
      current_price: p,
      evaluated_amount: qty * p,
    };
  });
}
