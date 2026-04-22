import type { HoldingBase } from "@/types/assets";

/**
 * `market_data_cache` quote 맵(symbol → 현재가)으로 STOCK 행의
 * current_price·evaluated_amount를 덮어씁니다. (DB 저장값은 그대로 두고 표시·집계용)
 *
 * Holding / AssetSnapshotHolding 양쪽에서 사용 가능한 제네릭 함수입니다.
 */
export function mergeQuotesIntoHoldings<T extends HoldingBase>(
  holdings: T[],
  quotes: Record<string, number>
): T[] {
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
