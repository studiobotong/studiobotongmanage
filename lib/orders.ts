import { supabase } from "./supabaseClient";
import { isAutoDeductStockEnabled } from "./settings";
import type { OrderExcelFormat } from "./orderParser";
import type {
  BotongOrder,
  BulkOrderDeleteResult,
  BulkStockDeductionSummary,
  ConfirmationStatus,
  OrderDeleteResult,
  OrderListFilters,
  OrderListResult,
  OrderStockDeduction,
  OrderUploadResult,
  ParsedOrderRow,
  UnmatchedProduct,
} from "@/types/orders";

const ORDER_LIST_PAGE_SIZE = 50;

const ORDER_LIST_COLUMNS =
  "id, product_order_no, order_no, order_date, product_name, option_name, product_id, quantity, product_price, total_order_amount, shipping_fee, naver_fee, channel_fee, settlement_amount, order_status, order_status_detail, payment_method, channel, buyer_id_masked, confirmation_status, raw_row, created_at, updated_at";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapOrderRow(r: Record<string, unknown>): BotongOrder {
  const rawStatus = String(r.confirmation_status ?? "provisional");
  const confirmation_status: ConfirmationStatus =
    rawStatus === "confirmed" ? "confirmed" : "provisional";

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
    confirmation_status,
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

function buildOrderPayload(
  row: ParsedOrderRow,
  productId: string | null,
  confirmationStatus: ConfirmationStatus
) {
  return {
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
    confirmation_status: confirmationStatus,
    raw_row: row.raw_row,
  };
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
  rows: ParsedOrderRow[],
  options: { applyStock?: boolean; format?: OrderExcelFormat | null } = {}
): Promise<OrderUploadResult> {
  const applyStock = options.applyStock !== false;
  const format = options.format ?? "fulfillment";
  const started = Date.now();
  const result: OrderUploadResult = {
    inserted: 0,
    insertedProvisional: 0,
    insertedConfirmed: 0,
    upgradedToConfirmed: 0,
    skipped: 0,
    unmatched: 0,
    unmatchedProducts: [],
    totalRows: rows.length,
    elapsedMs: 0,
    errors: [],
    stockApplied: applyStock,
  };

  const autoDeduct = applyStock && (await isAutoDeductStockEnabled());
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
      .select("id, confirmation_status")
      .eq("product_order_no", row.product_order_no)
      .maybeSingle();

    if (existingError) {
      result.errors.push(
        `${row.product_order_no}: 중복 확인 실패 — ${existingError.message}`
      );
      continue;
    }

    const productId = await findProductId(row.product_name, row.option_name);

    if (format === "purchase_confirmation") {
      if (existing) {
        const status = String(existing.confirmation_status ?? "provisional");
        if (status === "confirmed") {
          result.skipped += 1;
          continue;
        }

        if (status === "provisional") {
          const updatePayload = buildOrderPayload(row, productId, "confirmed");
          const { error: updateError } = await supabase
            .from("botong_orders")
            .update(updatePayload)
            .eq("id", existing.id);

          if (updateError) {
            result.errors.push(
              `${row.product_order_no}: 확정 업데이트 실패 — ${updateError.message}`
            );
            continue;
          }

          result.upgradedToConfirmed += 1;
          continue;
        }
      }

      if (!productId) {
        result.unmatched += 1;
        bumpUnmatched(unmatchedMap, row.product_name, row.option_name);
      }

      const { error: insertError } = await supabase
        .from("botong_orders")
        .insert(buildOrderPayload(row, productId, "confirmed"));

      if (insertError) {
        result.errors.push(
          `${row.product_order_no}: 저장 실패 — ${insertError.message}`
        );
        continue;
      }

      result.inserted += 1;
      result.insertedConfirmed += 1;

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

      continue;
    }

    // fulfillment (발주발송관리) upload
    if (existing) {
      result.skipped += 1;
      continue;
    }

    if (!productId) {
      result.unmatched += 1;
      bumpUnmatched(unmatchedMap, row.product_name, row.option_name);
    }

    const { error: insertError } = await supabase
      .from("botong_orders")
      .insert(buildOrderPayload(row, productId, "provisional"));

    if (insertError) {
      result.errors.push(
        `${row.product_order_no}: 저장 실패 — ${insertError.message}`
      );
      continue;
    }

    result.inserted += 1;
    result.insertedProvisional += 1;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOrderListFilters(query: any, filters: OrderListFilters): any {
  let q = query;
  if (filters.dateFrom) {
    q = q.gte("order_date", filters.dateFrom);
  }
  if (filters.dateTo) {
    q = q.lte("order_date", `${filters.dateTo}T23:59:59`);
  }
  if (filters.orderStatus) {
    q = q.eq("order_status", filters.orderStatus);
  }
  if (filters.confirmationStatus) {
    q = q.eq("confirmation_status", filters.confirmationStatus);
  }
  if (filters.search?.trim()) {
    q = q.ilike("product_name", `%${filters.search.trim()}%`);
  }
  return q;
}

function sumSettlementAmounts(data: unknown): number {
  if (!Array.isArray(data)) return 0;
  return data.reduce(
    (sum, row) => sum + toNum((row as Record<string, unknown>).settlement_amount),
    0
  );
}

export async function getOrders(
  filters: OrderListFilters = {}
): Promise<OrderListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? ORDER_LIST_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const empty: OrderListResult = {
    orders: [],
    totalCount: 0,
    totalSettlement: 0,
  };

  const listQuery = applyOrderListFilters(
    supabase
      .from("botong_orders")
      .select(ORDER_LIST_COLUMNS)
      .order("order_date", { ascending: false }),
    filters
  ).range(from, to);

  const countQuery = applyOrderListFilters(
    supabase.from("botong_orders").select("id", { count: "exact", head: true }),
    filters
  );

  const settlementQuery = applyOrderListFilters(
    supabase.from("botong_orders").select("settlement_amount"),
    filters
  );

  const [listResult, countResult, settlementResult] = await Promise.all([
    listQuery,
    countQuery,
    settlementQuery,
  ]);

  if (listResult.error) {
    console.error("[orders] getOrders 목록 오류:", listResult.error.message);
    return empty;
  }
  if (countResult.error) {
    console.error("[orders] getOrders 건수 오류:", countResult.error.message);
  }
  if (settlementResult.error) {
    console.error("[orders] getOrders 합계 오류:", settlementResult.error.message);
  }

  return {
    orders: ((listResult.data ?? []) as Record<string, unknown>[]).map((r) =>
      mapOrderRow(r)
    ),
    totalCount: countResult.count ?? 0,
    totalSettlement: sumSettlementAmounts(settlementResult.data),
  };
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

function isFetchFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("failed to fetch") || lower.includes("fetch failed");
}

export async function getOrderStockDeductions(
  productOrderNo: string
): Promise<OrderStockDeduction[]> {
  const orderNo = productOrderNo.trim();
  if (!orderNo) return [];

  try {
    const { data: movements, error: movementError } = await supabase
      .from("botong_stock_movements")
      .select("product_id, quantity_change")
      .eq("related_order_no", orderNo)
      .eq("movement_type", "order_out");

    if (movementError) {
      if (!isFetchFailure(movementError.message)) {
        console.error(
          "[orders] getOrderStockDeductions 오류:",
          movementError.message
        );
      }
      return [];
    }

    const productIds = [
      ...new Set(
        (movements ?? [])
          .map((row) => String(row.product_id ?? "").trim())
          .filter(Boolean)
      ),
    ];

    const productMap = new Map<
      string,
      { product_name: string; option_name: string }
    >();

    if (productIds.length > 0) {
      const { data: products, error: productError } = await supabase
        .from("botong_products")
        .select("id, product_name, option_name")
        .in("id", productIds);

      if (productError) {
        if (!isFetchFailure(productError.message)) {
          console.error(
            "[orders] getOrderStockDeductions 상품 조회 오류:",
            productError.message
          );
        }
      } else {
        for (const product of products ?? []) {
          productMap.set(String(product.id ?? ""), {
            product_name: String(product.product_name ?? "알 수 없는 상품"),
            option_name: String(product.option_name ?? ""),
          });
        }
      }
    }

    const deductions: OrderStockDeduction[] = [];
    for (const row of movements ?? []) {
      const qty = Math.abs(toNum(row.quantity_change));
      if (qty <= 0) continue;

      const productId = String(row.product_id ?? "");
      const productInfo = productMap.get(productId);

      deductions.push({
        product_id: productId,
        product_name: productInfo?.product_name ?? "알 수 없는 상품",
        option_name: productInfo?.option_name ?? "",
        quantity: qty,
      });
    }

    return deductions;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!isFetchFailure(message)) {
      console.error("[orders] getOrderStockDeductions 오류:", message);
    }
    return [];
  }
}

export async function getBulkStockDeductionSummary(
  productOrderNos: string[]
): Promise<BulkStockDeductionSummary> {
  const unique = [...new Set(productOrderNos.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { totalSelected: 0, ordersWithDeductions: 0 };
  }

  const ordersWithDeductions = new Set<string>();
  const batchSize = 100;

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("botong_stock_movements")
      .select("related_order_no")
      .eq("movement_type", "order_out")
      .in("related_order_no", batch);

    if (error) {
      console.error(
        "[orders] getBulkStockDeductionSummary 오류:",
        error.message
      );
      continue;
    }

    for (const row of data ?? []) {
      const orderNo = String(row.related_order_no ?? "").trim();
      if (orderNo) ordersWithDeductions.add(orderNo);
    }
  }

  return {
    totalSelected: unique.length,
    ordersWithDeductions: ordersWithDeductions.size,
  };
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

export async function deleteOrdersBulk(
  orderIds: string[],
  options: { restoreStock: boolean }
): Promise<BulkOrderDeleteResult> {
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: false, deleted: 0, restoredOrders: 0, error: "삭제할 주문이 없습니다." };
  }

  let deleted = 0;
  let restoredOrders = 0;

  for (const orderId of ids) {
    const { data: order, error: fetchError } = await supabase
      .from("botong_orders")
      .select("id, product_order_no")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError) {
      return {
        ok: false,
        deleted,
        restoredOrders,
        error: `주문 조회 실패 — ${fetchError.message}`,
      };
    }
    if (!order) continue;

    const productOrderNo = String(order.product_order_no ?? "");

    if (options.restoreStock) {
      const deductions = await getOrderStockDeductions(productOrderNo);
      if (deductions.length > 0) {
        const restoreError = await restoreStockForOrder(
          productOrderNo,
          deductions
        );
        if (restoreError) {
          return {
            ok: false,
            deleted,
            restoredOrders,
            error: `재고 복구 실패 (${productOrderNo}) — ${restoreError}`,
          };
        }
        restoredOrders += 1;
      }
    }

    const { error: deleteError } = await supabase
      .from("botong_orders")
      .delete()
      .eq("id", orderId);

    if (deleteError) {
      return {
        ok: false,
        deleted,
        restoredOrders,
        error: `주문 삭제 실패 — ${deleteError.message}`,
      };
    }

    deleted += 1;
  }

  return { ok: true, deleted, restoredOrders, error: null };
}
