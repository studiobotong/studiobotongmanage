/**
 * BTM 대시보드 데이터 함수
 * btm_settlements 기반으로 KPI 계산
 * lib/dashboard.ts의 getDashboardHomeData()를 대체
 */

import { btmSupabase } from "./btmSupabaseClient";
import {
  formatHomePeriodLabel,
  previousPeriodRange,
  resolveHomePeriodRange,
} from "./homePeriod";
import { calcChangePct } from "./dashboardOrders";
import type { DashboardHomeData, HomePeriodFilter } from "@/types/dashboard";
import type { SalesBarPoint, SalesTopProduct } from "@/types/dashboardSales";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── 정산 데이터 조회 ───────────────────────────────────────────────

interface SettlementRow {
  settlement_date: string;
  base_amount: number;
  fee_total: number;
  benefit_settlement: number;
  settlement_amount: number;
}

async function fetchSettlementsInRange(
  from: string,
  to: string
): Promise<SettlementRow[]> {
  const { data, error } = await btmSupabase
    .from("btm_settlements")
    .select("settlement_date, base_amount, fee_total, benefit_settlement, settlement_amount")
    .gte("settlement_date", from)
    .lte("settlement_date", to)
    .order("settlement_date", { ascending: true });

  if (error) {
    console.error("[btmDashboard] 정산 조회 오류:", error.message);
    return [];
  }
  return (data ?? []) as SettlementRow[];
}

// ── KPI 계산 ─────────────────────────────────────────────────────

function calcKpiFromSettlements(rows: SettlementRow[]) {
  const periodSales = rows.reduce((s, r) => s + toNum(r.base_amount), 0);
  const feeTotal = rows.reduce((s, r) => s + toNum(r.fee_total), 0);
  const benefitTotal = rows.reduce((s, r) => s + toNum(r.benefit_settlement), 0);
  // 순이익 = 정산기준금액 + 수수료(음수) + 혜택정산(음수)
  const periodProfit = periodSales + feeTotal + benefitTotal;
  // 정산일 수를 주문수로 근사 (나중에 API로 교체)
  const orderCount = rows.length;
  const avgOrderAmount = orderCount > 0 ? periodSales / orderCount : 0;

  return { periodSales, periodProfit, orderCount, avgOrderAmount };
}

// ── 매출 추이 차트 데이터 ────────────────────────────────────────

/** 연별 차트: X축 = 연도 */
async function getYearlyTrend(): Promise<SalesBarPoint[]> {
  const { data, error } = await btmSupabase
    .from("btm_settlements")
    .select("settlement_date, base_amount");

  if (error || !data) return [];

  const yearMap = new Map<string, number>();
  for (const row of data) {
    const year = String(row.settlement_date).slice(0, 4);
    yearMap.set(year, (yearMap.get(year) ?? 0) + toNum(row.base_amount));
  }

  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, sales]) => ({
      key: year,
      label: `${year}년`,
      sales,
    }));
}

/** 월별 차트: X축 = 1~12월 (특정 연도) */
async function getMonthlyTrend(year: number): Promise<SalesBarPoint[]> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const rows = await fetchSettlementsInRange(from, to);

  const monthMap: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) monthMap[m] = 0;

  for (const row of rows) {
    const month = parseInt(String(row.settlement_date).slice(5, 7));
    monthMap[month] = (monthMap[month] ?? 0) + toNum(row.base_amount);
  }

  return Object.entries(monthMap).map(([month, sales]) => ({
    key: `${year}-${String(month).padStart(2, "0")}`,
    label: `${month}월`,
    sales,
  }));
}

/** 일별 차트: X축 = 1~말일 (특정 연월) */
async function getDailyTrend(year: number, month: number): Promise<SalesBarPoint[]> {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;
  const rows = await fetchSettlementsInRange(from, to);

  const dayMap = new Map<string, number>();
  for (const row of rows) {
    const date = String(row.settlement_date).slice(0, 10);
    dayMap.set(date, (dayMap.get(date) ?? 0) + toNum(row.base_amount));
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sales]) => ({
      key: date,
      label: `${parseInt(date.slice(8))}일`,
      sales,
    }));
}

export async function getBTMTrendData(filter: {
  granularity: "year" | "month" | "day";
  year: number;
  month: number;
  day: number;
}): Promise<SalesBarPoint[]> {
  if (filter.granularity === "year") return getYearlyTrend();
  if (filter.granularity === "month") return getMonthlyTrend(filter.year);
  return getDailyTrend(filter.year, filter.month);
}

// ── Top 5 상품 (정산 기반으로는 불가 → 빈 배열 반환, 나중에 API로) ──

async function getTopProducts(): Promise<SalesTopProduct[]> {
  // btm_settlements는 상품별 데이터가 없음
  // 나중에 btm_orders_raw(API 연동 후) 기반으로 교체
  return [];
}

// ── 메인 함수: getDashboardHomeData 대체 ─────────────────────────

export async function getBTMDashboardHomeData(
  period: HomePeriodFilter
): Promise<DashboardHomeData> {
  const { start, end } = resolveHomePeriodRange(period);
  const prev = previousPeriodRange(start, end);

  const [currentRows, prevRows, topProducts] = await Promise.all([
    fetchSettlementsInRange(start, end),
    fetchSettlementsInRange(prev.start, prev.end),
    getTopProducts(),
  ]);

  const current = calcKpiFromSettlements(currentRows);
  const previous = calcKpiFromSettlements(prevRows);

  return {
    periodLabel: formatHomePeriodLabel(period),
    kpi: {
      periodSales: current.periodSales,
      periodSalesChangePct: calcChangePct(current.periodSales, previous.periodSales),
      periodProfit: current.periodProfit,
      periodProfitChangePct: calcChangePct(current.periodProfit, previous.periodProfit),
      orderCount: current.orderCount,
      orderCountChangePct: calcChangePct(current.orderCount, previous.orderCount),
      productCount: 0,         // 추후 API 연동 후 교체
      productCountDelta: 0,
      avgOrderAmount: current.avgOrderAmount,
      avgOrderChangePct: calcChangePct(current.avgOrderAmount, previous.avgOrderAmount),
      adSpend: 0,              // 추후 btm_ad_reports 연동 후 교체
      adSpendChangePct: null,
      reorderProductCount: 0,  // 추후 btm_product_options 연동 후 교체
    },
    topProducts,
  };
}
