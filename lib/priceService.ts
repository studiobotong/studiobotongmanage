/**
 * lib/priceService.ts
 *
 * 실시간 현재가 배치 조회 서비스.
 *
 * 일괄 시세 새로고침은 서버 `/api/market-data/refresh` + `fromHoldings` 가 holdings 기준으로
 * `market_data_cache` 를 갱신합니다. 폼에서 단일 종목 조회는 `/api/price` 직접 호출로
 * 캐시에 없는 신규 심볼도 조회할 수 있습니다.
 *
 * 조회 실패 종목은 result 에 포함하지 않음 → UI에서 "조회 실패" 표시
 * (MOCK_PRICES 자동 폴백은 의도적으로 비활성화 — 잘못된 가격을 정상 시세처럼
 *  보여주는 silent fallback 버그를 방지합니다)
 */

// MOCK_PRICES는 환율(USDKRW) 폴백 전용으로만 사용합니다.
import { parseFetchJsonResponse } from "@/lib/safeFetchJson";

import { MOCK_PRICES } from "./mockPrices";
// 현금·채권 등 실제 API 조회가 불필요한 심볼
const FIXED_PRICE_SYMBOLS: Record<string, number> = {
  KRW_CASH: 1,
  USD_CASH: 1,
  BOND_USD: 1,
};

export type PriceInput = {
  symbol: string;
  currency: string;
  /** 시장 구분. 지정 시 소스 분기가 정확해집니다. */
  market?: string; // "KRX" | "US" | "CASH" | undefined
};

// ── Yahoo Finance 심볼 변환 (US 종목 전용) ────────────────────────────────────
// KRX 종목은 fetchKrxPrice()로 별도 처리하므로 이 함수는 US 심볼에만 호출됩니다.

export function toYahooSymbol(symbol: string, currency: string): string {
  // 레거시 호환: market 미지정 + KRW 6자리 패턴은 .KS 변환 유지
  // (market 이 명시된 경우에는 KRX 분기에서 처리되어 이 함수로 오지 않음)
  if (currency === "KRW" && /^\d{6}$/.test(symbol)) {
    return `${symbol}.KS`;
  }
  return symbol;
}

/** market 필드 또는 currency/symbol 패턴으로 시장을 분류합니다. */
export function classifyPriceInputMarket(
  h: PriceInput
): "KRX" | "US" | "CASH" | "UNKNOWN" {
  if (h.market === "KRX") return "KRX";
  if (h.market === "US") return "US";
  if (h.market === "CASH") return "CASH";
  if (!h.market) {
    if (h.currency === "KRW" && /^\d{6}$/.test(h.symbol)) return "KRX";
    if (h.currency === "USD") return "US";
  }
  return "UNKNOWN";
}

function classifyMarket(h: PriceInput): "KRX" | "US" | "CASH" | "UNKNOWN" {
  return classifyPriceInputMarket(h);
}

/**
 * 여러 종목 현재가를 market 기준으로 분기하여 일괄 조회합니다.
 *
 * - KRX/US: 서버에서 네이버·Yahoo 등 조회 후 DB 캐시
 * - CASH : 고정 단가(1) 또는 FIXED_PRICE_SYMBOLS
 *
 * @returns symbol → 현재가 맵 (조회 실패 종목은 누락)
 */
export async function batchGetPrices(
  holdings: PriceInput[]
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  // 1. 고정 단가 심볼 처리
  const toFetch: PriceInput[] = [];
  for (const h of holdings) {
    if (h.symbol in FIXED_PRICE_SYMBOLS) {
      result[h.symbol] = FIXED_PRICE_SYMBOLS[h.symbol];
    } else {
      toFetch.push(h);
    }
  }

  if (toFetch.length === 0) return result;

  // 2. market 기준 분류
  const krxItems: PriceInput[] = [];
  const usItems: PriceInput[] = [];

  for (const h of toFetch) {
    const mkt = classifyMarket(h);
    if (mkt === "KRX") {
      krxItems.push(h);
    } else if (mkt === "CASH") {
      // CASH는 FIXED_PRICE_SYMBOLS 에서 처리되어야 하나 미등록 심볼은 생략
    } else {
      // US 또는 UNKNOWN → Yahoo 경로
      usItems.push(h);
    }
  }

  // 2b~4. holdings에 없는 신규 종목 등 — `/api/price` 직접 조회 (market_data_cache 목록과 무관)
  async function fetchKrxClient(symbol: string): Promise<number | null> {
    const url = `/api/price/krx?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    type KrxBody =
      | { ok: true; symbol: string; price: number | null }
      | { ok: false; error: string };
    const parsed = await parseFetchJsonResponse<KrxBody>(res, url, "batchGetPrices/krx");
    if (!parsed.ok) return null;
    const data = parsed.data;
    if (!data.ok) return null;
    const p = data.price;
    return typeof p === "number" && p > 0 ? p : null;
  }

  function fromYahooSymbol(yahooSymbol: string): string {
    if (yahooSymbol.endsWith(".KS") || yahooSymbol.endsWith(".KQ")) {
      return yahooSymbol.slice(0, -3);
    }
    return yahooSymbol;
  }

  async function fetchUsBatchClient(
    items: PriceInput[]
  ): Promise<Record<string, number | null>> {
    if (items.length === 0) return {};
    const yahooSymbols = [...new Set(items.map((h) => toYahooSymbol(h.symbol, h.currency)))];
    const url = `/api/price?symbols=${encodeURIComponent(yahooSymbols.join(","))}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    type BatchBody =
      | { ok: true; prices: Record<string, number | null> }
      | { ok: false; error: string };
    const parsed = await parseFetchJsonResponse<BatchBody>(
      res,
      url,
      "batchGetPrices/usBatch"
    );
    if (!parsed.ok) return {};
    const envelope = parsed.data;
    if (!envelope.ok) return {};
    const data = envelope.prices;
    const out: Record<string, number | null> = {};
    for (const [yahooSym, price] of Object.entries(data)) {
      out[fromYahooSymbol(yahooSym)] = price;
    }
    return out;
  }

  for (const h of krxItems) {
    const p = await fetchKrxClient(h.symbol);
    if (p != null && p > 0) result[h.symbol] = p;
  }

  if (usItems.length > 0) {
    const batch = await fetchUsBatchClient(usItems);
    for (const h of usItems) {
      const p = batch[h.symbol];
      if (p != null && p > 0) result[h.symbol] = p;
    }
  }

  return result;
}

// ── 환율 조회 결과 타입 ────────────────────────────────────────────────────────

/**
 * 환율 출처:
 * - live: 방금 외부 API 새로고침 성공
 * - manual: 사용자 직접 입력 저장
 * - cached: 저장소의 값(이전에 API로 저장됨)
 * - fallback: 저장 없음 · MOCK 고정값
 */
export type RateStatus = "live" | "cached" | "manual" | "fallback";

export interface UsdKrwRateState {
  rate: number;
  lastUpdatedAt: Date | null;
  status: RateStatus;
}

export function coerceUsdKrwNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v) && v > 100) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    if (!Number.isNaN(n) && n > 100) return n;
  }
  return null;
}

/** API JSON에서 USDKRW 환율 추출 (키 불일치·문자열 숫자 대비) — 서버 라우트에서도 사용 */
export function extractUsdKrwFromPayload(
  data: Record<string, unknown>,
  expectedKey: string
): { rate: number | null; pickedKey?: string } {
  const direct = coerceUsdKrwNumber(data[expectedKey]);
  if (direct != null) return { rate: direct, pickedKey: expectedKey };
  for (const key of Object.keys(data)) {
    if (key.startsWith("_")) continue;
    const r = coerceUsdKrwNumber(data[key]);
    if (r != null) return { rate: r, pickedKey: key };
  }
  return { rate: null };
}

/**
 * 초기 렌더용(동기). 실제 값은 `GET /api/market-data` 로 DB에서 로드합니다.
 * 브라우저 저장은 사용하지 않습니다.
 */
export function defaultUsdKrwRateState(): UsdKrwRateState {
  const fallbackRate = MOCK_PRICES["USDKRW"] ?? 1460;
  return { rate: fallbackRate, lastUpdatedAt: null, status: "fallback" };
}

/** @deprecated 이름 호환 — `defaultUsdKrwRateState` 와 동일 (localStorage 미사용) */
export function readStoredUsdKrwRate(): UsdKrwRateState {
  return defaultUsdKrwRateState();
}

/**
 * 수동 환율 — 서버 `market_data_cache` 에 저장합니다.
 */
export async function saveManualUsdKrwRate(
  rate: unknown
): Promise<
  | { ok: true; rate: number; lastUpdatedAt: Date }
  | { ok: false; error: string }
> {
  const n = coerceUsdKrwNumber(rate);
  if (n == null) {
    return { ok: false, error: "100보다 큰 유효한 환율을 입력해 주세요." };
  }
  const { saveManualUsdKrwViaServer, syncOptionalBrowserCacheFromBundle } =
    await import("./marketDataClient");
  const res = await saveManualUsdKrwViaServer(n);
  if (!res.ok) {
    return {
      ok: false,
      error: res.error || "서버에 환율을 저장하지 못했습니다.",
    };
  }
  syncOptionalBrowserCacheFromBundle(res.bundle);
  return {
    ok: true,
    rate: n,
    lastUpdatedAt: res.bundle.usdKrw.lastUpdatedAt ?? new Date(),
  };
}

/** 클라이언트 환율 새로고침 실패 시 사용자에게 보여줄 기본 안내 (저장값 유지 전제) */
export const FX_REFRESH_FAILED_USER_MESSAGE =
  "실시간 조회 실패 · 마지막 저장값 사용";

export type RefreshUsdKrwFailureReason =
  | "http_error"
  | "network"
  | "parse_error"
  /** HTTP 200이나 서버가 해당 심볼 가격을 null로 돌려줌 */
  | "server_null"
  /** payload에 유효한 환율 숫자 없음 */
  | "rate_invalid"
  | "storage_failed";

/** 실패 유형별 사용자 표시 (저장값 유지 전제) */
export function labelForFxRefreshFailure(
  reason: RefreshUsdKrwFailureReason | undefined
): string {
  switch (reason) {
    case "http_error":
      return "요청 실패 · HTTP 오류 (로그인·서버 오류 등)";
    case "network":
      return "요청 실패 · 네트워크";
    case "parse_error":
      return "파싱 실패 · JSON이 아닌 응답 (로그인 페이지 등)";
    case "server_null":
      return "응답 실패 · 서버가 환율 null (Stooq/Yahoo/OpenEr 모두 실패)";
    case "rate_invalid":
      return "파싱 실패 · 유효한 환율 숫자 없음";
    case "storage_failed":
      return "저장 실패 · DB";
    default:
      return FX_REFRESH_FAILED_USER_MESSAGE;
  }
}

/**
 * 달러 새로고침 — 서버가 외부 조회 후 `market_data_cache` 에 저장합니다.
 */
export async function refreshUsdKrwRateFromApi(): Promise<
  | { ok: true; rate: number; lastUpdatedAt: Date }
  | {
      ok: false;
      error: string;
      reason?: RefreshUsdKrwFailureReason;
      httpStatus?: number;
      detail?: string;
    }
> {
  try {
    const { refreshUsdKrwViaServer, syncOptionalBrowserCacheFromBundle } =
      await import("./marketDataClient");
    const res = await refreshUsdKrwViaServer();
    if (!res.ok) {
      return {
        ok: false,
        error: res.error,
        reason: "http_error",
      };
    }
    syncOptionalBrowserCacheFromBundle(res.bundle);
    const u = res.bundle.usdKrw;
    return {
      ok: true,
      rate: u.rate,
      lastUpdatedAt: u.lastUpdatedAt ?? new Date(),
    };
  } catch (err) {
    return {
      ok: false,
      error: labelForFxRefreshFailure("network"),
      reason: "network",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
