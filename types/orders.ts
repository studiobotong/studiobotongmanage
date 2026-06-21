export type ConfirmationStatus = "provisional" | "confirmed";

export interface BotongOrder {
  id: string;
  product_order_no: string;
  order_no: string;
  order_date: string;
  product_name: string;
  option_name: string;
  product_id: string | null;
  quantity: number;
  product_price: number;
  total_order_amount: number;
  shipping_fee: number;
  naver_fee: number;
  channel_fee: number;
  settlement_amount: number;
  order_status: string;
  order_status_detail: string | null;
  payment_method: string;
  channel: string;
  buyer_id_masked: string | null;
  confirmation_status: ConfirmationStatus;
  raw_row: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ParsedOrderRow {
  product_order_no: string;
  order_no: string;
  order_date: string | null;
  product_name: string;
  option_name: string;
  quantity: number;
  product_price: number;
  total_order_amount: number;
  shipping_fee: number;
  naver_fee: number;
  channel_fee: number;
  settlement_amount: number;
  order_status: string;
  order_status_detail: string | null;
  payment_method: string;
  channel: string;
  buyer_id_masked: string | null;
  raw_row: Record<string, unknown>;
}

export interface UnmatchedProduct {
  product_name: string;
  option_name: string;
  count: number;
}

export interface OrderUploadResult {
  inserted: number;
  insertedProvisional: number;
  insertedConfirmed: number;
  upgradedToConfirmed: number;
  skipped: number;
  unmatched: number;
  unmatchedProducts: UnmatchedProduct[];
  totalRows: number;
  elapsedMs: number;
  errors: string[];
  /** 업로드 시 재고 차감 옵션 적용 여부 (사용자 선택값) */
  stockApplied: boolean;
}

export interface OrderListFilters {
  dateFrom?: string;
  dateTo?: string;
  orderStatus?: string;
  confirmationStatus?: ConfirmationStatus | "";
  search?: string;
}

export interface OrderStockDeduction {
  product_id: string;
  product_name: string;
  option_name: string;
  quantity: number;
}

export interface OrderDeleteResult {
  ok: boolean;
  error: string | null;
}

export interface BulkOrderDeleteResult {
  ok: boolean;
  deleted: number;
  restoredOrders: number;
  error: string | null;
}

export interface BulkStockDeductionSummary {
  totalSelected: number;
  ordersWithDeductions: number;
}
