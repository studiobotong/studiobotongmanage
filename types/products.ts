export interface BotongProduct {
  id: string;
  product_name: string;
  option_name: string;
  sku: string | null;
  category: string | null;
  image_url: string | null;
  selling_price: number;
  cost_price: number;
  stock_qty: number;
  safety_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCsvRow {
  product_name: string;
  sku: string | null;
  category: string | null;
  image_url: string | null;
  selling_price: number;
  stock_qty: number;
  is_active: boolean;
}

export interface CsvUploadResult {
  inserted: number;
  updated: number;
  errors: number;
  errorMessages: string[];
}

export type ProductFormData = {
  product_name: string;
  option_name: string;
  selling_price: number;
  cost_price: number;
  stock_qty: number;
  safety_stock: number;
  category: string;
  image_url: string;
  is_active: boolean;
  sku: string;
};
