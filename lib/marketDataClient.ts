/**
 * 서버 market_data_cache (/api/market-data)와 통신하는 클라이언트 레이어.
 * 브라우저 저장은 선택적 캐시 동기화만 담당합니다.
 */

import type { FearGreedState } from "@/lib/fearGreedStorage";
import type { UsdKrwRateState } from "@/lib/priceService";
import { parseFetchJsonResponse } from "@/lib/safeFetchJson";

export type MarketDataApiBundle = {
  usdKrw: UsdKrwRateState;
  fearGreed: FearGreedState;
  quotes: Record<string, number>;
  lastQuoteRefreshAt: Date | null;
  /** 종목별 메타 (선택) */
  quotesMeta?: Record<
    string,
    { currency: string | null; source: string | null; status: string; updatedAt: Date | null }
  >;
};

function mapUsdKrwFromJson(j: {
  rate: number;
  lastUpdatedAt: string | null;
  status: UsdKrwRateState["status"];
}): UsdKrwRateState {
  return {
    rate: j.rate,
    lastUpdatedAt: j.lastUpdatedAt ? new Date(j.lastUpdatedAt) : null,
    status: j.status,
  };
}

function mapFngFromJson(j: {
  value: number;
  lastUpdatedAt: string | null;
  indexAsOf: string | null;
  status: FearGreedState["status"];
}): FearGreedState {
  return {
    value: j.value,
    lastUpdatedAt: j.lastUpdatedAt ? new Date(j.lastUpdatedAt) : null,
    indexAsOf: j.indexAsOf ? new Date(j.indexAsOf) : null,
    status: j.status,
  };
}

/** GET /api/market-data */
export async function fetchMarketDataFromApi(): Promise<MarketDataApiBundle | null> {
  try {
    const requestUrl = "/api/market-data";
    const res = await fetch(requestUrl, { cache: "no-store" });
    const parsed = await parseFetchJsonResponse<{
      ok?: boolean;
      usdKrw?: {
        rate: number;
        lastUpdatedAt: string | null;
        status: UsdKrwRateState["status"];
      };
      fearGreed?: {
        value: number;
        lastUpdatedAt: string | null;
        indexAsOf: string | null;
        status: FearGreedState["status"];
      };
      quotes?: Record<string, number>;
      lastQuoteRefreshAt?: string | null;
      quotesMeta?: Record<
        string,
        {
          currency: string | null;
          source: string | null;
          status: string;
          updatedAt: string | null;
        }
      >;
    }>(res, requestUrl, "GET /api/market-data");
    if (!parsed.ok) return null;
    const data = parsed.data;
    if (!res.ok || !data.ok || !data.usdKrw || !data.fearGreed) return null;
    const qm: MarketDataApiBundle["quotesMeta"] = {};
    if (data.quotesMeta) {
      for (const [k, v] of Object.entries(data.quotesMeta)) {
        qm[k] = {
          currency: v.currency,
          source: v.source,
          status: v.status,
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : null,
        };
      }
    }
    return {
      usdKrw: mapUsdKrwFromJson(data.usdKrw),
      fearGreed: mapFngFromJson(data.fearGreed),
      quotes: data.quotes ?? {},
      lastQuoteRefreshAt: data.lastQuoteRefreshAt
        ? new Date(data.lastQuoteRefreshAt)
        : null,
      quotesMeta: Object.keys(qm).length > 0 ? qm : undefined,
    };
  } catch {
    return null;
  }
}

type RefreshJson = {
  ok?: boolean;
  steps?: Record<string, string>;
  usdKrw?: {
    rate: number;
    lastUpdatedAt: string | null;
    status: UsdKrwRateState["status"];
  };
  fearGreed?: {
    value: number;
    lastUpdatedAt: string | null;
    indexAsOf: string | null;
    status: FearGreedState["status"];
  };
  quotes?: Record<string, number>;
  lastQuoteRefreshAt?: string | null;
  error?: string;
};

function mapRefreshJson(data: RefreshJson): MarketDataApiBundle | null {
  if (!data.usdKrw || !data.fearGreed) return null;
  return {
    usdKrw: mapUsdKrwFromJson(data.usdKrw),
    fearGreed: mapFngFromJson(data.fearGreed),
    quotes: data.quotes ?? {},
    lastQuoteRefreshAt: data.lastQuoteRefreshAt
      ? new Date(data.lastQuoteRefreshAt)
      : null,
  };
}

/** POST /api/market-data/refresh — 환율만 */
export async function refreshUsdKrwViaServer(): Promise<
  | { ok: true; bundle: MarketDataApiBundle }
  | { ok: false; error: string }
> {
  const requestUrl = "/api/market-data/refresh";
  const res = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fx: true }),
    cache: "no-store",
  });
  const parsed = await parseFetchJsonResponse<RefreshJson>(
    res,
    requestUrl,
    "POST refresh (fx)"
  );
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  if (data.steps?.fx === "fetch_failed") {
    return { ok: false, error: "실시간 환율을 가져오지 못했습니다." };
  }
  const bundle = mapRefreshJson(data);
  if (!bundle) return { ok: false, error: "응답 파싱 실패" };
  return { ok: true, bundle };
}

/** POST — 수동 환율 */
export async function saveManualUsdKrwViaServer(
  rate: number
): Promise<
  | { ok: true; bundle: MarketDataApiBundle }
  | { ok: false; error: string }
> {
  const requestUrl = "/api/market-data/refresh";
  const res = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manualFx: rate }),
    cache: "no-store",
  });
  const parsed = await parseFetchJsonResponse<RefreshJson>(
    res,
    requestUrl,
    "POST refresh (manualFx)"
  );
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  const bundle = mapRefreshJson(data);
  if (!bundle) return { ok: false, error: "응답 파싱 실패" };
  return { ok: true, bundle };
}

/** POST — Fear & Greed */
export async function refreshFearGreedViaServer(): Promise<
  | { ok: true; bundle: MarketDataApiBundle }
  | { ok: false; error: string }
> {
  const requestUrl = "/api/market-data/refresh";
  const res = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fearGreed: true }),
    cache: "no-store",
  });
  const parsed = await parseFetchJsonResponse<RefreshJson>(
    res,
    requestUrl,
    "POST refresh (fearGreed)"
  );
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  const step = data.steps?.fearGreed;
  if (step != null && step !== "ok" && !String(step).startsWith("ok")) {
    return { ok: false, error: "Fear & Greed 지수를 가져오지 못했습니다." };
  }
  const bundle = mapRefreshJson(data);
  if (!bundle) return { ok: false, error: "응답 파싱 실패" };
  return { ok: true, bundle };
}

/**
 * POST — 종목 시세 갱신: 서버가 `asset_snapshot_holdings` 최신 일자의 STOCK 목록으로만
 * 외부 API 조회 후 `market_data_cache` upsert (클라이언트 종목 목록 없음).
 */
export async function refreshQuotesViaServer(
  applyHoldings = true
): Promise<
  | {
      ok: true;
      bundle: MarketDataApiBundle;
      quotes: Record<string, number>;
      steps?: Record<string, string>;
    }
  | { ok: false; error: string }
> {
  const requestUrl = "/api/market-data/refresh";
  const res = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applyHoldings,
      fromHoldings: true,
    }),
    cache: "no-store",
  });
  const parsed = await parseFetchJsonResponse<RefreshJson>(
    res,
    requestUrl,
    "POST refresh (quotes/fromHoldings)"
  );
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const data = parsed.data;
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  const bundle = mapRefreshJson(data);
  if (!bundle) return { ok: false, error: "응답 파싱 실패" };
  return {
    ok: true,
    bundle,
    quotes: data.quotes ?? {},
    steps: data.steps,
  };
}

// ── 선택적 브라우저 캐시 (최종 기준 아님) ─────────────────────────────

const LS_FX_RATE = "usdKrw_lastSuccessRate_cache";
const LS_FX_AT = "usdKrw_lastUpdatedAt_cache";
const LS_FNG = "fearGreed_lastValue_cache";
const LS_FNG_AT = "fearGreed_lastUpdatedAt_cache";

/** 서버에서 받은 값을 로컬에만 백업 (오프라인 표시용, 계산 기준은 아님) */
export function syncOptionalBrowserCacheFromBundle(bundle: MarketDataApiBundle): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_FX_RATE, String(bundle.usdKrw.rate));
    if (bundle.usdKrw.lastUpdatedAt) {
      localStorage.setItem(LS_FX_AT, bundle.usdKrw.lastUpdatedAt.toISOString());
    }
    localStorage.setItem(LS_FNG, String(bundle.fearGreed.value));
    if (bundle.fearGreed.lastUpdatedAt) {
      localStorage.setItem(LS_FNG_AT, bundle.fearGreed.lastUpdatedAt.toISOString());
    }
  } catch {
    /* ignore */
  }
}
