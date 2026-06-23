import {
  addDaysKst,
  kstWeekdayIndex,
  KST_WEEKDAY_LABELS,
  monthEndKst,
  monthStartKst,
  todayKst,
  toKstDate,
  toKstHour,
  weekStartKst,
  yearStartKst,
} from "./kstDate";
import {
  calcChangePct,
  calcProfitForOrders,
  countRevenueOrders,
  fetchOrdersInKstRange,
  isRevenueOrder,
  orderSalesAmount,
  sumSales,
  type DashboardOrderRow,
} from "./dashboardOrders";
import { resolveOrderCostPrices } from "./orderCost";
import { supabase } from "./supabaseClient";
import type {
  DateFilterGranularity,
  DateFilterValue,
  SalesBarPoint,
  SalesCategorySlice,
  SalesTabData,
  SalesTopProduct,
  SalesWeeklyPoint,
} from "@/types/dashboardSales";

function getPeriodRange(filter: DateFilterValue): {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
} {
  const { granularity, year, month, day } = filter;

  if (granularity === "year") {
    const start = yearStartKst(`${year}-01-01`);
    const end = `${year}-12-31`;
    const prevStart = yearStartKst(`${year - 1}-01-01`);
    const prevEnd = `${year - 1}-12-31`;
    return { start, end, prevStart, prevEnd };
  }

  if (granularity === "month") {
    const start = monthStartKst(`${year}-${String(month).padStart(2, "0")}-01`);
    const end = monthEndKst(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = monthStartKst(
      `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
    );
    const prevEnd = monthEndKst(prevYear, prevMonth);
    return { start, end, prevStart, prevEnd };
  }

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const prev = addDaysKst(dateStr, -1);
  return { start: dateStr, end: dateStr, prevStart: prev, prevEnd: prev };
}

function buildTrendForPeriod(
  orders: DashboardOrderRow[],
  start: string,
  end: string,
  granularity: DateFilterGranularity
): SalesBarPoint[] {
  if (granularity === "year") {
    const points: SalesBarPoint[] = [];
    const [startY, startM] = start.split("-").map(Number);
    const [endY, endM] = end.split("-").map(Number);
    let year = startY!;
    let month = startM!;

    while (year < endY! || (year === endY && month <= endM!)) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const monthStart = monthStartKst(`${key}-01`);
      const monthEnd = monthEndKst(year, month);
      const rangeStart = monthStart < start ? start : monthStart;
      const rangeEnd = monthEnd > end ? end : monthEnd;
      const monthOrders = orders.filter((o) => {
        const d = toKstDate(o.order_date);
        return d >= rangeStart && d <= rangeEnd;
      });
      points.push({
        key,
        label: `${month}월`,
        sales: sumSales(monthOrders),
      });

      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return points;
  }

  if (granularity === "month") {
    const points: SalesBarPoint[] = [];
    let cursor = start;
    while (cursor <= end) {
      const dayOrders = orders.filter(
        (o) => toKstDate(o.order_date) === cursor
      );
      const [, m, d] = cursor.split("-");
      const label =
        start.slice(0, 7) === end.slice(0, 7)
          ? `${Number(d)}일`
          : `${Number(m)}/${Number(d)}`;
      points.push({
        key: cursor,
        label,
        sales: sumSales(dayOrders),
      });
      cursor = addDaysKst(cursor, 1);
    }
    return points;
  }

  const hourMap = new Map<number, number>();
  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    const d = toKstDate(order.order_date);
    if (d < start || d > end) continue;
    const h = toKstHour(order.order_date);
    if (h < 0) continue;
    hourMap.set(h, (hourMap.get(h) ?? 0) + orderSalesAmount(order));
  }

  const points: SalesBarPoint[] = [];
  for (let h = 0; h < 24; h++) {
    points.push({
      key: String(h),
      label: `${h}시`,
      sales: hourMap.get(h) ?? 0,
    });
  }
  return points;
}

function buildTrend(
  orders: DashboardOrderRow[],
  filter: DateFilterValue
): SalesBarPoint[] {
  const { granularity, year, month, day } = filter;

  if (granularity === "year") {
    const points: SalesBarPoint[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const start = monthStartKst(`${key}-01`);
      const end = monthEndKst(year, m);
      const monthOrders = orders.filter((o) => {
        const d = toKstDate(o.order_date);
        return d >= start && d <= end;
      });
      points.push({
        key,
        label: `${m}월`,
        sales: sumSales(monthOrders),
      });
    }
    return points;
  }

  if (granularity === "month") {
    const end = monthEndKst(year, month);
    const start = monthStartKst(
      `${year}-${String(month).padStart(2, "0")}-01`
    );
    const points: SalesBarPoint[] = [];
    let cursor = start;
    while (cursor <= end) {
      const dayOrders = orders.filter(
        (o) => toKstDate(o.order_date) === cursor
      );
      const [, , d] = cursor.split("-");
      points.push({
        key: cursor,
        label: `${Number(d)}일`,
        sales: sumSales(dayOrders),
      });
      cursor = addDaysKst(cursor, 1);
    }
    return points;
  }

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const hourMap = new Map<number, number>();
  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    if (toKstDate(order.order_date) !== dateStr) continue;
    const h = toKstHour(order.order_date);
    if (h < 0) continue;
    hourMap.set(h, (hourMap.get(h) ?? 0) + orderSalesAmount(order));
  }

  const points: SalesBarPoint[] = [];
  for (let h = 0; h < 24; h++) {
    points.push({
      key: String(h),
      label: `${h}시`,
      sales: hourMap.get(h) ?? 0,
    });
  }
  return points;
}

export async function buildTopProducts(
  orders: DashboardOrderRow[]
): Promise<SalesTopProduct[]> {
  const revenueOrders = orders.filter(isRevenueOrder);
  const productIds = [
    ...new Set(
      revenueOrders
        .map((o) => o.product_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const nameMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data } = await supabase
      .from("botong_products")
      .select("id, product_name")
      .in("id", productIds);
    for (const row of data ?? []) {
      nameMap.set(String(row.id), String(row.product_name ?? "—"));
    }
  }

  const agg = new Map<
    string,
    {
      productName: string;
      orderCount: number;
      totalSales: number;
      orders: DashboardOrderRow[];
    }
  >();

  for (const order of revenueOrders) {
    const key = order.product_id ?? order.product_name;
    const productName =
      (order.product_id && nameMap.get(order.product_id)) ||
      order.product_name ||
      "—";
    const sales = orderSalesAmount(order);
    const existing = agg.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSales += sales;
      existing.orders.push(order);
    } else {
      agg.set(key, {
        productName,
        orderCount: 1,
        totalSales: sales,
        orders: [order],
      });
    }
  }

  const topItems = [...agg.values()]
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, 5);

  const allOrders = topItems.flatMap((item) => item.orders);
  const costMap = await resolveOrderCostPrices(
    allOrders.map((o) => ({
      option_id: o.option_id,
      product_id: o.product_id,
    }))
  );

  let costIndex = 0;
  return topItems.map((item, i) => {
    let totalProfit = 0;
    for (const order of item.orders) {
      const cost = costMap.get(costIndex);
      costIndex += 1;
      if (cost == null) continue;
      totalProfit += orderSalesAmount(order) - cost * order.quantity;
    }
    return {
      rank: i + 1,
      productName: item.productName,
      orderCount: item.orderCount,
      totalSales: item.totalSales,
      totalProfit,
    };
  });
}

export async function buildCategories(
  orders: DashboardOrderRow[]
): Promise<SalesCategorySlice[]> {
  const revenueOrders = orders.filter(isRevenueOrder);
  const productIds = [
    ...new Set(
      revenueOrders
        .map((o) => o.product_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const categoryMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data } = await supabase
      .from("botong_products")
      .select("id, category")
      .in("id", productIds);
    for (const row of data ?? []) {
      const cat = String(row.category ?? "").trim();
      categoryMap.set(String(row.id), cat || "기타");
    }
  }

  const salesByCategory = new Map<string, number>();
  let total = 0;

  for (const order of revenueOrders) {
    const category =
      (order.product_id && categoryMap.get(order.product_id)) || "기타";
    const sales = orderSalesAmount(order);
    salesByCategory.set(category, (salesByCategory.get(category) ?? 0) + sales);
    total += sales;
  }

  return [...salesByCategory.entries()]
    .map(([category, sales]) => ({
      category,
      sales,
      pct: total > 0 ? (sales / total) * 100 : 0,
    }))
    .sort((a, b) => b.sales - a.sales);
}

export function buildLast6MonthsSales(
  orders: DashboardOrderRow[],
  today: string
): SalesBarPoint[] {
  return buildLastNMonthsSales(orders, today, 6);
}

export function buildLast12MonthsSales(
  orders: DashboardOrderRow[],
  today: string
): SalesBarPoint[] {
  return buildLastNMonthsSales(orders, today, 12);
}

function buildLastNMonthsSales(
  orders: DashboardOrderRow[],
  today: string,
  n: number
): SalesBarPoint[] {
  const [y, m] = today.split("-").map(Number);
  const points: SalesBarPoint[] = [];

  for (let offset = n - 1; offset >= 0; offset--) {
    let year = y!;
    let month = m! - offset;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const start = monthStartKst(`${key}-01`);
    const end = monthEndKst(year, month);
    const monthOrders = orders.filter((o) => {
      const d = toKstDate(o.order_date);
      return d >= start && d <= end;
    });
    points.push({
      key,
      label: `${month}월`,
      sales: sumSales(monthOrders),
    });
  }

  return points;
}

export function buildWeekly(orders: DashboardOrderRow[]): SalesWeeklyPoint[] {
  const today = todayKst();
  const weekStart = weekStartKst(today);
  const weekEnd = addDaysKst(weekStart, 6);

  const weekOrders = orders.filter((o) => {
    const d = toKstDate(o.order_date);
    return d >= weekStart && d <= weekEnd;
  });

  const byDay: SalesWeeklyPoint[] = KST_WEEKDAY_LABELS.map((weekday) => ({
    weekday,
    orderCount: 0,
    sales: 0,
  }));

  for (const order of weekOrders) {
    const d = toKstDate(order.order_date);
    const idx = kstWeekdayIndex(d);
    if (idx < 0 || idx > 6) continue;
    if (isRevenueOrder(order)) {
      byDay[idx]!.orderCount += 1;
      byDay[idx]!.sales += orderSalesAmount(order);
    }
  }

  return byDay;
}

export function defaultDateFilter(): DateFilterValue {
  const today = todayKst();
  const [y, m, d] = today.split("-").map(Number);
  return {
    granularity: "month",
    year: y!,
    month: m!,
    day: d!,
  };
}

export async function getSalesTabData(
  filter: DateFilterValue
): Promise<SalesTabData> {
  const { start, end, prevStart, prevEnd } = getPeriodRange(filter);

  const [currentOrders, prevOrders, weekOrders] = await Promise.all([
    fetchOrdersInKstRange(start, end),
    fetchOrdersInKstRange(prevStart, prevEnd),
    fetchOrdersInKstRange(weekStartKst(todayKst()), addDaysKst(weekStartKst(todayKst()), 6)),
  ]);

  const totalSales = sumSales(currentOrders);
  const prevSales = sumSales(prevOrders);
  const orderCount = countRevenueOrders(currentOrders);
  const prevOrderCount = countRevenueOrders(prevOrders);
  const avgOrderAmount = orderCount > 0 ? totalSales / orderCount : 0;
  const prevAvg =
    prevOrderCount > 0 ? prevSales / prevOrderCount : 0;

  const [totalProfit, prevProfit, topProducts, categories] = await Promise.all([
    calcProfitForOrders(currentOrders),
    calcProfitForOrders(prevOrders),
    buildTopProducts(currentOrders),
    buildCategories(currentOrders),
  ]);

  return {
    kpi: {
      totalSales,
      totalProfit,
      orderCount,
      avgOrderAmount,
      salesChangePct: calcChangePct(totalSales, prevSales),
      profitChangePct: calcChangePct(totalProfit, prevProfit),
      orderCountChangePct: calcChangePct(orderCount, prevOrderCount),
      avgOrderChangePct: calcChangePct(avgOrderAmount, prevAvg),
    },
    trend: buildTrend(currentOrders, filter),
    topProducts,
    categories,
    weekly: buildWeekly(weekOrders),
  };
}

export function countDistinctProducts(orders: DashboardOrderRow[]): number {
  const keys = new Set<string>();
  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    keys.add(order.product_id ?? order.product_name);
  }
  return keys.size;
}

/** 기본홈 차트 기본값: 월(연도 내 월별) + 올해 */
export function defaultHomeChartFilter(): DateFilterValue {
  const today = todayKst();
  const [y, m, d] = today.split("-").map(Number);
  return {
    granularity: "month",
    year: y!,
    month: m!,
    day: d!,
  };
}

async function fetchOrderDateBounds(): Promise<{ start: string; end: string }> {
  const [minResult, maxResult] = await Promise.all([
    supabase
      .from("botong_orders")
      .select("order_date")
      .order("order_date", { ascending: true })
      .limit(1),
    supabase
      .from("botong_orders")
      .select("order_date")
      .order("order_date", { ascending: false })
      .limit(1),
  ]);

  const minIso = minResult.data?.[0]?.order_date;
  const maxIso = maxResult.data?.[0]?.order_date;

  if (!minIso || !maxIso) {
    const today = todayKst();
    return { start: yearStartKst(today), end: today };
  }

  const minYear = toKstDate(String(minIso)).slice(0, 4);
  const maxYear = toKstDate(String(maxIso)).slice(0, 4);
  return {
    start: `${minYear}-01-01`,
    end: monthEndKst(Number(maxYear), 12),
  };
}

function buildYearlySales(orders: DashboardOrderRow[]): SalesBarPoint[] {
  const byYear = new Map<number, number>();

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    const date = toKstDate(order.order_date);
    if (!date) continue;
    const year = Number(date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + orderSalesAmount(order));
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, sales]) => ({
      key: String(year),
      label: `${year}년`,
      sales,
    }));
}

function buildMonthlySalesForYear(
  orders: DashboardOrderRow[],
  year: number
): SalesBarPoint[] {
  const points: SalesBarPoint[] = [];

  for (let m = 1; m <= 12; m++) {
    const start = monthStartKst(`${year}-${String(m).padStart(2, "0")}-01`);
    const end = monthEndKst(year, m);
    const monthOrders = orders.filter((o) => {
      const d = toKstDate(o.order_date);
      return d >= start && d <= end;
    });
    points.push({
      key: `${year}-${String(m).padStart(2, "0")}`,
      label: `${m}월`,
      sales: sumSales(monthOrders),
    });
  }

  return points;
}

function buildDailySalesForMonth(
  orders: DashboardOrderRow[],
  year: number,
  month: number
): SalesBarPoint[] {
  const start = monthStartKst(`${year}-${String(month).padStart(2, "0")}-01`);
  const end = monthEndKst(year, month);
  const points: SalesBarPoint[] = [];
  let cursor = start;

  while (cursor <= end) {
    const dayOrders = orders.filter((o) => toKstDate(o.order_date) === cursor);
    const [, , d] = cursor.split("-");
    points.push({
      key: cursor,
      label: `${Number(d)}일`,
      sales: sumSales(dayOrders),
    });
    cursor = addDaysKst(cursor, 1);
  }

  return points;
}

async function homeChartFetchRange(
  filter: DateFilterValue
): Promise<{ start: string; end: string }> {
  const { granularity, year, month } = filter;

  if (granularity === "year") {
    return fetchOrderDateBounds();
  }

  if (granularity === "month") {
    return {
      start: yearStartKst(`${year}-01-01`),
      end: monthEndKst(year, 12),
    };
  }

  const start = monthStartKst(`${year}-${String(month).padStart(2, "0")}-01`);
  const end = monthEndKst(year, month);
  return { start, end };
}

export async function getHomeTrendData(
  filter: DateFilterValue
): Promise<SalesBarPoint[]> {
  const { start, end } = await homeChartFetchRange(filter);
  const orders = await fetchOrdersInKstRange(start, end);

  if (filter.granularity === "year") {
    return buildYearlySales(orders);
  }

  if (filter.granularity === "month") {
    return buildMonthlySalesForYear(orders, filter.year);
  }

  return buildDailySalesForMonth(orders, filter.year, filter.month);
}

export function formatHomeChartSubtitle(filter: DateFilterValue): string {
  if (filter.granularity === "year") return "연도별";
  if (filter.granularity === "month") return `${filter.year}년`;
  return `${filter.year}년 ${filter.month}월`;
}

export function homeChartTitle(filter: DateFilterValue): string {
  if (filter.granularity === "year") return "연도별 매출 추이";
  if (filter.granularity === "month") return "월별 매출 추이";
  return "일별 매출 추이";
}
