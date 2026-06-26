/**
 * BTM (BoTong Manage) 데이터 조회 함수
 * 새 Supabase(btm_) 테이블에서 데이터를 가져옵니다.
 */

import { btmSupabase } from "./btmSupabaseClient";
import type {
  BTMOrder,
  BTMProduct,
  BTMProductOption,
  BTMAdReport,
  BTMOrderSummary,
  BTMAdSummary,
} from "@/types/btm";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── 주문 관련 ──────────────────────────────────────────────────────

/**
 * 기간별 주문 조회 (구매확정일 기준, KST)
 * Supabase 1000건 제한 우회 처리 포함
 */
export async function getBTMOrders(
  from: string,
  to: string,
  status?: string
): Promise<BTMOrder[]> {
  let allData: BTMOrder[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = btmSupabase
      .from("btm_orders_raw")
      .select("*")
      .gte("confirm_date", `${from}T00:00:00+09:00`)
      .lte("confirm_date", `${to}T23:59:59+09:00`)
      .order("confirm_date", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`[btmData] 주문 조회 오류: ${error.message}`);
    if (!data || data.length === 0) break;
    allData = [...allData, ...(data as BTMOrder[])];
    if (data.length < pageSize) break;
    page++;
  }

  return allData;
}

/**
 * 주문 요약 통계 (대시보드 KPI용)
 */
export async function getBTMOrderSummary(
  from: string,
  to: string
): Promise<BTMOrderSummary> {
  const orders = await getBTMOrders(from, to);
  const totalRevenue = orders.reduce((sum, o) => sum + toNum(o.actual_payment), 0);
  const totalOrders = orders.length;
  const totalQuantity = orders.reduce((sum, o) => sum + toNum(o.quantity), 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  return { totalRevenue, totalOrders, totalQuantity, avgOrderValue };
}

/**
 * 월별 매출 집계 (연간 바 차트용)
 */
export async function getBTMMonthlyRevenue(
  year: number
): Promise<{ month: number; revenue: number }[]> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const orders = await getBTMOrders(from, to);

  const monthly: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) monthly[m] = 0;

  orders.forEach((o) => {
    if (o.confirm_date) {
      const month = new Date(o.confirm_date).getMonth() + 1;
      monthly[month] = (monthly[month] ?? 0) + toNum(o.actual_payment);
    }
  });

  return Object.entries(monthly).map(([month, revenue]) => ({
    month: parseInt(month),
    revenue,
  }));
}

// ── 상품/옵션 관련 ──────────────────────────────────────────────────

/**
 * 전체 상품 목록
 */
export async function getBTMProducts(): Promise<BTMProduct[]> {
  const { data, error } = await btmSupabase
    .from("btm_products")
    .select("*")
    .eq("status", "active")
    .order("product_name");

  if (error) throw new Error(`[btmData] 상품 조회 오류: ${error.message}`);
  return (data ?? []) as BTMProduct[];
}

/**
 * 옵션 목록 (상품 ID로 필터 가능)
 */
export async function getBTMProductOptions(
  productId?: string
): Promise<BTMProductOption[]> {
  let query = btmSupabase
    .from("btm_product_options")
    .select("*")
    .eq("is_active", true)
    .order("option_code");

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`[btmData] 옵션 조회 오류: ${error.message}`);
  return (data ?? []) as BTMProductOption[];
}

// ── 광고 관련 ──────────────────────────────────────────────────────

/**
 * 기간별 광고 성과 조회
 */
export async function getBTMAdReports(
  from: string,
  to: string,
  channel?: "meta" | "naver"
): Promise<BTMAdReport[]> {
  let query = btmSupabase
    .from("btm_ad_reports")
    .select("*")
    .gte("report_date", from)
    .lte("report_date", to)
    .order("report_date", { ascending: false });

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { data, error } = await query;
  if (error) throw new Error(`[btmData] 광고 조회 오류: ${error.message}`);
  return (data ?? []) as BTMAdReport[];
}

/**
 * 광고 요약 (ROAS, CTR 등)
 */
export async function getBTMAdSummary(
  from: string,
  to: string
): Promise<BTMAdSummary> {
  const reports = await getBTMAdReports(from, to);
  const totalSpend = reports.reduce((sum, r) => sum + toNum(r.spend), 0);
  const totalRevenue = reports.reduce((sum, r) => sum + toNum(r.conversion_value), 0);
  const totalClicks = reports.reduce((sum, r) => sum + toNum(r.clicks), 0);
  const totalImpressions = reports.reduce((sum, r) => sum + toNum(r.impressions), 0);
  const roas = totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) : 0;
  const ctr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : "0";
  return { totalSpend, totalRevenue, roas, totalClicks, totalImpressions, ctr };
}

// ── 연결 테스트 ────────────────────────────────────────────────────

/**
 * BTM Supabase 연결 확인 (개발 디버그용)
 */
export async function checkBTMConnection(): Promise<boolean> {
  try {
    const { error } = await btmSupabase
      .from("btm_settings")
      .select("key")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}
