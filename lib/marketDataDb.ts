/**
 * market_data_cache — Supabase 단일 캐시 테이블 (타입·select·upsert)
 *
 * 스키마(컬럼):
 * - id uuid PK
 * - key text — 논리 키, UNIQUE(key, category) — 예: FX:USDKRW, SENTIMENT:FEAR_GREED, US:NVDA, KRX:032830
 * - category text — 'quote' | 'fx' | 'sentiment'
 * - market text — FX 행: 'FX', F&G: 'INDEX', quote: 'KRX' | 'US'
 * - symbol text — FX: 'USDKRW', F&G: 'FEAR_GREED', quote: 종목 심볼
 * - value_numeric, value_text, currency, source, status, updated_at
 *
 * DB 정의: supabase/migrations/20260419140000_market_data_cache.sql,
 * 보강/백필: 20260419170000_market_data_cache_complete.sql
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST select — 스키마와 반드시 동기화 */
export const MARKET_DATA_CACHE_SELECT_COLUMNS =
  "key,category,market,symbol,value_numeric,value_text,currency,source,status,updated_at" as const;

import type { FearGreedState } from "@/lib/fearGreedStorage";
import { FEAR_GREED_FALLBACK_VALUE } from "@/lib/fearGreedStorage";
import { MOCK_PRICES } from "@/lib/mockPrices";
import type { UsdKrwRateState } from "@/lib/priceService";

export type MarketDataCategory = "quote" | "fx" | "sentiment";

export type MarketDataCacheRow = {
  id?: string;
  key: string;
  category: MarketDataCategory;
  symbol?: string | null;
  market?: string | null;
  value_numeric: number | null;
  value_text: string | null;
  currency: string | null;
  source: string | null;
  status: string;
  updated_at: string;
};

/** DB 단일 행 — 환율 (key + market/symbol 규칙: FX / USDKRW) */
export const FX_KEY = "FX:USDKRW";
export const FX_CACHE_MARKET = "FX";
export const FX_CACHE_SYMBOL = "USDKRW";

/** DB 단일 행 — Fear & Greed (key + market/symbol: INDEX / FEAR_GREED) */
export const FEAR_GREED_KEY = "SENTIMENT:FEAR_GREED";
export const FEAR_GREED_CACHE_MARKET = "INDEX";
export const FEAR_GREED_CACHE_SYMBOL = "FEAR_GREED";

const LEGACY_FX_KEYS = new Set(["USDKRW", FX_KEY]);
const LEGACY_FNG_KEYS = new Set(["FEAR_GREED", FEAR_GREED_KEY]);

function isFxCacheRow(r: MarketDataCacheRow): boolean {
  if (r.category !== "fx") return false;
  if (LEGACY_FX_KEYS.has(r.key)) return true;
  return r.market === FX_CACHE_MARKET && r.symbol === FX_CACHE_SYMBOL;
}

function isFearGreedCacheRow(r: MarketDataCacheRow): boolean {
  if (r.category !== "sentiment") return false;
  if (LEGACY_FNG_KEYS.has(r.key)) return true;
  return (
    r.market === FEAR_GREED_CACHE_MARKET && r.symbol === FEAR_GREED_CACHE_SYMBOL
  );
}

export type ParsedMarketDataBundle = {
  usdKrw: UsdKrwRateState;
  fearGreed: FearGreedState;
  /** symbol → 현재가 (UI·집계용) */
  quotes: Record<string, number>;
  quotesMeta: Record<
    string,
    { currency: string | null; source: string | null; status: string; updatedAt: Date | null }
  >;
  lastQuoteRefreshAt: Date | null;
};

/** quote 행 cache key — 예: KRX:032830, US:NVDA */
export function makeQuoteCacheKey(
  market: "KRX" | "US",
  symbol: string
): string {
  return `${market}:${symbol.trim()}`;
}

/** key → 표시용 심볼 (quotes 맵 키와 일치시킴) */
export function quoteSymbolFromRow(r: MarketDataCacheRow): string | null {
  if (r.symbol?.trim()) return r.symbol.trim();
  const k = r.key;
  const idx = k.indexOf(":");
  if (idx > 0 && idx < k.length - 1) return k.slice(idx + 1).trim();
  return k.trim() || null;
}

/** Supabase/postgrest 가 numeric 을 문자열로 줄 때 대비 */
function asPositiveNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v) && v > 0) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

function asFearGreedIndex(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 100) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) return n;
  }
  return null;
}

function coerceRateStatus(v: string | undefined): UsdKrwRateState["status"] {
  if (v === "live" || v === "cached" || v === "manual" || v === "fallback") return v;
  return "fallback";
}

function coerceFngStatus(v: string | undefined): FearGreedState["status"] {
  if (v === "live" || v === "cached" || v === "fallback") return v;
  return "fallback";
}

function parseFngMeta(valueText: string | null): { indexAsOf: Date | null } {
  if (!valueText?.trim()) return { indexAsOf: null };
  try {
    const o = JSON.parse(valueText) as { indexTimestamp?: string };
    const ts = o.indexTimestamp;
    if (typeof ts === "string" && ts.trim()) {
      const d = new Date(ts);
      return { indexAsOf: isNaN(d.getTime()) ? null : d };
    }
  } catch {
    /* ignore */
  }
  return { indexAsOf: null };
}

function parseRowsToBundle(rows: MarketDataCacheRow[]): ParsedMarketDataBundle {
  let fxRow: MarketDataCacheRow | undefined;
  let fngRow: MarketDataCacheRow | undefined;
  const quoteRows: MarketDataCacheRow[] = [];

  for (const r of rows) {
    if (isFxCacheRow(r)) fxRow = r;
    else if (isFearGreedCacheRow(r)) fngRow = r;
    else if (r.category === "quote") quoteRows.push(r);
  }

  const fxNum = asPositiveNumber(fxRow?.value_numeric);
  const usdKrw: UsdKrwRateState =
    fxNum != null && fxNum > 100
      ? {
          rate: fxNum,
          lastUpdatedAt: fxRow?.updated_at ? new Date(fxRow.updated_at) : null,
          status: coerceRateStatus(fxRow?.status),
        }
      : {
          rate: MOCK_PRICES["USDKRW"] ?? 1460,
          lastUpdatedAt: null,
          status: "fallback",
        };

  const fngNum = asFearGreedIndex(fngRow?.value_numeric);
  const meta = parseFngMeta(fngRow?.value_text ?? null);
  const fearGreed: FearGreedState =
    fngNum != null
      ? {
          value: Math.round(fngNum),
          lastUpdatedAt: fngRow?.updated_at ? new Date(fngRow.updated_at) : null,
          indexAsOf: meta.indexAsOf,
          status: coerceFngStatus(fngRow?.status),
        }
      : {
          value: FEAR_GREED_FALLBACK_VALUE,
          lastUpdatedAt: null,
          indexAsOf: null,
          status: "fallback",
        };

  const quotes: Record<string, number> = {};
  const quotesMeta: ParsedMarketDataBundle["quotesMeta"] = {};
  let lastQuoteRefreshAt: Date | null = null;

  for (const q of quoteRows) {
    const sym = quoteSymbolFromRow(q);
    if (!sym) continue;
    const p = asPositiveNumber(q.value_numeric);
    if (p != null) {
      quotes[sym] = p;
      const at = q.updated_at ? new Date(q.updated_at) : null;
      quotesMeta[sym] = {
        currency: q.currency,
        source: q.source,
        status: q.status,
        updatedAt: at,
      };
      if (at && (!lastQuoteRefreshAt || at.getTime() > lastQuoteRefreshAt.getTime())) {
        lastQuoteRefreshAt = at;
      }
    }
  }

  return { usdKrw, fearGreed, quotes, quotesMeta, lastQuoteRefreshAt };
}

function normalizeMarketDataRowForUpsert(
  row: Omit<MarketDataCacheRow, "id">
): Omit<MarketDataCacheRow, "id"> {
  if (row.category === "fx") {
    return {
      ...row,
      key: FX_KEY,
      market: FX_CACHE_MARKET,
      symbol: FX_CACHE_SYMBOL,
    };
  }
  if (row.category === "sentiment") {
    return {
      ...row,
      key: FEAR_GREED_KEY,
      market: FEAR_GREED_CACHE_MARKET,
      symbol: FEAR_GREED_CACHE_SYMBOL,
    };
  }
  if (row.category === "quote") {
    const idx = row.key.indexOf(":");
    const fromKey =
      idx > 0 && idx < row.key.length - 1
        ? {
            market: row.key.slice(0, idx).trim(),
            symbol: row.key.slice(idx + 1).trim(),
          }
        : { market: "", symbol: "" };
    const mk = (row.market ?? "").trim() || fromKey.market;
    const sym = (row.symbol ?? "").trim() || fromKey.symbol;
    return { ...row, market: mk || null, symbol: sym || null };
  }
  return row;
}

export async function fetchMarketDataBundleFromDb(
  supabase: SupabaseClient
): Promise<ParsedMarketDataBundle> {
  const { data, error } = await supabase
    .from("market_data_cache")
    .select(MARKET_DATA_CACHE_SELECT_COLUMNS);

  if (error) {
    console.error("[marketDataDb] select 오류:", error.message);
    return parseRowsToBundle([]);
  }

  return parseRowsToBundle((data ?? []) as MarketDataCacheRow[]);
}

export async function upsertMarketRow(
  supabase: SupabaseClient,
  row: Omit<MarketDataCacheRow, "id">
): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = normalizeMarketDataRowForUpsert(row);
  const { error } = await supabase.from("market_data_cache").upsert(
    {
      key: n.key,
      category: n.category,
      symbol: n.symbol ?? null,
      market: n.market ?? null,
      value_numeric: n.value_numeric,
      value_text: n.value_text,
      currency: n.currency,
      source: n.source,
      status: n.status,
      updated_at: n.updated_at ?? new Date().toISOString(),
    },
    { onConflict: "key,category" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
