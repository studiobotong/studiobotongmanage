/**
 * asset_snapshot_holdings(최신 일자) 기준으로 외부 시세 조회 대상을 만듭니다.
 * market_data_cache는 이 목록으로 갱신되는 파생 캐시이며, 클라이언트가 임의 종목 목록을 넘기지 않습니다.
 */

import type { PriceInput } from "@/lib/priceService";
import type { AssetSnapshotHolding } from "@/types/assets";

/**
 * DISTINCT (symbol, market, currency) — `asset_type === "STOCK"` 만 포함.
 * symbol·market·currency 조합이 같으면 한 번만 조회합니다.
 */
export function priceInputsFromHoldings(holdings: AssetSnapshotHolding[]): PriceInput[] {
  const out = new Map<string, PriceInput>();
  for (const h of holdings) {
    if (h.asset_type !== "STOCK" || !h.symbol?.trim()) continue;
    const sym = h.symbol.trim();
    const m = h.market?.trim();
    const cur = (h.currency ?? "KRW").trim() || "KRW";
    const dedupeKey = `${m ?? "_"}|${sym}|${cur}`;
    if (out.has(dedupeKey)) continue;
    out.set(dedupeKey, {
      symbol: sym,
      currency: cur,
      market: m === "KRX" || m === "US" ? m : undefined,
    });
  }
  return [...out.values()];
}
