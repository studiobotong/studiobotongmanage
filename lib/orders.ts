import { supabase } from "./supabaseClient";
import { isAutoDeductStockEnabled } from "./settings";
import type {
  BotongOrder,
  OrderDeleteResult,
  OrderListFilters,
  OrderStockDeduction,
  OrderUploadResult,
  ParsedOrderRow,
  UnmatchedProduct,
} from "@/types/orders";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapOrderRow(r: Record<string, unknown>): BotongOrder {
  return {
    id: String(r.id ?? ""),
    product_order_no: String(r.product_order_no ?? ""),
    order_no: String(r.order_no ?? ""),
    order_date: String(r.order_date ?? ""),
    product_name: String(r.product_name ?? ""),
    option_name: String(r.option_name ?? ""),
    product_id: r.product_id != null ? String(r.product_id) : null,
    quantity: toNum(r.quantity),
    product_price: toNum(r.product_price),
    total_order_amount: toNum(r.total_order_amount),
    shipping_fee: toNum(r.shipping_fee),
    naver_fee: toNum(r.naver_fee),
    channel_fee: toNum(r.channel_fee),
    settlement_amount: toNum(r.settlement_amount),
    order_status: String(r.order_status ?? ""),
    order_status_detail:
      r.order_status_detail != null ? String(r.order_status_detail) : null,
    payment_method: String(r.payment_method ?? ""),
    channel: String(r.channel ?? ""),
    buyer_id_masked:
      r.buyer_id_masked != null ? String(r.buyer_id_masked) : null,
    raw_row: (r.raw_row as Record<string, unknown>) ?? {},
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

function isCancelledStatus(status: string): boolean {
  return status.includes("취소");
}

function bumpUnmatched(
  map: Map<string, UnmatchedProduct>,
  productName: string,
  optionName: string
) {
  const key = `${productName}\0${optionName}`;
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    map.set(key, { product_name: productName, option_name: optionName, count: 1 });
  }
}

async function findProductId(
  productName: string,
  optionName: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("botong_products")
    .select("id")
    .eq("product_name", productName)
    .eq("option_name", optionName)
    .maybeSingle();

  if (error || !data) return null;
  return String(data.id);
}

async function deductStock(
  productId: string,
  quantity: number,
  productOrderNo: string
): Promise<string | null> {
  const { data: product, error: fetchError } = await supabase
    .from("botong_products")
    .select("stock_qty")
    .eq("id", productId)
    .single();

  if (fetchError || !product) {
    return fetchError?.message ?? "상품 재고 조회 실패";
  }

  const newQty = Math.max(0, toNum(product.stock_qty) - quantity);
  const { error: updateError } = await supabase
    .from("botong_products")
    .update({ stock_qty: newQty })
    .eq("id", productId);

  if (updateError) return updateError.message;

  const { error: movementError } = await supabase
    .from("botong_stock_movements")
    .insert({
      product_id: productId,
      movement_type: "order_out",
      quantity_change: -quantity,
      balance_after: newQty,
      related_order_no: productOrderNo,
      note: `주문 업로드 재고 차감 (${productOrderNo})`,
    });

  if (movementError) return movementError.message;
  return null;
}

export async function processOrderUpload(
  rows: ParsedOrderRow[]
): Promise<OrderUploadResult> {
  const started = Date.now();
  const result: OrderUploadResult = {
    inserted: 0,
    skipped: 0,
    unmatched: 0,
    unmatchedProducts: [],
    totalRows: rows.length,
    elapsedMs: 0,
    errors: [],
  };

  const autoDeduct = await isAutoDeductStockEnabled();
  const seenInBatch = new Set<string>();
  const unmatchedMap = new Map<string, UnmatchedProduct>();

  for (const row of rows) {
    if (seenInBatch.has(row.product_order_no)) {
      result.skipped += 1;
      continue;
    }
    seenInBatch.add(row.product_order_no);

    const { data: existing, error: existingError } = await supabase
      .from("botong_orders")
      .select("id")
      .eq("product_order_no", row.product_order_no)
      .maybeSingle();

    if (existingError) {
      result.errors.push(
        `${row.product_order_no}: 중복 확인 실패 — ${existingError.message}`
      );
      continue;
    }

    if (existing) {
      result.skipped += 1;
      continue;
    }

    const productId = await findProductId(row.product_name, row.option_name);
    if (!productId) {
      result.unmatched += 1;
      bumpUnmatched(unmatchedMap, row.product_name, row.option_name);
    }

    const { error: insertError } = await supabase.from("botong_orders").insert({
      product_order_no: row.product_order_no,
      order_no: row.order_no,
      order_date: row.order_date,
      product_name: row.product_name,
      option_name: row.option_name,
      product_id: productId,
      quantity: row.quantity,
      product_price: row.product_price,
      total_order_amount: row.total_order_amount,
      shipping_fee: row.shipping_fee,
      naver_fee: row.naver_fee,
      channel_fee: row.channel_fee,
      settlement_amount: row.settlement_amount,
      order_status: row.order_status,
      order_status_detail: row.order_status_detail,
      payment_method: row.payment_method,
      channel: row.channel,
      buyer_id_masked: row.buyer_id_masked,
      raw_row: row.raw_row,
    });

    if (insertError) {
      result.errors.push(
        `${row.product_order_no}: 저장 실패 — ${insertError.message}`
      );
      continue;
    }

    result.inserted += 1;

    if (
      autoDeduct &&
      productId &&
      row.quantity > 0 &&
      !isCancelledStatus(row.order_status)
    ) {
      const stockError = await deductStock(
        productId,
        row.quantity,
        row.product_order_no
      );
      if (stockError) {
        result.errors.push(
          `${row.product_order_no}: 재고 차감 실패 — ${stockError}`
        );
      }
    }
  }

  result.unmatchedProducts = Array.from(unmatchedMap.values());
  result.elapsedMs = Date.now() - started;
  return result;
}

export async function getOrders(
  filters: OrderListFilters = {}
): Promise<BotongOrder[]> {
  let query = supabase
    .from("botong_orders")
    .select(
      "id, product_order_no, order_no, order_date, product_name, option_name, product_id, quantity, product_price, total_order_amount, shipping_fee, naver_fee, channel_fee, settlement_amount, order_status, order_status_detail, payment_method, channel, buyer_id_masked, raw_row, created_at, updated_at"
    )
    .order("order_date", { ascending: false });

  if (filters.dateFrom) {
    query = query.gte("order_date", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("order_date", `${filters.dateTo}T23:59:59`);
  }
  if (filters.orderStatus) {
    query = query.eq("order_status", filters.orderStatus);
  }
  if (filters.search?.trim()) {
    query = query.ilike("product_name", `%${filters.search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[orders] getOrders 오류:", error.message);
    return [];
  }

  return (data ?? []).map((r) => mapOrderRow(r as Record<string, unknown>));
}

export async function getDistinctOrderStatuses(): Promise<string[]> {
  const { data, error } = await supabase
    .from("botong_orders")
    .select("order_status");

  if (error) return [];

  const statuses = new Set<string>();
  for (const row of data ?? []) {
    const status = String(row.order_status ?? "").trim();
    if (status) statuses.add(status);
  }
  return Array.from(statuses).sort();
}

export async function getOrderStockDeductions(
  productOrderNo: string
): Promise<OrderStockDeduction[]> {
  const { data, error } = await supabase
    .from("botong_stock_movements")
    .select(
      "product_id, quantity_change, botong_products ( product_name, option_name )"
    )
    .eq("related_order_no", productOrderNo)
    .eq("movement_type", "order_out");

  if (error) {
    console.error("[orders] getOrderStockDeductions 오류:", error.message);
    return [];
  }

  const deductions: OrderStockDeduction[] = [];
  for (const row of data ?? []) {
    const qty = Math.abs(toNum(row.quantity_change));
    if (qty <= 0) continue;

    const product = row.botong_products as
      | { product_name?: string; option_name?: string }
      | { product_name?: string; option_name?: string }[]
      | null;
    const productInfo = Array.isArray(product) ? product[0] : product;

    deductions.push({
      product_id: String(row.product_id ?? ""),
      product_name: String(productInfo?.product_name ?? "알 수 없는 상품"),
      option_name: String(productInfo?.option_name ?? ""),
      quantity: qty,
    });
  }

  return deductions;
}

async function restoreStockForOrder(
  productOrderNo: string,
  deductions: OrderStockDeduction[]
): Promise<string | null> {
  for (const deduction of deductions) {
    const { data: product, error: fetchError } = await supabase
      .from("botong_products")
      .select("stock_qty")
      .eq("id", deduction.product_id)
      .single();

    if (fetchError || !product) {
      return fetchError?.message ?? "상품 재고 조회 실패";
    }

    const newQty = toNum(product.stock_qty) + deduction.quantity;
    const { error: updateError } = await supabase
      .from("botong_products")
      .update({ stock_qty: newQty })
      .eq("id", deduction.product_id);

    if (updateError) return updateError.message;

    const { error: movementError } = await supabase
      .from("botong_stock_movements")
      .insert({
        product_id: deduction.product_id,
        movement_type: "manual_adjust",
        quantity_change: deduction.quantity,
        balance_after: newQty,
        related_order_no: productOrderNo,
        note: `주문 삭제로 인한 재고 복구 (주문번호: ${productOrderNo})`,
      });

    if (movementError) return movementError.message;
  }

  return null;
}

export async function deleteOrder(
  orderId: string,
  options: { restoreStock: boolean }
): Promise<OrderDeleteResult> {
  const { data: order, error: fetchError } = await supabase
    .from("botong_orders")
    .select("id, product_order_no")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!order) {
    return { ok: false, error: "주문을 찾을 수 없습니다." };
  }

  const productOrderNo = String(order.product_order_no ?? "");

  if (options.restoreStock) {
    const deductions = await getOrderStockDeductions(productOrderNo);
    if (deductions.length > 0) {
      const restoreError = await restoreStockForOrder(
        productOrderNo,
        deductions
      );
      if (restoreError) {
        return { ok: false, error: `재고 복구 실패 — ${restoreError}` };
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("botong_orders")
    .delete()
    .eq("id", orderId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  return { ok: true, error: null };
}
