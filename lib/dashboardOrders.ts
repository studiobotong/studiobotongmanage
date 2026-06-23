import { supabase } from "./supabaseClient";
import { resolveOrderCostPrices } from "./orderCost";
import {
  addDaysKst,
  kstDayEnd,
  kstDayStart,
  toKstDate,
} from "./kstDate";

export const DASHBOARD_ORDER_SELECT =
  "order_date, settlement_amount, total_order_amount, product_price, order_status, confirmation_status, option_id, product_id, quantity, product_name, option_name, raw_row";

export interface DashboardOrderRow {
  order_date: string;
  settlement_amount: number;
  total_order_amount: number;
  product_price: number;
  order_status: string;
  confirmation_status: string;
  option_id: string | null;
  product_id: string | null;
  quantity: number;
  product_name: string;
  option_name: string;
  raw_row: Record<string, unknown>;
}

export interface ProductPriceMaps {
  skuToPrice: Map<string, number>;
  productIdToPrice: Map<string, number>;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 취소·반품·교환 등 매출·순이익 집계 제외 */
export function isExcludedOrderStatus(status: string): boolean {
  const s = status.trim();
  return s.includes("취소") || s.includes("반품") || s.includes("교환");
}

export function isRevenueOrder(
  order: Pick<DashboardOrderRow, "confirmation_status" | "order_status">
): boolean {
  if (isExcludedOrderStatus(order.order_status)) return false;
  const conf = order.confirmation_status;
  return conf === "provisional" || conf === "confirmed";
}

function parseRawNumber(raw: Record<string, unknown>, key: string): number {
  const v = raw[key];
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function skuFromRaw(raw: Record<string, unknown>): string | null {
  const v = raw["상품번호"];
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function resolveSyncSalesAmount(row: {
  settlement_amount: number;
  total_order_amount: number;
  product_price: number;
  quantity: number;
  raw_row: Record<string, unknown>;
}): number {
  if (row.settlement_amount > 0) return row.settlement_amount;
  const fromRaw = parseRawNumber(row.raw_row, "정산예정금액");
  if (fromRaw > 0) return fromRaw;
  if (row.total_order_amount > 0) return row.total_order_amount;
  const fromRawTotal = parseRawNumber(row.raw_row, "최종 상품별 총 주문금액");
  if (fromRawTotal > 0) return fromRawTotal;
  if (row.product_price > 0) return row.product_price * row.quantity;
  return 0;
}

export function orderSalesAmount(
  order: DashboardOrderRow,
  priceMaps?: ProductPriceMaps
): number {
  const sync = resolveSyncSalesAmount(order);
  if (sync > 0) return sync;

  if (priceMaps) {
    if (order.product_id && priceMaps.productIdToPrice.has(order.product_id)) {
      return priceMaps.productIdToPrice.get(order.product_id)! * order.quantity;
    }
    const sku = skuFromRaw(order.raw_row);
    if (sku && priceMaps.skuToPrice.has(sku)) {
      return priceMaps.skuToPrice.get(sku)! * order.quantity;
    }
  }

  return 0;
}

export async function fetchProductPriceMaps(): Promise<ProductPriceMaps> {
  const { data, error } = await supabase
    .from("botong_products")
    .select("id, sku, selling_price");

  if (error) {
    console.error("[dashboard] 상품 가격 조회 오류:", error.message);
    return { skuToPrice: new Map(), productIdToPrice: new Map() };
  }

  const skuToPrice = new Map<string, number>();
  const productIdToPrice = new Map<string, number>();

  for (const row of data ?? []) {
    const price = toNum(row.selling_price);
    if (price <= 0) continue;
    productIdToPrice.set(String(row.id), price);
    const sku = String(row.sku ?? "").trim();
    if (sku) skuToPrice.set(sku, price);
  }

  return { skuToPrice, productIdToPrice };
}

export async function applySalesAmountFallbacks(
  orders: DashboardOrderRow[]
): Promise<DashboardOrderRow[]> {
  const needsLookup = orders.some(
    (o) => isRevenueOrder(o) && resolveSyncSalesAmount(o) <= 0
  );
  if (!needsLookup) return orders;

  const priceMaps = await fetchProductPriceMaps();
  return orders.map((order) => {
    if (!isRevenueOrder(order)) return order;
    const amount = orderSalesAmount(order, priceMaps);
    if (amount <= 0 || order.settlement_amount > 0) return order;
    return { ...order, settlement_amount: amount };
  });
}

export function mapDashboardOrderRow(r: Record<string, unknown>): DashboardOrderRow {
  const raw_row = (r.raw_row as Record<string, unknown>) ?? {};
  const row: DashboardOrderRow = {
    order_date: String(r.order_date ?? ""),
    settlement_amount: toNum(r.settlement_amount),
    total_order_amount: toNum(r.total_order_amount),
    product_price: toNum(r.product_price),
    order_status: String(r.order_status ?? ""),
    confirmation_status: String(r.confirmation_status ?? "provisional"),
    option_id: r.option_id != null ? String(r.option_id) : null,
    product_id: r.product_id != null ? String(r.product_id) : null,
    quantity: toNum(r.quantity),
    product_name: String(r.product_name ?? ""),
    option_name: String(r.option_name ?? ""),
    raw_row,
  };
  const resolved = resolveSyncSalesAmount(row);
  if (resolved > 0 && row.settlement_amount <= 0) {
    row.settlement_amount = resolved;
  }
  return row;
}

/** KST 날짜 범위로 주문 조회 (DB는 ±1일 여유, 메모리에서 KST 필터) */
export async function fetchOrdersInKstRange(
  startDate: string,
  endDate: string
): Promise<DashboardOrderRow[]> {
  const dbStart = kstDayStart(addDaysKst(startDate, -1));
  const dbEnd = kstDayEnd(addDaysKst(endDate, 1));
  const pageSize = 1000;
  const all: DashboardOrderRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("botong_orders")
      .select(DASHBOARD_ORDER_SELECT)
      .gte("order_date", dbStart)
      .lte("order_date", dbEnd)
      .order("order_date", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("[dashboard] 주문 조회 오류:", error.message);
      break;
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    all.push(...rows.map(mapDashboardOrderRow));

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const filtered = all.filter((o) => {
    const d = toKstDate(o.order_date);
    return d >= startDate && d <= endDate;
  });

  return applySalesAmountFallbacks(filtered);
}

export function filterOrdersByKstDate(
  orders: DashboardOrderRow[],
  startDate: string,
  endDate: string
): DashboardOrderRow[] {
  return orders.filter((o) => {
    const d = toKstDate(o.order_date);
    return d >= startDate && d <= endDate;
  });
}

export function sumSales(
  orders: DashboardOrderRow[],
  priceMaps?: ProductPriceMaps
): number {
  return orders
    .filter(isRevenueOrder)
    .reduce((sum, o) => sum + orderSalesAmount(o, priceMaps), 0);
}

export function countRevenueOrders(orders: DashboardOrderRow[]): number {
  return orders.filter(isRevenueOrder).length;
}

function orderMargin(
  order: DashboardOrderRow,
  cost: number | null | undefined
): number | null {
  if (cost == null) return null;
  return orderSalesAmount(order) - cost * order.quantity;
}

export async function calcProfitForOrders(
  orders: DashboardOrderRow[]
): Promise<number> {
  const eligible = orders.filter(isRevenueOrder);
  if (eligible.length === 0) return 0;

  const costMap = await resolveOrderCostPrices(
    eligible.map((o) => ({
      option_id: o.option_id,
      product_id: o.product_id,
    }))
  );

  let profit = 0;
  eligible.forEach((order, index) => {
    const margin = orderMargin(order, costMap.get(index));
    if (margin != null) profit += margin;
  });

  return profit;
}

export async function calcDailyProfits(
  orders: DashboardOrderRow[]
): Promise<Map<string, number>> {
  const eligible = orders.filter(isRevenueOrder);
  if (eligible.length === 0) return new Map();

  const costMap = await resolveOrderCostPrices(
    eligible.map((o) => ({
      option_id: o.option_id,
      product_id: o.product_id,
    }))
  );

  const profitByDate = new Map<string, number>();

  eligible.forEach((order, index) => {
    const margin = orderMargin(order, costMap.get(index));
    if (margin == null) return;
    const date = toKstDate(order.order_date);
    if (!date) return;
    profitByDate.set(date, (profitByDate.get(date) ?? 0) + margin);
  });

  return profitByDate;
}

export function calcChangePct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}
