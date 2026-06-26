import {
  addDaysKst,
  monthEndKst,
  monthStartKst,
  todayKst,
  toKstDate,
  weekStartKst,
} from "./kstDate";
import {
  formatHomePeriodLabel,
  previousPeriodRange,
  resolveHomePeriodRange,
} from "./homePeriod";
import {
  calcChangePct,
  calcProfitForOrders,
  countRevenueOrders,
  fetchOrdersInKstRange,
  sumSales,
} from "./dashboardOrders";
import { sumAdSpendInRange } from "./adReports";
import {
  buildCategories,
  buildTopProducts,
  buildWeekly,
  countDistinctProducts,
} from "./dashboardSales";
import { supabase } from "./supabaseClient";
import { getBTMDashboardHomeData } from "./btmDashboard";
import type { DashboardData, DashboardHomeData, HomePeriodFilter } from "@/types/dashboard";

export { isExcludedOrderStatus } from "./dashboardOrders";
export {
  getHomeTrendData,
  buildTopProducts,
  defaultDateFilter,
  defaultHomeChartFilter,
  formatHomeChartSubtitle,
  homeChartTitle,
} from "./dashboardSales";
export {
  defaultHomePeriodFilter,
  resolveHomePeriodRange,
  formatHomePeriodLabel,
  previousPeriodRange,
} from "./homePeriod";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchReorderProductCount(): Promise<number> {
  const { data: options, error: optError } = await supabase
    .from("botong_product_options")
    .select("product_id, stock_qty, safety_stock");

  if (optError) {
    console.error("[dashboard] 옵션 조회 오류:", optError.message);
  }

  const optionRows = options ?? [];

  if (optionRows.length > 0) {
    const productIds = new Set<string>();
    for (const row of optionRows) {
      if (toNum(row.stock_qty) <= toNum(row.safety_stock)) {
        productIds.add(String(row.product_id));
      }
    }
    return productIds.size;
  }

  const { data: products, error: prodError } = await supabase
    .from("botong_products")
    .select("stock_qty, safety_stock");

  if (prodError) {
    console.error("[dashboard] 상품 조회 오류:", prodError.message);
    return 0;
  }

  return (products ?? []).filter(
    (row) => toNum(row.stock_qty) <= toNum(row.safety_stock)
  ).length;
}

function filterOrdersByRange(
  orders: Awaited<ReturnType<typeof fetchOrdersInKstRange>>,
  start: string,
  end: string
) {
  return orders.filter((o) => {
    const d = toKstDate(o.order_date);
    return d >= start && d <= end;
  });
}

export async function getDashboardHomeData(
  period: HomePeriodFilter
): Promise<DashboardHomeData> {
  // BTM 정산 데이터 기반으로 전환 (btm_settlements)
  return getBTMDashboardHomeData(period);
}

function prevMonthRange(today: string): { start: string; end: string } {
  const [y, m] = today.split("-").map(Number);
  const prevMonth = m === 1 ? 12 : m! - 1;
  const prevYear = m === 1 ? y! - 1 : y!;
  const start = monthStartKst(
    `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
  );
  const end = monthEndKst(prevYear, prevMonth);
  return { start, end };
}

/** @deprecated /stats 페이지용 — 기본홈은 getDashboardHomeData 사용 */
export async function getDashboardData(): Promise<DashboardData> {
  const today = todayKst();
  const monthStart = monthStartKst(today);
  const { start: prevStart, end: prevEnd } = prevMonthRange(today);
  const weekStart = weekStartKst(today);
  const weekEnd = addDaysKst(weekStart, 6);

  const fetchStart = [monthStart, prevStart, weekStart].sort()[0]!;
  const fetchEnd = [today, prevEnd, weekEnd].sort().at(-1)!;

  const orders = await fetchOrdersInKstRange(fetchStart, fetchEnd);

  const currentMonthOrders = filterOrdersByRange(orders, monthStart, today);
  const previousMonthOrders = filterOrdersByRange(orders, prevStart, prevEnd);
  const weekOrders = filterOrdersByRange(orders, weekStart, weekEnd);

  const periodSales = sumSales(currentMonthOrders);
  const prevMonthSales = sumSales(previousMonthOrders);
  const orderCount = countRevenueOrders(currentMonthOrders);
  const prevOrderCount = countRevenueOrders(previousMonthOrders);
  const productCount = countDistinctProducts(currentMonthOrders);
  const prevProductCount = countDistinctProducts(previousMonthOrders);
  const avgOrderAmount = orderCount > 0 ? periodSales / orderCount : 0;
  const prevAvg =
    prevOrderCount > 0 ? prevMonthSales / prevOrderCount : 0;

  const [
    topProducts,
    categories,
    reorderProductCount,
    periodProfit,
    prevProfit,
    adSpend,
    prevAdSpend,
  ] = await Promise.all([
    buildTopProducts(currentMonthOrders),
    buildCategories(currentMonthOrders),
    fetchReorderProductCount(),
    calcProfitForOrders(currentMonthOrders),
    calcProfitForOrders(previousMonthOrders),
    sumAdSpendInRange(monthStart, today),
    sumAdSpendInRange(prevStart, prevEnd),
  ]);

  return {
    periodLabel: "이번 달",
    kpi: {
      periodSales,
      periodSalesChangePct: calcChangePct(periodSales, prevMonthSales),
      periodProfit,
      periodProfitChangePct: calcChangePct(periodProfit, prevProfit),
      orderCount,
      orderCountChangePct: calcChangePct(orderCount, prevOrderCount),
      productCount,
      productCountDelta: productCount - prevProductCount,
      avgOrderAmount,
      avgOrderChangePct: calcChangePct(avgOrderAmount, prevAvg),
      adSpend,
      adSpendChangePct: calcChangePct(adSpend, prevAdSpend),
      reorderProductCount,
    },
    topProducts,
    categories,
    weekly: buildWeekly(weekOrders),
  };
}
