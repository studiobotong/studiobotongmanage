export interface BotongProductOption {
  id: string;
  product_id: string;
  sku_code: string;
  option_name: string;
  cost_price: number;
  stock_qty: number;
  safety_stock: number;
  created_at: string;
  updated_at: string;
}

export interface OptionExcelRow {
  product_sku: string;
  sku_code: string;
  option_name: string;
  cost_price: number;
  safety_stock: number;
  stock_qty: number;
}

export interface OptionUploadResult {
  inserted: number;
  updated: number;
  skipped: number;
}

export type OptionEditableFields = Pick<
  BotongProductOption,
  "cost_price" | "safety_stock" | "stock_qty"
>;
