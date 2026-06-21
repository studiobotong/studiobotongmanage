import { supabase } from "./supabaseClient";
import type {
  StockAdjustInput,
  StockAdjustResult,
  StockMovement,
  StockMovementType,
} from "@/types/inventory";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapMovementRow(
  r: Record<string, unknown>,
  productInfo?: { product_name: string; option_name: string }
): StockMovement {
  return {
    id: String(r.id ?? ""),
    product_id: String(r.product_id ?? ""),
    movement_type: String(r.movement_type ?? "manual_adjust") as StockMovementType,
    quantity_change: toNum(r.quantity_change),
    balance_after: toNum(r.balance_after),
    related_order_no:
      r.related_order_no != null ? String(r.related_order_no) : null,
    related_purchase_id:
      r.related_purchase_id != null ? String(r.related_purchase_id) : null,
    note: r.note != null ? String(r.note) : null,
    created_at: String(r.created_at ?? ""),
    product_name: productInfo?.product_name,
    option_name: productInfo?.option_name,
  };
}

export function getMovementLabel(
  movement: Pick<StockMovement, "movement_type" | "note">
): string {
  const note = movement.note?.trim() ?? "";
  if (note.startsWith("실사 조정")) return "실사 조정";
  if (note.startsWith("불량품 차감")) return "불량품 차감";
  if (note.startsWith("반품 접수")) return "반품 접수";
  if (movement.movement_type === "purchase_in") return "신규 입고";
  if (movement.movement_type === "return_in") return "반품 접수";
  if (movement.movement_type === "order_out") return "주문 출고";
  if (note.includes("주문 삭제로 인한 재고 복구")) return "재고 복구";
  if (note.includes("주문 업로드 재고 차감")) return "주문 차감";
  if (movement.movement_type === "manual_adjust" && note) return note;
  return "기타 조정";
}

async function getProductStock(productId: string): Promise<{
  stockQty: number;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("botong_products")
    .select("stock_qty")
    .eq("id", productId)
    .single();

  if (error || !data) {
    return { stockQty: 0, error: error?.message ?? "상품을 찾을 수 없습니다." };
  }

  return { stockQty: toNum(data.stock_qty), error: null };
}

async function applyStockChange(
  productId: string,
  quantityChange: number,
  movement: {
    movement_type: StockMovementType;
    note: string;
    related_order_no?: string | null;
    related_purchase_id?: string | null;
  }
): Promise<StockAdjustResult> {
  const { stockQty, error: fetchError } = await getProductStock(productId);
  if (fetchError) return { ok: false, error: fetchError };

  const newQty = Math.max(0, stockQty + quantityChange);

  const { error: updateError } = await supabase
    .from("botong_products")
    .update({ stock_qty: newQty })
    .eq("id", productId);

  if (updateError) return { ok: false, error: updateError.message };

  const { error: movementError } = await supabase
    .from("botong_stock_movements")
    .insert({
      product_id: productId,
      movement_type: movement.movement_type,
      quantity_change: quantityChange,
      balance_after: newQty,
      related_order_no: movement.related_order_no ?? null,
      related_purchase_id: movement.related_purchase_id ?? null,
      note: movement.note,
    });

  if (movementError) return { ok: false, error: movementError.message };

  return { ok: true, error: null };
}

export async function adjustStock(
  input: StockAdjustInput
): Promise<StockAdjustResult> {
  const productId = input.productId.trim();
  if (!productId) return { ok: false, error: "상품 ID가 필요합니다." };

  switch (input.type) {
    case "physical_count": {
      const targetQty = input.targetQty;
      if (targetQty == null || targetQty < 0 || !Number.isFinite(targetQty)) {
        return { ok: false, error: "유효한 현재고를 입력해주세요." };
      }
      const { stockQty, error } = await getProductStock(productId);
      if (error) return { ok: false, error };
      const diff = targetQty - stockQty;
      if (diff === 0) return { ok: true, error: null };
      return applyStockChange(productId, diff, {
        movement_type: "manual_adjust",
        note: "실사 조정",
      });
    }

    case "defect_out": {
      const qty = input.quantity ?? 0;
      if (qty <= 0) return { ok: false, error: "차감 수량을 입력해주세요." };
      const note = input.memo?.trim()
        ? `불량품 차감: ${input.memo.trim()}`
        : "불량품 차감";
      return applyStockChange(productId, -qty, {
        movement_type: "manual_adjust",
        note,
      });
    }

    case "return_in": {
      const qty = input.quantity ?? 0;
      if (qty <= 0) return { ok: false, error: "반품 수량을 입력해주세요." };
      const orderNo = input.relatedOrderNo?.trim() || null;
      const note = orderNo
        ? `반품 접수 (주문번호: ${orderNo})`
        : "반품 접수";
      return applyStockChange(productId, qty, {
        movement_type: "return_in",
        note,
        related_order_no: orderNo,
      });
    }

    case "purchase_in": {
      const qty = input.quantity ?? 0;
      const unitCost = input.unitCost ?? 0;
      if (qty <= 0) return { ok: false, error: "입고 수량을 입력해주세요." };
      if (unitCost < 0) return { ok: false, error: "단가를 입력해주세요." };

      const totalCost = qty * unitCost;
      const purchaseDate = new Date().toISOString().slice(0, 10);
      const memo = input.purchaseMemo?.trim() || null;

      const { data: purchase, error: purchaseError } = await supabase
        .from("botong_purchases")
        .insert({
          purchase_date: purchaseDate,
          product_id: productId,
          quantity: qty,
          unit_cost: unitCost,
          total_cost: totalCost,
          supplier: input.supplier?.trim() || null,
          memo,
        })
        .select("id")
        .single();

      if (purchaseError) {
        return { ok: false, error: `사입 기록 실패 — ${purchaseError.message}` };
      }

      return applyStockChange(productId, qty, {
        movement_type: "purchase_in",
        note: "신규 입고",
        related_purchase_id: String(purchase.id),
      });
    }

    case "other": {
      const qty = input.quantity ?? 0;
      const memo = input.memo?.trim();
      if (!memo) return { ok: false, error: "조정 사유를 입력해주세요." };
      if (qty <= 0) return { ok: false, error: "조정 수량을 입력해주세요." };
      const change =
        input.direction === "decrease" ? -qty : qty;
      return applyStockChange(productId, change, {
        movement_type: "manual_adjust",
        note: memo,
      });
    }

    default:
      return { ok: false, error: "알 수 없는 조정 유형입니다." };
  }
}

export async function getStockMovements(
  options: { productId?: string; limit?: number } = {}
): Promise<StockMovement[]> {
  const limit = options.limit ?? 100;

  let query = supabase
    .from("botong_stock_movements")
    .select(
      "id, product_id, movement_type, quantity_change, balance_after, related_order_no, related_purchase_id, note, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.productId) {
    query = query.eq("product_id", options.productId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[inventory] getStockMovements 오류:", error.message);
    return [];
  }

  const rows = data ?? [];
  const productIds = [
    ...new Set(rows.map((r) => String(r.product_id ?? "")).filter(Boolean)),
  ];

  const productMap = new Map<
    string,
    { product_name: string; option_name: string }
  >();

  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("botong_products")
      .select("id, product_name, option_name")
      .in("id", productIds);

    for (const p of products ?? []) {
      productMap.set(String(p.id ?? ""), {
        product_name: String(p.product_name ?? ""),
        option_name: String(p.option_name ?? ""),
      });
    }
  }

  return rows.map((r) =>
    mapMovementRow(
      r as Record<string, unknown>,
      productMap.get(String(r.product_id ?? ""))
    )
  );
}
