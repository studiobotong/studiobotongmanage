import type { AssetSnapshotHolding } from "@/types/assets";

/**
 * 일반 종목(예수금·채권 제외)을 (symbol, market, currency, asset_type) 기준으로 통합한 그룹.
 */
export interface GroupedHolding {
  groupKey:         string;
  name:             string;
  symbol:           string;
  market:           string;
  currency:         string;
  asset_type:       string;
  totalQuantity:    number;
  weightedAvgPrice: number;
  currentPrice:     number;
  evaluatedAmount:  number;
  accountCount:     number;
  rows:             AssetSnapshotHolding[];
}

export function groupRegularHoldings(holdings: AssetSnapshotHolding[]): GroupedHolding[] {
  const map = new Map<string, AssetSnapshotHolding[]>();

  for (const h of holdings) {
    const key = `${h.symbol ?? h.name}|${h.market ?? ""}|${h.currency ?? ""}|${h.asset_type ?? ""}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(h);
  }

  return [...map.entries()].map(([key, rows]) => {
    const ref           = rows[0];
    const totalQuantity = rows.reduce((s, r) => s + r.quantity, 0);

    const weightedAvgPrice =
      totalQuantity > 0
        ? rows.reduce((s, r) => s + r.avg_price * r.quantity, 0) / totalQuantity
        : 0;

    const currentPrice =
      rows.find((r) => r.current_price > 0)?.current_price ?? 0;

    return {
      groupKey:         key,
      name:             ref.name,
      symbol:           ref.symbol ?? "",
      market:           ref.market ?? "",
      currency:         ref.currency ?? "",
      asset_type:       ref.asset_type ?? "",
      totalQuantity,
      weightedAvgPrice,
      currentPrice,
      evaluatedAmount:  totalQuantity * currentPrice,
      accountCount:     rows.filter((r) => r.quantity > 0).length,
      rows,
    };
  }).sort((a, b) => b.evaluatedAmount - a.evaluatedAmount);
}
