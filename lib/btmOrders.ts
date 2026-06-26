/**
 * BTM 주문 처리 함수
 * 네이버 스마트스토어 엑셀 → btm_orders_raw 저장
 */

import { btmSupabase } from "./btmSupabaseClient";
import type { ParsedOrderRow } from "@/types/orders";

// ── 업로드 결과 타입 ─────────────────────────────────────────────

export interface BTMOrderUploadResult {
  inserted: number;
  skipped: number;
  totalRows: number;
  elapsedMs: number;
  errors: string[];
  parseWarnings?: string[];
}

// ── 헬퍼 ────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ── 옵션코드로 btm_product_options 매칭 ────────────────────────

interface BTMOptionMatch {
  id: number;
  product_id: string;
  option_code: string;
}

async function findBTMOptionByCode(
  optionCode: string
): Promise<BTMOptionMatch | null> {
  if (!optionCode?.trim()) return null;

  const { data, error } = await btmSupabase
    .from("btm_product_options")
    .select("id, product_id, option_code")
    .eq("option_code", optionCode.trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as BTMOptionMatch;
}

// ── ParsedOrderRow → btm_orders_raw 페이로드 변환 ──────────────

function buildBTMOrderPayload(
  row: ParsedOrderRow,
  optionCode: string | null
) {
  return {
    // 고유키: 상품주문번호
    order_id: row.product_order_no,
    product_order_id: row.order_no || null,

    // 날짜
    order_date: row.order_date,
    payment_date: null,
    // 구매확정 엑셀이면 order_date를 confirm_date로 근사 처리
    confirm_date: null,

    // 상태
    status: row.order_status || null,

    // 상품 정보
    product_id: row.naver_product_no || null,
    product_name: row.product_name || null,
    option_code: optionCode,
    option_name: row.option_name || null,

    // 수량/금액
    quantity: toNum(row.quantity),
    unit_price: toNum(row.product_price),
    total_price: toNum(row.total_order_amount),
    discount_amount: 0,
    actual_payment: toNum(row.settlement_amount),

    // 구매자 정보
    buyer_name: row.buyer_id_masked || null,
    receiver_name: null,
    receiver_phone: null,
    receiver_address: null,
    delivery_company: null,
    tracking_number: null,

    // 채널
    channel: row.channel || "naver",

    // 원본 데이터
    raw_data: row.raw_row,
    collected_at: new Date().toISOString(),
  };
}

// ── 메인 업로드 함수 ─────────────────────────────────────────────

export async function processBTMOrderUpload(
  rows: ParsedOrderRow[],
  options: { format?: string | null } = {}
): Promise<BTMOrderUploadResult> {
  const started = Date.now();
  const result: BTMOrderUploadResult = {
    inserted: 0,
    skipped: 0,
    totalRows: rows.length,
    elapsedMs: 0,
    errors: [],
  };

  const seenInBatch = new Set<string>();

  for (const row of rows) {
    // 배치 내 중복 건너뜀
    if (seenInBatch.has(row.product_order_no)) {
      result.skipped += 1;
      continue;
    }
    seenInBatch.add(row.product_order_no);

    // DB 중복 확인
    const { data: existing, error: existingError } = await btmSupabase
      .from("btm_orders_raw")
      .select("id")
      .eq("order_id", row.product_order_no)
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

    // 옵션관리코드로 btm_product_options 매칭
    let optionCode: string | null = row.option_sku_code || null;

    // option_sku_code가 있으면 btm_product_options에서 확인
    if (row.option_sku_code?.trim()) {
      const matched = await findBTMOptionByCode(row.option_sku_code);
      if (matched) {
        optionCode = matched.option_code;
      }
    }

    // 구매확정 포맷이면 confirm_date 설정
    const payload = buildBTMOrderPayload(row, optionCode);
    if (options.format === "purchase_confirmation" && row.order_date) {
      (payload as Record<string, unknown>).confirm_date = row.order_date;
    }

    // 삽입
    const { error: insertError } = await btmSupabase
      .from("btm_orders_raw")
      .insert(payload);

    if (insertError) {
      result.errors.push(
        `${row.product_order_no}: 저장 실패 — ${insertError.message}`
      );
      continue;
    }

    result.inserted += 1;
  }

  result.elapsedMs = Date.now() - started;
  return result;
}

// ── 주문 목록 조회 (btm_orders_raw) ──────────────────────────────

export interface BTMOrderRow {
  id: number;
  order_id: string;
  product_order_id: string | null;
  order_date: string | null;
  status: string | null;
  product_name: string | null;
  option_code: string | null;
  option_name: string | null;
  quantity: number;
  unit_price: number;
  actual_payment: number;
  buyer_name: string | null;
  receiver_name: string | null;
  delivery_company: string | null;
  tracking_number: string | null;
  channel: string;
  collected_at: string;
}

export interface BTMOrderListFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface BTMOrderListResult {
  orders: BTMOrderRow[];
  totalCount: number;
  totalPayment: number;
  statusCounts: Record<string, number>;
}

export async function getBTMOrderList(
  filters: BTMOrderListFilters = {}
): Promise<BTMOrderListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let baseQuery = btmSupabase.from("btm_orders_raw").select(
    "id, order_id, product_order_id, order_date, status, product_name, option_code, option_name, quantity, unit_price, actual_payment, buyer_name, receiver_name, delivery_company, tracking_number, channel, collected_at"
  );
  let countQuery = btmSupabase.from("btm_orders_raw").select("id", { count: "exact", head: true });
  let sumQuery = btmSupabase.from("btm_orders_raw").select("actual_payment");
  let statusQuery = btmSupabase.from("btm_orders_raw").select("status");

  if (filters.dateFrom) {
    baseQuery = baseQuery.gte("order_date", `${filters.dateFrom}T00:00:00+09:00`);
    countQuery = countQuery.gte("order_date", `${filters.dateFrom}T00:00:00+09:00`);
    sumQuery = sumQuery.gte("order_date", `${filters.dateFrom}T00:00:00+09:00`);
    statusQuery = statusQuery.gte("order_date", `${filters.dateFrom}T00:00:00+09:00`);
  }
  if (filters.dateTo) {
    baseQuery = baseQuery.lte("order_date", `${filters.dateTo}T23:59:59+09:00`);
    countQuery = countQuery.lte("order_date", `${filters.dateTo}T23:59:59+09:00`);
    sumQuery = sumQuery.lte("order_date", `${filters.dateTo}T23:59:59+09:00`);
    statusQuery = statusQuery.lte("order_date", `${filters.dateTo}T23:59:59+09:00`);
  }
  if (filters.status) {
    baseQuery = baseQuery.eq("status", filters.status);
    countQuery = countQuery.eq("status", filters.status);
    sumQuery = sumQuery.eq("status", filters.status);
  }
  if (filters.search?.trim()) {
    baseQuery = baseQuery.ilike("product_name", `%${filters.search.trim()}%`);
    countQuery = countQuery.ilike("product_name", `%${filters.search.trim()}%`);
    sumQuery = sumQuery.ilike("product_name", `%${filters.search.trim()}%`);
  }

  const [listResult, countResult, sumResult, statusResult] = await Promise.all([
    baseQuery.order("order_date", { ascending: false }).range(from, to),
    countQuery,
    sumQuery,
    statusQuery,
  ]);

  const orders = (listResult.data ?? []) as BTMOrderRow[];
  const totalCount = countResult.count ?? 0;
  const totalPayment = ((sumResult.data ?? []) as { actual_payment: number }[])
    .reduce((s, r) => s + (r.actual_payment ?? 0), 0);

  const statusCounts: Record<string, number> = {};
  for (const row of (statusResult.data ?? [])) {
    const s = String(row.status ?? "").trim();
    if (s) statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  return { orders, totalCount, totalPayment, statusCounts };
}

export async function getBTMDistinctStatuses(): Promise<string[]> {
  const { data } = await btmSupabase.from("btm_orders_raw").select("status");
  const statuses = new Set<string>();
  for (const row of data ?? []) {
    const s = String(row.status ?? "").trim();
    if (s) statuses.add(s);
  }
  return Array.from(statuses).sort();
}

export async function deleteBTMOrder(id: number): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await btmSupabase.from("btm_orders_raw").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}
