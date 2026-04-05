import type { AssetTransaction, Holding, HoldingsSummary } from "@/types/transactions";
import { getCurrentPrice } from "./mockPrices";

/**
 * Aggregates a flat list of transactions into current holdings.
 *
 * Algorithm:
 *  - BUY  → weighted-average cost accumulation
 *  - SELL → reduce quantity proportionally (FIFO-approximated via avg cost)
 *
 * Holdings with quantity ≤ 0 are filtered out.
 */
export function aggregateTransactions(
  transactions: AssetTransaction[]
): Omit<Holding, "currentPrice" | "evaluationAmount" | "profit" | "returnRate">[] {
  const map = new Map<
    string,
    {
      symbol: string;
      name: string;
      market: string;
      currency: string;
      quantity: number;
      totalCost: number;
    }
  >();

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  for (const tx of sorted) {
    const key = tx.symbol;
    const existing = map.get(key);

    if (tx.type === "BUY") {
      if (existing) {
        existing.totalCost += tx.total_amount + (tx.fee ?? 0);
        existing.quantity += tx.quantity;
        existing.name = tx.name;
        existing.market = tx.market;
        existing.currency = tx.currency;
      } else {
        map.set(key, {
          symbol: tx.symbol,
          name: tx.name,
          market: tx.market,
          currency: tx.currency,
          quantity: tx.quantity,
          totalCost: tx.total_amount + (tx.fee ?? 0),
        });
      }
    } else if (tx.type === "SELL") {
      if (existing && existing.quantity > 0) {
        const ratio = tx.quantity / existing.quantity;
        existing.totalCost = existing.totalCost * (1 - Math.min(ratio, 1));
        existing.quantity -= tx.quantity;
      }
    }
  }

  return Array.from(map.values())
    .filter((h) => h.quantity > 0.0001)
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      market: h.market,
      currency: h.currency,
      quantity: h.quantity,
      avgPrice: h.quantity > 0 ? h.totalCost / h.quantity : 0,
      totalBuyAmount: h.totalCost,
    }));
}

/**
 * Enriches holdings with current prices (async).
 * Designed to be swapped with a real price API call.
 */
export async function enrichWithPrices(
  holdings: Omit<Holding, "currentPrice" | "evaluationAmount" | "profit" | "returnRate">[]
): Promise<Holding[]> {
  return Promise.all(
    holdings.map(async (h) => {
      const price = (await getCurrentPrice(h.symbol, h.currency)) ?? h.avgPrice;
      const evaluationAmount = price * h.quantity;
      const profit = evaluationAmount - h.totalBuyAmount;
      const returnRate =
        h.totalBuyAmount > 0 ? (profit / h.totalBuyAmount) * 100 : 0;

      return {
        ...h,
        currentPrice: price,
        evaluationAmount,
        profit,
        returnRate,
      };
    })
  );
}

export function computeHoldingsSummary(holdings: Holding[]): HoldingsSummary {
  const totalBuyAmount = holdings.reduce((s, h) => s + h.totalBuyAmount, 0);
  const totalEvaluationAmount = holdings.reduce(
    (s, h) => s + h.evaluationAmount,
    0
  );
  const totalProfit = totalEvaluationAmount - totalBuyAmount;
  const totalReturnRate =
    totalBuyAmount > 0 ? (totalProfit / totalBuyAmount) * 100 : 0;

  return { totalBuyAmount, totalEvaluationAmount, totalProfit, totalReturnRate };
}

export function formatCurrency(value: number, currency: string): string {
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (currency === "KRW") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 100_000_000) {
      const eok = Math.floor(abs / 100_000_000);
      const man = Math.floor((abs % 100_000_000) / 10_000);
      return man > 0
        ? `${sign}${eok}억 ${man.toLocaleString()}만원`
        : `${sign}${eok}억원`;
    }
    if (abs >= 10_000) {
      return `${sign}${Math.floor(abs / 10_000).toLocaleString()}만원`;
    }
    return `${value.toLocaleString()}원`;
  }
  return value.toLocaleString();
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
