import type { Asset, AssetSummary, AssetMarket } from "@/types/assets";

// Re-export types for convenience
export type { Asset, AssetSummary, AssetHistory, HistoryPeriod } from "@/types/assets";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatKRW(value: number): string {
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

export function formatKRWCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    return `${sign}${(abs / 100_000_000).toFixed(2)}억`;
  }
  if (abs >= 10_000_000) {
    return `${sign}${(abs / 10_000_000).toFixed(1)}천만`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.floor(abs / 10_000).toLocaleString()}만`;
  }
  return `${value.toLocaleString()}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPrice(price: number, currency: string): string {
  if (currency === "USD") {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return price.toLocaleString("ko-KR") + "원";
}

// ---------------------------------------------------------------------------
// Summary computation
// ---------------------------------------------------------------------------

export function computeSummary(
  assets: Asset[],
  psyAmount: number,
  domesticProfit: number
): AssetSummary {
  const totalBuyAmount = assets.reduce((s, a) => s + a.buyAmount, 0);
  const totalEvaluationAmount = assets.reduce(
    (s, a) => s + a.evaluationAmount,
    0
  );
  const totalProfit = totalEvaluationAmount - totalBuyAmount;
  const totalReturnRate =
    totalBuyAmount > 0 ? (totalProfit / totalBuyAmount) * 100 : 0;

  return {
    totalBuyAmount,
    totalEvaluationAmount,
    totalProfit,
    totalReturnRate,
    psyAmount,
    domesticProfit,
  };
}

export function computeDomesticProfit(assets: Asset[]): number {
  return assets
    .filter((a) => a.market === "KRX")
    .reduce((s, a) => s + a.profit, 0);
}

// ---------------------------------------------------------------------------
// ID generator
// ---------------------------------------------------------------------------

export function generateId(): string {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateHistoryId(): string {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Market label helpers
// ---------------------------------------------------------------------------

export const MARKET_LABELS: Record<AssetMarket, string> = {
  KRX: "KRX",
  NASDAQ: "NASDAQ",
  NYSE: "NYSE",
  ETC: "기타",
  CASH: "예수금",
};

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export const SEED_ASSETS: Asset[] = [
  {
    id: "seed-0",
    name: "삼성전자",
    action: "BUY",
    market: "KRX",
    symbol: "005930",
    currency: "KRW",
    currentPrice: 186200,
    quantity: 13,
    buyAmount: 1666067,
    evaluationAmount: 2420600,
    profit: 754533,
    returnRate: 45,
    currentWeight: 2.03,
    minWeight: 3,
    maxWeight: 10,
  },
  {
    id: "seed-1",
    name: "SK하이닉스",
    action: "BUY",
    market: "KRX",
    symbol: "000660",
    currency: "KRW",
    currentPrice: 876000,
    quantity: 2,
    buyAmount: 1850000,
    evaluationAmount: 1752000,
    profit: -98000,
    returnRate: -5,
    currentWeight: 1.47,
    minWeight: 3,
    maxWeight: 10,
  },
  {
    id: "seed-2",
    name: "삼성생명",
    action: "HOLD",
    market: "KRX",
    symbol: "032830",
    currency: "KRW",
    currentPrice: 221000,
    quantity: 62,
    buyAmount: 9435160,
    evaluationAmount: 13702000,
    profit: 4266840,
    returnRate: 45,
    currentWeight: 11.51,
    minWeight: 5,
    maxWeight: 15,
  },
  {
    id: "seed-3",
    name: "LIG넥스원",
    action: "HOLD",
    market: "KRX",
    symbol: "079550",
    currency: "KRW",
    currentPrice: 860000,
    quantity: 9,
    buyAmount: 4120263,
    evaluationAmount: 7740000,
    profit: 3619737,
    returnRate: 88,
    currentWeight: 6.5,
    minWeight: 4,
    maxWeight: 7,
  },
  {
    id: "seed-4",
    name: "삼양식품",
    action: "HOLD",
    market: "KRX",
    symbol: "003230",
    currency: "KRW",
    currentPrice: 1240000,
    quantity: 6,
    buyAmount: 6855300,
    evaluationAmount: 7440000,
    profit: 584700,
    returnRate: 9,
    currentWeight: 6.25,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-5",
    name: "현대모비스",
    action: "BUY",
    market: "KRX",
    symbol: "012330",
    currency: "KRW",
    currentPrice: 388500,
    quantity: 8,
    buyAmount: 3526488,
    evaluationAmount: 3108000,
    profit: -418488,
    returnRate: -12,
    currentWeight: 2.61,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-6",
    name: "현대차",
    action: "BUY",
    market: "KRX",
    symbol: "005380",
    currency: "KRW",
    currentPrice: 471000,
    quantity: 4,
    buyAmount: 2175000,
    evaluationAmount: 1884000,
    profit: -291000,
    returnRate: -13,
    currentWeight: 1.58,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-7",
    name: "한화에어로스페이스",
    action: "HOLD",
    market: "KRX",
    symbol: "012450",
    currency: "KRW",
    currentPrice: 1449000,
    quantity: 4,
    buyAmount: 4011464,
    evaluationAmount: 5796000,
    profit: 1784536,
    returnRate: 44,
    currentWeight: 4.87,
    minWeight: 4,
    maxWeight: 7,
  },
  {
    id: "seed-8",
    name: "팔란티어",
    action: "BUY",
    market: "NASDAQ",
    symbol: "PLTR",
    currency: "USD",
    currentPrice: 148.46,
    quantity: 10,
    buyAmount: 2288048,
    evaluationAmount: 2243617,
    profit: -44431,
    returnRate: -2,
    currentWeight: 1.89,
    minWeight: 3,
    maxWeight: 6,
  },
  {
    id: "seed-9",
    name: "엔비디아",
    action: "SELL",
    market: "NASDAQ",
    symbol: "NVDA",
    currency: "USD",
    currentPrice: 177.39,
    quantity: 73,
    buyAmount: 21023493,
    evaluationAmount: 19570016,
    profit: -1453477,
    returnRate: -7,
    currentWeight: 16.44,
    minWeight: 5,
    maxWeight: 15,
  },
  {
    id: "seed-10",
    name: "이턴코퍼레이션",
    action: "BUY",
    market: "NYSE",
    symbol: "ETN",
    currency: "USD",
    currentPrice: 361.1,
    quantity: 4,
    buyAmount: 2144674,
    evaluationAmount: 2182864,
    profit: 38190,
    returnRate: 2,
    currentWeight: 1.83,
    minWeight: 3,
    maxWeight: 5,
  },
  {
    id: "seed-11",
    name: "알파벳A",
    action: "HOLD",
    market: "NASDAQ",
    symbol: "GOOGL",
    currency: "USD",
    currentPrice: 295.77,
    quantity: 30,
    buyAmount: 13969480,
    evaluationAmount: 13409561,
    profit: -559919,
    returnRate: -4,
    currentWeight: 11.27,
    minWeight: 7,
    maxWeight: 15,
  },
  {
    id: "seed-12",
    name: "센트러스",
    action: "BUY",
    market: "NYSE",
    symbol: "LEU",
    currency: "USD",
    currentPrice: 183.21,
    quantity: 10,
    buyAmount: 2960558,
    evaluationAmount: 2768779,
    profit: -191779,
    returnRate: -6,
    currentWeight: 2.33,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-13",
    name: "TSMC(ADR)",
    action: "HOLD",
    market: "NYSE",
    symbol: "TSM",
    currency: "USD",
    currentPrice: 339.04,
    quantity: 9,
    buyAmount: 4079993,
    evaluationAmount: 4611398,
    profit: 531405,
    returnRate: 13,
    currentWeight: 3.87,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-14",
    name: "샌디스크",
    action: "HOLD",
    market: "NYSE",
    symbol: "BABA",
    currency: "USD",
    currentPrice: 701.59,
    quantity: 9,
    buyAmount: 3406077,
    evaluationAmount: 9542564,
    profit: 6136487,
    returnRate: 180,
    currentWeight: 8.02,
    minWeight: 5,
    maxWeight: 10,
  },
  {
    id: "seed-15",
    name: "에머슨일렉트릭",
    action: "HOLD",
    market: "NYSE",
    symbol: "EMR",
    currency: "USD",
    currentPrice: 131.7,
    quantity: 27,
    buyAmount: 5754333,
    evaluationAmount: 5373889,
    profit: -380444,
    returnRate: -7,
    currentWeight: 4.52,
    minWeight: 3,
    maxWeight: 6,
  },
  {
    id: "seed-16",
    name: "메타",
    action: "BUY",
    market: "NASDAQ",
    symbol: "HII",
    currency: "USD",
    currentPrice: 574.46,
    quantity: 2,
    buyAmount: 1919300,
    evaluationAmount: 1736317,
    profit: -182983,
    returnRate: -10,
    currentWeight: 1.46,
    minWeight: 3,
    maxWeight: 5,
  },
  {
    id: "seed-17",
    name: "헌팅턴잉걸스",
    action: "HOLD",
    market: "NYSE",
    symbol: "HII",
    currency: "USD",
    currentPrice: 396.62,
    quantity: 11,
    buyAmount: 6701954,
    evaluationAmount: 6593355,
    profit: -108599,
    returnRate: -2,
    currentWeight: 5.54,
    minWeight: 5,
    maxWeight: 10,
  },
  {
    id: "seed-18",
    name: "채권",
    action: "HOLD",
    market: "ETC",
    symbol: "BOND",
    currency: "KRW",
    currentPrice: 6970218,
    quantity: 1,
    buyAmount: 6970218,
    evaluationAmount: 6970218,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 0,
    maxWeight: 0,
  },
  {
    id: "seed-19",
    name: "예수금",
    action: "BUY",
    market: "CASH",
    symbol: "CASH",
    currency: "USD",
    currentPrice: 72.23,
    quantity: 1,
    buyAmount: 177684,
    evaluationAmount: 177684,
    profit: 0,
    returnRate: 0,
    currentWeight: 6.01,
    minWeight: 20,
    maxWeight: 20,
  },
];

export const INITIAL_PSY_AMOUNT = -975050;
