export type AssetAction = "BUY" | "SELL" | "HOLD";
export type AssetMarket = "KRX" | "NASDAQ" | "NYSE" | "ETC" | "CASH";
export type AssetCurrency = "KRW" | "USD";

export type Asset = {
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

export type AssetSummary = {
  totalBuyAmount: number;
  totalEvaluationAmount: number;
  totalProfit: number;
  totalReturnRate: number;
  psyAmount: number;
  domesticProfit: number;
};

export type HistoryPeriod = "daily" | "monthly" | "yearly";

export type AssetHistory = {
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
