/**
 * 일일 자동 스냅샷: 최신 holdings(asset_snapshot_holdings)와 환율로
 * 요약(asset_snapshots)·상세(asset_snapshot_items) 행을 생성합니다.
 *
 * 순투자금·수익·수익률(net_investment, profit, return_rate)은 cashflow 기준으로
 * lib/netInvestment 의 computeSnapshotInvestmentMetrics 에서 계산합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FX_CACHE_MARKET,
  FX_CACHE_SYMBOL,
  FX_KEY,
  upsertMarketRow,
} from "@/lib/marketDataDb";
import { MOCK_PRICES } from "@/lib/mockPrices";
import type { AssetSnapshotHolding } from "@/types/assets";

const USDKRW_SYMBOL = "USDKRW=X";

export function snapshotDateSeoul(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 스냅샷용 환율: `market_data_cache` 최신값 우선, 없으면 /api/price 로 조회 후 DB에 반영.
 */
export async function fetchUsdKrwForSnapshot(
  supabase: SupabaseClient,
  baseUrl: string
): Promise<number> {
  const { data: row, error: selErr } = await supabase
    .from("market_data_cache")
    .select("value_numeric")
    .eq("category", "fx")
    .eq("key", FX_KEY)
    .maybeSingle();

  if (!selErr) {
    const cached = row?.value_numeric;
    const n =
      typeof cached === "number"
        ? cached
        : typeof cached === "string" && cached.trim()
          ? Number(cached)
          : NaN;
    if (!Number.isNaN(n) && n > 100) {
      return n;
    }
  }

  const trimmed = baseUrl.replace(/\/$/, "");
  const url = `${trimmed}/api/price?symbols=${encodeURIComponent(USDKRW_SYMBOL)}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text.trim() ? (JSON.parse(text) as unknown) : null;
    } catch {
      throw new Error(`USDKRW 응답 JSON 파싱 실패 (앞 120자): ${text.slice(0, 120)}`);
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed === null ||
      !("ok" in parsed)
    ) {
      throw new Error("USDKRW 응답 형식 오류 (ok 필드 없음)");
    }
    const envelope = parsed as {
      ok?: boolean;
      prices?: Record<string, unknown>;
      error?: string;
    };
    if (envelope.ok === false) {
      throw new Error(envelope.error ?? "USDKRW API ok:false");
    }
    const data = envelope.prices;
    if (!data || typeof data !== "object") {
      throw new Error("USDKRW 응답에 prices 없음");
    }
    const raw = data[USDKRW_SYMBOL];
    const r = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
    if (Number.isFinite(r) && r > 100) {
      await upsertMarketRow(supabase, {
        key: FX_KEY,
        category: "fx",
        market: FX_CACHE_MARKET,
        symbol: FX_CACHE_SYMBOL,
        value_numeric: r,
        value_text: null,
        currency: "KRW",
        source: "snapshot_cron",
        status: "live",
        updated_at: new Date().toISOString(),
      });
      return r;
    }
  } catch (e) {
    console.warn("[snapshotAutoSave] USDKRW 조회 실패, MOCK 폴백:", e);
  }
  const fb = MOCK_PRICES["USDKRW"] ?? 1460;
  return fb > 100 ? fb : 1460;
}

export function originFromRequest(request: Request): string {
  try {
    const u = new URL(request.url);
    if (u.host) return `${u.protocol}//${u.host}`;
  } catch {
    /* ignore */
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (site) return site;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export type LatestHoldingsFetch = {
  holdings: AssetSnapshotHolding[];
  /** asset_snapshot_holdings 기준 최대 snapshot_date (없으면 null) */
  sourceSnapshotDate: string | null;
};

/**
 * asset_snapshot_holdings에서 MAX(snapshot_date)와 동일한 기준으로 해당 일자 전체 행을 가져옵니다.
 * (ORDER BY … LIMIT 1만 쓰면 snapshot_date NULL 행이 DESC에서 먼저 나와 빈 결과가 될 수 있음)
 */
export async function fetchLatestHoldings(
  supabase: SupabaseClient
): Promise<LatestHoldingsFetch> {
  const { data: latest, error: latestErr } = await supabase
    .from("asset_snapshot_holdings")
    .select("snapshot_date")
    .not("snapshot_date", "is", null)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) {
    console.error("[snapshotAutoSave] 최신 snapshot_date 조회 오류:", latestErr.message);
    throw new Error(`asset_snapshot_holdings 최신 일자 조회 실패: ${latestErr.message}`);
  }
  const latestDate = latest?.snapshot_date;
  if (latestDate == null || latestDate === "") {
    return { holdings: [], sourceSnapshotDate: null };
  }

  const dateStr = String(latestDate);
  const { data: rows, error } = await supabase
    .from("asset_snapshot_holdings")
    .select("*")
    .eq("snapshot_date", dateStr);

  if (error) {
    console.error("[snapshotAutoSave] holdings 조회 오류:", error.message);
    throw new Error(`asset_snapshot_holdings 조회 실패: ${error.message}`);
  }

  const holdings = (rows ?? []).map((r) => ({
    id: String(r.id ?? ""),
    snapshot_date: String(r.snapshot_date ?? ""),
    name: String(r.name ?? ""),
    symbol: r.symbol != null ? String(r.symbol) : undefined,
    market: r.market != null ? String(r.market) : undefined,
    currency: r.currency != null ? String(r.currency) : undefined,
    account: r.account != null ? String(r.account) : undefined,
    quantity: num(r.quantity),
    avg_price: num(r.avg_price),
    current_price: num(r.current_price),
    evaluated_amount: num(r.evaluated_amount),
    weight: r.weight != null && r.weight !== "" ? num(r.weight) : undefined,
    target_min_weight:
      r.target_min_weight != null && r.target_min_weight !== ""
        ? num(r.target_min_weight)
        : undefined,
    target_max_weight:
      r.target_max_weight != null && r.target_max_weight !== ""
        ? num(r.target_max_weight)
        : undefined,
    asset_type: r.asset_type != null ? String(r.asset_type) : undefined,
    created_at: String(r.created_at ?? ""),
  }));

  return { holdings, sourceSnapshotDate: dateStr };
}

export type SnapshotSummaryComputed = {
  total_asset: number;
  stock_asset: number;
  cash_asset: number;
  kr_asset: number;
  us_asset: number;
};

/**
 * 대시보드(AssetPortfolioDashboard)와 동일한 환산 규칙:
 * - USD 평가액은 evaluated_amount가 USD, KRW는 원화 그대로
 */
export function computeSnapshotSummary(
  holdings: AssetSnapshotHolding[],
  usdKrwRate: number
): SnapshotSummaryComputed {
  const rate = usdKrwRate > 100 ? usdKrwRate : 1460;

  let krStock = 0;
  let usStockUsd = 0;
  let krwCash = 0;
  let usdCash = 0;
  let krwBond = 0;
  let usdBond = 0;

  for (const h of holdings) {
    const ev = num(h.evaluated_amount);
    const cur = (h.currency ?? "").toUpperCase();
    const at = h.asset_type ?? "";

    if (at === "STOCK") {
      if (cur === "USD") usStockUsd += ev;
      else krStock += ev;
      continue;
    }
    if (at === "KRW_CASH") {
      krwCash += ev;
      continue;
    }
    if (at === "USD_CASH") {
      usdCash += ev;
      continue;
    }
    if (at === "BOND") {
      if (cur === "USD") usdBond += ev;
      else krwBond += ev;
    }
  }

  const kr_asset = krStock + krwCash + krwBond;
  const us_asset = (usStockUsd + usdCash + usdBond) * rate;
  const stock_asset = krStock + usStockUsd * rate;
  const cash_asset = krwCash + usdCash * rate + krwBond + usdBond * rate;
  const total_asset = kr_asset + us_asset;

  return {
    total_asset,
    stock_asset,
    cash_asset,
    kr_asset,
    us_asset,
  };
}

export type SnapshotItemRow = {
  snapshot_date: string;
  name: string;
  ticker: string | null;
  asset_type: string | null;
  currency: string | null;
  account: string | null;
  quantity: number;
  price: number;
  evaluated_amount: number;
  target_min_weight: number | null;
  target_max_weight: number | null;
};

export function holdingsToSnapshotItems(
  snapshotDate: string,
  holdings: AssetSnapshotHolding[]
): SnapshotItemRow[] {
  return holdings.map((h) => ({
    snapshot_date: snapshotDate,
    name: h.name,
    ticker: h.symbol ?? null,
    asset_type: h.asset_type ?? null,
    currency: h.currency ?? null,
    account: h.account ?? null,
    quantity: h.quantity,
    price: h.current_price,
    evaluated_amount: h.evaluated_amount,
    target_min_weight:
      h.target_min_weight != null && Number.isFinite(h.target_min_weight)
        ? h.target_min_weight
        : null,
    target_max_weight:
      h.target_max_weight != null && Number.isFinite(h.target_max_weight)
        ? h.target_max_weight
        : null,
  }));
}
