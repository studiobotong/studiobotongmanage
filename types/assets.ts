// ---------------------------------------------------------------------------
// Cashflow  (localStorage key: "asset_cashflow")
// ---------------------------------------------------------------------------

export type CashflowType = "DEPOSIT" | "WITHDRAW" | "DIVIDEND";

export type Cashflow = {
  id: string;
  flow_date: string;    // "YYYY-MM-DD"
  type: CashflowType;
  account?: string;
  currency?: string;
  amount: number;
  memo?: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// AssetSnapshot  (localStorage key: "asset_snapshots")
// ---------------------------------------------------------------------------

export type AssetSnapshot = {
  id: string;
  snapshot_date: string;    // "YYYY-MM-DD"
  total_asset: number;      // 총 자산 (KRW)
  stock_asset?: number;     // 주식 자산 (kr_asset + us_asset)
  cash_asset?: number;      // 현금·기타 자산 (KRW)
  kr_asset?: number;        // 한국 자산 평가금액 (KRW)
  us_asset?: number;        // 미국 자산 평가금액 (KRW 환산)
  net_investment?: number;  // 순투자금 (누적 입금 - 누적 출금)
  profit?: number;          // 수익 (total_asset - net_investment)
  return_rate?: number;     // 수익률 (%)
  created_at: string;
};

// ---------------------------------------------------------------------------
// AssetSnapshotHolding  (localStorage key: "asset_snapshot_holdings")
// ---------------------------------------------------------------------------

export type AssetSnapshotHolding = {
  id: string;
  snapshot_date: string;    // "YYYY-MM-DD"
  name: string;
  symbol?: string;
  market?: string;
  currency?: string;
  account?: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  evaluated_amount: number;
  weight?: number;
  /** 목표 비중 하한 (%) — 주식(STOCK), optional / null when unset */
  target_min_weight?: number | null;
  /** 목표 비중 상한 (%) — 주식(STOCK), optional / null when unset */
  target_max_weight?: number | null;
  asset_type?: string;
  created_at: string;
};
