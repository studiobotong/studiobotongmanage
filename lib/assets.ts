// 레거시 파일: 이전 Asset/AssetSummary 타입 기반. 현재 사용되지 않음.

type AssetAction = "BUY" | "SELL" | "HOLD";
type AssetMarket = "KRX" | "NASDAQ" | "NYSE" | "ETC" | "CASH";
type AssetCurrency = "KRW" | "USD";

type Asset = {
  id: string;
  name: string;
  action: AssetAction;
  market: AssetMarket;
  symbol: string;
  currency: AssetCurrency;
  currentPrice: number;
  quantity: number;
  buyAmount: number;
  evaluationAmount: number;
  profit: number;
  returnRate: number;
  currentWeight: number;
  minWeight: number;
  maxWeight: number;
};

type AssetSummary = {
  totalBuyAmount: number;
  totalEvaluationAmount: number;
  totalProfit: number;
  totalReturnRate: number;
  psyAmount: number;
  domesticProfit: number;
};

type HistoryPeriod = "daily" | "monthly" | "yearly";

type AssetHistory = {
  id: string;
  period: HistoryPeriod;
  date: string;
  totalBuyAmount: number;
  totalEvaluationAmount: number;
  totalProfit: number;
  totalReturnRate: number;
  psyAmount: number;
  domesticProfit: number;
};

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
// Seed data  (2026-04-12 기준 실제 보유 현황)
// ---------------------------------------------------------------------------

export const SEED_ASSETS: Asset[] = [
  // 한국 주식
  {
    id: "seed-0",
    name: "삼성전자",
    action: "BUY",
    market: "KRX",
    symbol: "005930",
    currency: "KRW",
    currentPrice: 75000,
    quantity: 13,
    buyAmount: 975000,
    evaluationAmount: 975000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
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
    currentPrice: 185000,
    quantity: 2,
    buyAmount: 370000,
    evaluationAmount: 370000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
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
    currentPrice: 108500,
    quantity: 60,
    buyAmount: 6510000,
    evaluationAmount: 6510000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
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
    currentPrice: 215000,
    quantity: 8,
    buyAmount: 1720000,
    evaluationAmount: 1720000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
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
    currentPrice: 850000,
    quantity: 6,
    buyAmount: 5100000,
    evaluationAmount: 5100000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
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
    currentPrice: 215000,
    quantity: 8,
    buyAmount: 1720000,
    evaluationAmount: 1720000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-6",
    name: "현대자동차",
    action: "BUY",
    market: "KRX",
    symbol: "005380",
    currency: "KRW",
    currentPrice: 200000,
    quantity: 4,
    buyAmount: 800000,
    evaluationAmount: 800000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
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
    currentPrice: 620000,
    quantity: 4,
    buyAmount: 2480000,
    evaluationAmount: 2480000,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 4,
    maxWeight: 7,
  },
  // 미국 주식 (복수 계좌 합산)
  {
    id: "seed-8",
    name: "엔비디아",
    action: "HOLD",
    market: "NASDAQ",
    symbol: "NVDA",
    currency: "USD",
    currentPrice: 875.0,
    quantity: 73,   // 54 + 19
    buyAmount: 63875,
    evaluationAmount: 63875,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 5,
    maxWeight: 15,
  },
  {
    id: "seed-9",
    name: "이턴코퍼레이션",
    action: "BUY",
    market: "NYSE",
    symbol: "ETN",
    currency: "USD",
    currentPrice: 238.0,
    quantity: 4,    // 2 + 2
    buyAmount: 952,
    evaluationAmount: 952,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 3,
    maxWeight: 5,
  },
  {
    id: "seed-10",
    name: "알파벳A",
    action: "HOLD",
    market: "NASDAQ",
    symbol: "GOOGL",
    currency: "USD",
    currentPrice: 175.0,
    quantity: 30,   // 27 + 3
    buyAmount: 5250,
    evaluationAmount: 5250,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 7,
    maxWeight: 15,
  },
  {
    id: "seed-11",
    name: "TSMC(ADR)",
    action: "HOLD",
    market: "NYSE",
    symbol: "TSM",
    currency: "USD",
    currentPrice: 148.0,
    quantity: 9,    // 7 + 2
    buyAmount: 1332,
    evaluationAmount: 1332,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 3,
    maxWeight: 7,
  },
  {
    id: "seed-12",
    name: "에머슨일렉트릭",
    action: "HOLD",
    market: "NYSE",
    symbol: "EMR",
    currency: "USD",
    currentPrice: 108.0,
    quantity: 27,   // 15 + 12
    buyAmount: 2916,
    evaluationAmount: 2916,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 3,
    maxWeight: 6,
  },
  {
    id: "seed-13",
    name: "팔란티어",
    action: "BUY",
    market: "NASDAQ",
    symbol: "PLTR",
    currency: "USD",
    currentPrice: 25.5,
    quantity: 10,
    buyAmount: 255,
    evaluationAmount: 255,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 3,
    maxWeight: 6,
  },
  {
    id: "seed-14",
    name: "샌디스크",
    action: "HOLD",
    market: "NASDAQ",
    symbol: "SNDK",
    currency: "USD",
    currentPrice: 68.0,
    quantity: 9,
    buyAmount: 612,
    evaluationAmount: 612,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 5,
    maxWeight: 10,
  },
  {
    id: "seed-15",
    name: "메타",
    action: "BUY",
    market: "NASDAQ",
    symbol: "META",
    currency: "USD",
    currentPrice: 510.0,
    quantity: 2,
    buyAmount: 1020,
    evaluationAmount: 1020,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 3,
    maxWeight: 5,
  },
  {
    id: "seed-16",
    name: "헌팅턴잉걸스",
    action: "HOLD",
    market: "NYSE",
    symbol: "HII",
    currency: "USD",
    currentPrice: 280.0,
    quantity: 11,   // 9 + 2
    buyAmount: 3080,
    evaluationAmount: 3080,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 5,
    maxWeight: 10,
  },
  // 현금·채권
  {
    id: "seed-17",
    name: "한국예수금",
    action: "HOLD",
    market: "CASH",
    symbol: "KRW_CASH",
    currency: "KRW",
    currentPrice: 1,
    quantity: 1387934,
    buyAmount: 1387934,
    evaluationAmount: 1387934,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 0,
    maxWeight: 0,
  },
  {
    id: "seed-18",
    name: "미국채권",
    action: "HOLD",
    market: "ETC",
    symbol: "BOND_USD",
    currency: "USD",
    currentPrice: 1,
    quantity: 4664.53,   // 1884.97 + 996.28 + 891.64 + 891.64
    buyAmount: 4664.53,
    evaluationAmount: 4664.53,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 0,
    maxWeight: 0,
  },
  {
    id: "seed-19",
    name: "외화예수금",
    action: "HOLD",
    market: "CASH",
    symbol: "USD_CASH",
    currency: "USD",
    currentPrice: 1,
    quantity: 85.14,    // 49.49 + 13.26 + 22.39
    buyAmount: 85.14,
    evaluationAmount: 85.14,
    profit: 0,
    returnRate: 0,
    currentWeight: 0,
    minWeight: 0,
    maxWeight: 0,
  },
];

export const INITIAL_PSY_AMOUNT = 0;
