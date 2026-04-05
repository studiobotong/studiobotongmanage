export type TransactionType = "BUY" | "SELL";
export type TransactionCurrency = "KRW" | "USD" | "EUR" | "JPY";
export type TransactionMarket = "KRX" | "NASDAQ" | "NYSE" | "ETC";

export interface AssetTransaction {
  id: string;
  trade_date: string;
  type: TransactionType;
  name: string;
  symbol: string;
  market: TransactionMarket | string;
  currency: TransactionCurrency | string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  fee: number | null;
  memo: string | null;
  created_at: string;
}

export type AssetTransactionInsert = Omit<AssetTransaction, "id" | "created_at">;

// Computed holding from aggregated transactions
export interface Holding {
  symbol: string;
  name: string;
  market: string;
  currency: string;
  quantity: number;
  avgPrice: number;
  totalBuyAmount: number;
  currentPrice: number;
  evaluationAmount: number;
  profit: number;
  returnRate: number;
}

export interface HoldingsSummary {
  totalBuyAmount: number;
  totalEvaluationAmount: number;
  totalProfit: number;
  totalReturnRate: number;
}

// Excel upload row (before validation)
export interface UploadRow {
  rowIndex: number;
  trade_date: string;
  type: string;
  name: string;
  symbol: string;
  market: string;
  currency: string;
  quantity: string | number;
  unit_price: string | number;
  fee?: string | number;
  memo?: string;
  error?: string;
  isDuplicate?: boolean;
}
