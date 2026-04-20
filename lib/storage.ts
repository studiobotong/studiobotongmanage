/**
 * lib/storage.ts
 *
 * Supabase 기반 데이터 접근 레이어.
 * 컴포넌트에서 DB를 직접 사용하는 대신 이 파일의 함수만 사용합니다.
 *
 * Tables:
 *   cashflow                 — 입금/출금/배당 기록
 *   asset_snapshots          — 날짜별 자산 요약
 *   asset_snapshot_holdings  — 날짜별 보유 종목 상태 (현재 holdings 원본)
 *   asset_snapshot_items     — 일별 자동 스냅샷 상세 (크론 /api/snapshot)
 *     (옵션: 컬럼이 없는 구 DB만 NEXT_PUBLIC_INCLUDE_SNAPSHOT_TARGET_WEIGHT_COLUMNS=false)
 */

import { deleteDuplicateCashHoldings, hasCashDuplicateRows } from "./cashHoldingsDedupe";
import { netInvestmentKrwFromCashflowsUpTo, profitAndReturnRateFromTotalAndNet } from "./netInvestment";
import { supabase } from "./supabaseClient";
import type { Cashflow, AssetSnapshot, AssetSnapshotHolding } from "@/types/assets";

function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function toNumOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

// ─────────────────────────────────────────────────────────────
// ID 생성 유틸 (로컬 임시 ID 용)
// ─────────────────────────────────────────────────────────────

/** 목표 비중 컬럼을 Supabase에 포함합니다. 구 스키마 호환용으로만 false. */
function snapshotHoldingIncludesTargetWeightColumns(): boolean {
  return process.env.NEXT_PUBLIC_INCLUDE_SNAPSHOT_TARGET_WEIGHT_COLUMNS !== "false";
}

function targetWeightRowSlice(
  h: Pick<AssetSnapshotHolding, "target_min_weight" | "target_max_weight">
):
  | { target_min_weight: number | null; target_max_weight: number | null }
  | Record<string, never> {
  if (!snapshotHoldingIncludesTargetWeightColumns()) return {};
  return {
    target_min_weight: h.target_min_weight ?? null,
    target_max_weight: h.target_max_weight ?? null,
  };
}

export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────
// Cashflows  →  cashflow 테이블
// ─────────────────────────────────────────────────────────────

export async function getCashflows(): Promise<Cashflow[]> {
  try {
    const { data, error } = await supabase
      .from("cashflow")
      .select("*")
      .order("flow_date", { ascending: false });

    if (error) {
      console.error("[storage] getCashflows 오류:", error.message);
      return [];
    }

    return (data ?? []).map((r) => ({
      id:         String(r.id ?? ""),
      flow_date:  String(r.flow_date ?? ""),
      type:       (r.type as Cashflow["type"]) ?? "DEPOSIT",
      account:    r.account ?? undefined,
      currency:   r.currency ?? undefined,
      amount:     toNum(r.amount),
      memo:       r.memo ?? undefined,
      created_at: String(r.created_at ?? ""),
    }));
  } catch (e) {
    console.error("[storage] getCashflows 예외:", e);
    return [];
  }
}

export async function saveCashflows(data: Cashflow[]): Promise<void> {
  try {
    const { error: delErr } = await supabase.from("cashflow").delete().not("id", "is", null);
    if (delErr) console.error("[storage] saveCashflows delete 오류:", delErr.message);

    if (data.length === 0) return;

    const rows = data
      .filter((cf) => cf != null)
      .map((cf) => ({
        flow_date:  cf.flow_date,
        type:       cf.type,
        account:    cf.account ?? null,
        currency:   cf.currency ?? null,
        amount:     cf.amount,
        memo:       cf.memo ?? null,
        created_at: cf.created_at || new Date().toISOString(),
      }));

    if (rows.length === 0) return;

    const { error } = await supabase.from("cashflow").insert(rows);
    if (error) console.error("[storage] saveCashflows insert 오류:", error.message);
  } catch (e) {
    console.error("[storage] saveCashflows 예외:", e);
  }
}

// ─────────────────────────────────────────────────────────────
// Snapshots  →  asset_snapshots 테이블
// ─────────────────────────────────────────────────────────────

export async function getSnapshots(): Promise<AssetSnapshot[]> {
  try {
    const { data, error } = await supabase
      .from("asset_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: true });

    if (error) {
      console.error("[storage] getSnapshots 오류:", error.message);
      return [];
    }

    return (data ?? []).map((r) => ({
      id:             String(r.id ?? ""),
      snapshot_date:  String(r.snapshot_date ?? ""),
      total_asset:    toNum(r.total_asset),
      stock_asset:    toNumOrUndef(r.stock_asset),
      cash_asset:     toNumOrUndef(r.cash_asset),
      kr_asset:       toNumOrUndef(r.kr_asset),
      us_asset:       toNumOrUndef(r.us_asset),
      net_investment: toNumOrUndef(r.net_investment),
      profit:         toNumOrUndef(r.profit),
      return_rate:    toNumOrUndef(r.return_rate),
      created_at:     String(r.created_at ?? ""),
    }));
  } catch (e) {
    console.error("[storage] getSnapshots 예외:", e);
    return [];
  }
}

/** `snapshot_date` 최신 1행 (없으면 null). 차트용 전체는 `getSnapshots` / `fetchAssetSnapshots` */
export async function getLatestAssetSnapshot(): Promise<AssetSnapshot | null> {
  try {
    const { data, error } = await supabase
      .from("asset_snapshots")
      .select("*")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[storage] getLatestAssetSnapshot 오류:", error.message);
      return null;
    }
    if (!data) return null;

    return {
      id:             String(data.id ?? ""),
      snapshot_date:  String(data.snapshot_date ?? ""),
      total_asset:    toNum(data.total_asset),
      stock_asset:    toNumOrUndef(data.stock_asset),
      cash_asset:     toNumOrUndef(data.cash_asset),
      kr_asset:       toNumOrUndef(data.kr_asset),
      us_asset:       toNumOrUndef(data.us_asset),
      net_investment: toNumOrUndef(data.net_investment),
      profit:         toNumOrUndef(data.profit),
      return_rate:    toNumOrUndef(data.return_rate),
      created_at:     String(data.created_at ?? ""),
    };
  } catch (e) {
    console.error("[storage] getLatestAssetSnapshot 예외:", e);
    return null;
  }
}

export async function saveSnapshots(data: AssetSnapshot[]): Promise<void> {
  try {
    const { error: delErr } = await supabase
      .from("asset_snapshots")
      .delete()
      .not("id", "is", null);
    if (delErr) console.error("[storage] saveSnapshots delete 오류:", delErr.message);

    if (data.length === 0) return;

    const rows = data
      .filter((s) => s != null)
      .map((s) => ({
        snapshot_date:  s.snapshot_date,
        total_asset:    s.total_asset,
        stock_asset:    s.stock_asset ?? null,
        cash_asset:     s.cash_asset ?? null,
        kr_asset:       s.kr_asset ?? null,
        us_asset:       s.us_asset ?? null,
        net_investment: s.net_investment ?? null,
        profit:         s.profit ?? null,
        return_rate:    s.return_rate ?? null,
        created_at:     s.created_at || new Date().toISOString(),
      }));

    if (rows.length === 0) return;

    const { error } = await supabase.from("asset_snapshots").insert(rows);
    if (error) console.error("[storage] saveSnapshots insert 오류:", error.message);
  } catch (e) {
    console.error("[storage] saveSnapshots 예외:", e);
  }
}

/** snapshot_date 기준 upsert */
export async function addSnapshot(item: AssetSnapshot): Promise<AssetSnapshot> {
  try {
    const cashflows = await getCashflows();
    const net =
      item.net_investment != null
        ? item.net_investment
        : netInvestmentKrwFromCashflowsUpTo(cashflows, item.snapshot_date);
    const { profit: p, return_rate: rr } = profitAndReturnRateFromTotalAndNet(
      item.total_asset,
      net
    );

    const row = {
      snapshot_date:  item.snapshot_date,
      total_asset:    item.total_asset,
      stock_asset:    item.stock_asset ?? null,
      cash_asset:     item.cash_asset ?? null,
      kr_asset:       item.kr_asset ?? null,
      us_asset:       item.us_asset ?? null,
      net_investment: net,
      profit:         p,
      return_rate:    rr,
      created_at:     item.created_at || new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("asset_snapshots")
      .upsert(row, { onConflict: "snapshot_date" })
      .select()
      .single();

    if (error) {
      console.error("[storage] addSnapshot upsert 오류:", error.message);
      return item;
    }

    return {
      id:             String(data.id ?? ""),
      snapshot_date:  String(data.snapshot_date ?? ""),
      total_asset:    toNum(data.total_asset),
      stock_asset:    toNumOrUndef(data.stock_asset),
      cash_asset:     toNumOrUndef(data.cash_asset),
      kr_asset:       toNumOrUndef(data.kr_asset),
      us_asset:       toNumOrUndef(data.us_asset),
      net_investment: toNumOrUndef(data.net_investment),
      profit:         toNumOrUndef(data.profit),
      return_rate:    toNumOrUndef(data.return_rate),
      created_at:     String(data.created_at ?? ""),
    };
  } catch (e) {
    console.error("[storage] addSnapshot 예외:", e);
    return item;
  }
}

// ─────────────────────────────────────────────────────────────
// Snapshot Holdings  →  asset_snapshot_holdings 테이블
// ─────────────────────────────────────────────────────────────

async function fetchSnapshotHoldingsFromDb(): Promise<AssetSnapshotHolding[]> {
  const { data, error } = await supabase
    .from("asset_snapshot_holdings")
    .select("*")
    .order("snapshot_date", { ascending: false });

  if (error) {
    console.error("[storage] getSnapshotHoldings 오류:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id:               String(r.id ?? ""),
    snapshot_date:    String(r.snapshot_date ?? ""),
    name:             String(r.name ?? ""),
    symbol:           r.symbol ?? undefined,
    market:           r.market ?? undefined,
    currency:         r.currency ?? undefined,
    account:          r.account ?? undefined,
    quantity:         toNum(r.quantity),
    avg_price:        toNum(r.avg_price),
    current_price:    toNum(r.current_price),
    evaluated_amount: toNum(r.evaluated_amount),
    weight:               toNumOrUndef(r.weight),
    target_min_weight:    toNumOrUndef(r.target_min_weight),
    target_max_weight:    toNumOrUndef(r.target_max_weight),
    asset_type:           r.asset_type ?? undefined,
    created_at:           String(r.created_at ?? ""),
  }));
}

/**
 * 예수금 행이 (기준일·유형·계좌) 기준으로 DB에 중복되면 합계가 배로 잡힙니다.
 * 조회 시 중복을 감지해 1건만 남기고 제거한 뒤 다시 읽습니다.
 */
export async function getSnapshotHoldings(): Promise<AssetSnapshotHolding[]> {
  try {
    const rows = await fetchSnapshotHoldingsFromDb();
    if (!hasCashDuplicateRows(rows)) return rows;

    const removed = await deleteDuplicateCashHoldings(rows);
    if (removed === 0) {
      console.error(
        "[storage] 예수금 중복 행이 감지되었으나 삭제되지 않았습니다. 권한·RLS를 확인하세요."
      );
      return rows;
    }
    console.debug("[storage] 예수금 중복 행 제거:", removed, "건");

    const after = await fetchSnapshotHoldingsFromDb();
    if (hasCashDuplicateRows(after)) {
      console.error("[storage] 예수금 중복 행이 일부만 제거된 것 같습니다.");
    }
    return after;
  } catch (e) {
    console.error("[storage] getSnapshotHoldings 예외:", e);
    return [];
  }
}

export async function saveSnapshotHoldings(data: AssetSnapshotHolding[]): Promise<void> {
  try {
    const { error: delErr } = await supabase
      .from("asset_snapshot_holdings")
      .delete()
      .not("id", "is", null);
    if (delErr)
      console.error("[storage] saveSnapshotHoldings delete 오류:", delErr.message);

    if (data.length === 0) return;

    const rows = data
      .filter((h) => h != null)
      .map((h) => ({
        snapshot_date:    h.snapshot_date,
        name:             h.name,
        symbol:           h.symbol ?? null,
        market:           h.market ?? null,
        currency:         h.currency ?? null,
        account:          h.account ?? null,
        quantity:         h.quantity,
        avg_price:        h.avg_price,
        current_price:    h.current_price,
        evaluated_amount:    h.evaluated_amount,
        weight:              h.weight ?? null,
        ...targetWeightRowSlice(h),
        asset_type:          h.asset_type ?? null,
        created_at:          h.created_at || new Date().toISOString(),
      }));

    if (rows.length === 0) return;

    const { error } = await supabase.from("asset_snapshot_holdings").insert(rows);
    if (error)
      console.error("[storage] saveSnapshotHoldings insert 오류:", error.message);
  } catch (e) {
    console.error("[storage] saveSnapshotHoldings 예외:", e);
  }
}

/**
 * 가장 최신 snapshot_date 의 보유 목록을 반환합니다.
 */
export async function getLatestSnapshotHoldings(): Promise<AssetSnapshotHolding[]> {
  const all = await getSnapshotHoldings();
  if (all.length === 0) return [];
  const latestDate = [...all].sort((a, b) =>
    b.snapshot_date.localeCompare(a.snapshot_date)
  )[0].snapshot_date;
  return all.filter((h) => h.snapshot_date === latestDate);
}

function mapRowToHolding(data: Record<string, unknown>): AssetSnapshotHolding {
  return {
    id:               String(data.id ?? ""),
    snapshot_date:    String(data.snapshot_date ?? ""),
    name:             String(data.name ?? ""),
    symbol:           data.symbol != null ? String(data.symbol) : undefined,
    market:           data.market != null ? String(data.market) : undefined,
    currency:         data.currency != null ? String(data.currency) : undefined,
    account:          data.account != null ? String(data.account) : undefined,
    quantity:         toNum(data.quantity),
    avg_price:        toNum(data.avg_price),
    current_price:    toNum(data.current_price),
    evaluated_amount: toNum(data.evaluated_amount),
    weight:              toNumOrUndef(data.weight),
    target_min_weight:   toNumOrUndef(data.target_min_weight),
    target_max_weight:   toNumOrUndef(data.target_max_weight),
    asset_type:          data.asset_type != null ? String(data.asset_type) : undefined,
    created_at:          String(data.created_at ?? ""),
  };
}

/**
 * 새로운 holding 1건을 insert 합니다.
 */
export async function insertHolding(
  item: Omit<AssetSnapshotHolding, "id" | "created_at">
): Promise<AssetSnapshotHolding> {
  const row = {
    snapshot_date:       item.snapshot_date,
    name:                item.name,
    symbol:              item.symbol ?? null,
    market:              item.market ?? null,
    currency:            item.currency ?? null,
    account:             item.account ?? null,
    quantity:            item.quantity,
    avg_price:           item.avg_price,
    current_price:       item.current_price,
    evaluated_amount:    item.evaluated_amount,
    weight:              item.weight ?? null,
    ...targetWeightRowSlice(item),
    asset_type:          item.asset_type ?? null,
    created_at:          new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("asset_snapshot_holdings")
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error("[storage] insertHolding 오류:", error.message);
    throw new Error(error.message);
  }

  return mapRowToHolding(data as Record<string, unknown>);
}

/**
 * 기존 holding 1건을 업데이트합니다.
 * @returns 업데이트된 행(.select), 갱신 필드가 없으면 null
 */
export async function updateHolding(
  id: string,
  updates: Partial<Omit<AssetSnapshotHolding, "id" | "created_at">>
): Promise<AssetSnapshotHolding | null> {
  const row: Record<string, unknown> = {};
  if (updates.snapshot_date    !== undefined) row.snapshot_date    = updates.snapshot_date;
  if (updates.name             !== undefined) row.name             = updates.name;
  if (updates.symbol           !== undefined) row.symbol           = updates.symbol ?? null;
  if (updates.market           !== undefined) row.market           = updates.market ?? null;
  if (updates.currency         !== undefined) row.currency         = updates.currency ?? null;
  if (updates.account          !== undefined) row.account          = updates.account ?? null;
  if (updates.quantity         !== undefined) row.quantity         = updates.quantity;
  if (updates.avg_price        !== undefined) row.avg_price        = updates.avg_price;
  if (updates.current_price    !== undefined) row.current_price    = updates.current_price;
  if (updates.evaluated_amount !== undefined) row.evaluated_amount = updates.evaluated_amount;
  if (updates.weight              !== undefined) row.weight              = updates.weight ?? null;
  if (snapshotHoldingIncludesTargetWeightColumns()) {
    if (updates.target_min_weight !== undefined)
      row.target_min_weight = updates.target_min_weight ?? null;
    if (updates.target_max_weight !== undefined)
      row.target_max_weight = updates.target_max_weight ?? null;
  }
  if (updates.asset_type          !== undefined) row.asset_type          = updates.asset_type ?? null;

  if (Object.keys(row).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from("asset_snapshot_holdings")
    .update(row)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[storage] updateHolding 오류:", error.message);
    throw new Error(error.message);
  }

  if (!data) return null;
  return mapRowToHolding(data as Record<string, unknown>);
}

/**
 * holding 1건을 삭제합니다.
 */
export async function deleteHolding(id: string): Promise<void> {
  const { error } = await supabase
    .from("asset_snapshot_holdings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[storage] deleteHolding 오류:", error.message);
    throw new Error(error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 전체 초기화
// ─────────────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  try {
    await Promise.all([
      supabase.from("cashflow").delete().not("id", "is", null),
      supabase.from("asset_snapshots").delete().not("id", "is", null),
      supabase.from("asset_snapshot_holdings").delete().not("id", "is", null),
      supabase.from("asset_snapshot_items").delete().not("id", "is", null),
    ]);
  } catch (e) {
    console.error("[storage] clearAllData 예외:", e);
  }
}

export async function hasInitialData(): Promise<boolean> {
  try {
    const [cf, sn] = await Promise.all([
      supabase.from("cashflow").select("id", { count: "exact", head: true }),
      supabase.from("asset_snapshots").select("id", { count: "exact", head: true }),
    ]);
    return (cf.count ?? 0) > 0 || (sn.count ?? 0) > 0;
  } catch {
    return false;
  }
}
