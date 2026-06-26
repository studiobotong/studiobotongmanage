// ── BTM 테이블 타입 정의 ──────────────────────────────────────────

export interface BTMProduct {
  id: number;
  product_id: string;
  product_name: string;
  category: string | null;
  status: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BTMProductOption {
  id: number;
  product_id: string;
  option_code: string;       // 예: MESH001, RACK002
  option_name: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BTMOrder {
  id: number;
  order_id: string;
  product_order_id: string | null;
  order_date: string | null;
  payment_date: string | null;
  confirm_date: string | null;
  status: string | null;
  product_id: string | null;
  product_name: string | null;
  option_code: string | null;
  option_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount_amount: number;
  actual_payment: number;
  buyer_name: string | null;
  receiver_name: string | null;
  channel: string;
  collected_at: string;
  created_at: string;
}

export interface BTMSettlement {
  id: number;
  settlement_month: string;
  order_id: string | null;
  product_order_id: string | null;
  product_name: string | null;
  option_name: string | null;
  quantity: number;
  selling_price: number;
  naver_fee: number;
  payment_fee: number;
  ad_fee: number;
  settlement_amount: number;
  settlement_date: string | null;
  created_at: string;
}

export interface BTMMaterial {
  id: number;
  material_code: string;
  material_name: string;
  unit: string;
  current_price: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface BTMPurchase {
  id: number;
  purchase_date: string;
  purchase_type: "product" | "material" | "etc";
  supplier_id: number | null;
  option_id: number | null;
  material_id: number | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface BTMAdReport {
  id: number;
  report_date: string;
  channel: "meta" | "naver";
  campaign_name: string | null;
  ad_set_name: string | null;
  ad_name: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number | null;
  cpc: number | null;
  roas: number | null;
  cpa: number | null;
  created_at: string;
}

export interface BTMSupplier {
  id: number;
  supplier_code: string;
  supplier_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  memo: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// KPI 집계 타입
export interface BTMOrderSummary {
  totalRevenue: number;
  totalOrders: number;
  totalQuantity: number;
  avgOrderValue: number;
}

export interface BTMAdSummary {
  totalSpend: number;
  totalRevenue: number;
  roas: number;
  totalClicks: number;
  totalImpressions: number;
  ctr: string;
}
