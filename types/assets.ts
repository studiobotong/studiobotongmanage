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
// HoldingBase  — 현재 보유현황·스냅샷 보유 공통 필드
// ---------------------------------------------------------------------------

/** holdings / asset_snapshot_holdings 양쪽에서 공유하는 공통 구조 */
export interface HoldingBase {
  id: string;
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
}

// ---------------------------------------------------------------------------
// Holding  — 현재 보유현황 원본 (holdings 테이블, snapshot_date 없음)
// ---------------------------------------------------------------------------

/**
 * 현재 보유현황 원본.
 * HoldingsManager 가 읽고 쓰는 단일 진실 원본(source of truth).
 * 날짜 차원 없음 — 변경 이력은 asset_snapshot_holdings 참조.
 */
export type Holding = HoldingBase & {
  /** DB 트리거가 UPDATE 시 자동 갱신 */
  updated_at: string;
};

// ---------------------------------------------------------------------------
// AssetSnapshotHolding  — 날짜별 스냅샷 보유 (asset_snapshot_holdings 테이블)
// ---------------------------------------------------------------------------

/**
 * 날짜별 보유 스냅샷 기록.
 * 현재 상태 편집에는 사용하지 않음 — 이력/차트 조회 전용.
 */
export type AssetSnapshotHolding = HoldingBase & {
  snapshot_date: string;    // "YYYY-MM-DD"
};
