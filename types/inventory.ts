export type StockMovementType =
  | "manual_adjust"
  | "return_in"
  | "purchase_in"
  | "order_out";

export type StockAdjustType =
  | "physical_count"
  | "defect_out"
  | "return_in"
  | "purchase_in"
  | "other";

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity_change: number;
  balance_after: number;
  related_order_no: string | null;
  related_purchase_id: string | null;
  note: string | null;
  created_at: string;
  product_name?: string;
  option_name?: string;
}

export interface StockAdjustInput {
  productId: string;
  type: StockAdjustType;
  /** defect_out, return_in, purchase_in, other */
  quantity?: number;
  /** physical_count */
  targetQty?: number;
  /** purchase_in */
  unitCost?: number;
  supplier?: string;
  purchaseMemo?: string;
  /** defect_out, other (required for other) */
  memo?: string;
  /** return_in optional */
  relatedOrderNo?: string;
  /** other: increase or decrease */
  direction?: "increase" | "decrease";
}

export interface StockAdjustResult {
  ok: boolean;
  error: string | null;
}
