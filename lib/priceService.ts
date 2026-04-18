/**
 * lib/priceService.ts
 *
 * 실시간 현재가 배치 조회 서비스.
 *
 * market 기준으로 소스를 분기합니다:
 *   KRX  → quotes.fetchKrxPrice()  (네이버 금융 실시간 폴링 API → /api/price/krx)
 *   US   → Yahoo Finance /api/price (심볼 배치 조회)
 *   CASH → 고정 단가 또는 조회 생략
 *
 * 조회 실패 종목은 result 에 포함하지 않음 → UI에서 "조회 실패" 표시
 * (MOCK_PRICES 자동 폴백은 의도적으로 비활성화 — 잘못된 가격을 정상 시세처럼
 *  보여주는 silent fallback 버그를 방지합니다)
 */

// MOCK_PRICES는 환율(USDKRW) 폴백 전용으로만 사용합니다.
import { MOCK_PRICES } from "./mockPrices";
import { fetchKrxPrice } from "./quotes";

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

function fromYahooSymbol(yahooSymbol: string): string {
  if (yahooSymbol.endsWith(".KS") || yahooSymbol.endsWith(".KQ")) {
    return yahooSymbol.slice(0, -3);
  }
  return yahooSymbol;
}

/** market 필드 또는 currency/symbol 패턴으로 시장을 분류합니다. */
function classifyMarket(h: PriceInput): "KRX" | "US" | "CASH" | "UNKNOWN" {
  if (h.market === "KRX")  return "KRX";
  if (h.market === "US")   return "US";
  if (h.market === "CASH") return "CASH";
  // market 미지정 시 heuristic (하위 호환)
  if (!h.market) {
    if (h.currency === "KRW" && /^\d{6}$/.test(h.symbol)) return "KRX";
    if (h.currency === "USD") return "US";
  }
  return "UNKNOWN";
}

/**
 * 여러 종목 현재가를 market 기준으로 분기하여 일괄 조회합니다.
 *
 * - KRX  : fetchKrxPrice() 개별 호출 (네이버 금융 실시간 폴링 API)
 * - US   : Yahoo Finance /api/price 배치 조회
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
  const krxItems:  PriceInput[] = [];
  const usItems:   PriceInput[] = [];

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

  // 3. KRX: 개별 조회 (네이버 금융 실시간 폴링 API)
  if (krxItems.length > 0) {
    await Promise.all(
      krxItems.map(async (h) => {
        const price = await fetchKrxPrice(h.symbol);
        if (price != null && price > 0) {
          result[h.symbol] = price;
        }
        // null → result에 추가 안 함 → UI "조회 실패"
      })
    );
  }

  // 4. US: Yahoo Finance 배치 조회
  if (usItems.length > 0) {
    const yahooSymbols = [
      ...new Set(usItems.map((h) => toYahooSymbol(h.symbol, h.currency))),
    ];

    const reqUrl = `/api/price?symbols=${encodeURIComponent(yahooSymbols.join(","))}`;

    try {
      const res = await fetch(reqUrl, { cache: "no-store" });
      if (res.ok) {
        const data: Record<string, number | null> = await res.json();
        for (const [yahooSym, price] of Object.entries(data)) {
          const internalSym = fromYahooSymbol(yahooSym);
          if (price != null && price > 0) {
            result[internalSym] = price;
          }
        }
      } else {
        console.warn(
          "[priceService] ✗ /api/price returned non-ok:",
          res.status,
          "for symbols:",
          yahooSymbols
        );
      }
    } catch (err) {
      console.error("[priceService] ✗ fetch error for US symbols:", err);
    }
  }

  // 조회 실패 심볼은 result에 없음 → 호출 측에서 undefined 로 "조회 실패" 처리
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

/** localStorage 키 — 마지막 성공 환율 지속 보관 */
const LAST_RATE_STORAGE_KEY = "usdKrw_lastSuccessRate";
/** 마지막으로 환율을 저장한 시각 (ISO 문자열) — 클라이언트에서의 “last_success_at” */
const LAST_RATE_UPDATED_AT_KEY = "usdKrw_lastUpdatedAt";
/** 직접 입력(manual) vs API 저장(api) — UI 문구 분기용 */
const LAST_RATE_SOURCE_KEY = "usdKrw_rateSource";

export type StoredUsdKrwSource = "manual" | "api";

/**
 * 유효한 숫자 환율일 때만 저장합니다. API 실패·파싱 실패 경로에서는 호출하지 않습니다.
 * localStorage 실패 시 sessionStorage에도 기록해 last_success_at 누락을 줄입니다.
 */
function saveLastRate(
  rate: unknown,
  updatedAtIso?: string,
  source: StoredUsdKrwSource = "api"
): { ok: true } | { ok: false; error: string } {
  if (typeof rate !== "number" || Number.isNaN(rate) || rate <= 100) {
    return { ok: false, error: "invalid_rate" };
  }
  if (typeof window === "undefined") {
    return { ok: false, error: "no_window" };
  }
  const iso = updatedAtIso ?? new Date().toISOString();
  let okLs = false;
  let okSs = false;
  let err = "";
  try {
    localStorage.setItem(LAST_RATE_STORAGE_KEY, String(rate));
    localStorage.setItem(LAST_RATE_UPDATED_AT_KEY, iso);
    localStorage.setItem(LAST_RATE_SOURCE_KEY, source);
    okLs = true;
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  try {
    sessionStorage.setItem(LAST_RATE_STORAGE_KEY, String(rate));
    sessionStorage.setItem(LAST_RATE_UPDATED_AT_KEY, iso);
    sessionStorage.setItem(LAST_RATE_SOURCE_KEY, source);
    okSs = true;
  } catch (e2) {
    if (!okLs) {
      err = err || (e2 instanceof Error ? e2.message : String(e2));
    }
  }
  if (okLs || okSs) return { ok: true };
  return { ok: false, error: err || "storage_failed" };
}

function coerceUsdKrwNumber(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v) && v > 100) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    if (!Number.isNaN(n) && n > 100) return n;
  }
  return null;
}

/** API JSON에서 USDKRW 환율 추출 (키 불일치·문자열 숫자 대비) */
function extractUsdKrwFromPayload(
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

function parseStoredRate(raw: string | null): number | null {
  if (!raw) return null;
  const v = parseFloat(raw);
  return isNaN(v) || v <= 100 ? null : v;
}

function parseStoredAt(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** localStorage 우선, 없으면 sessionStorage (동일 브라우저 세션 내 백업) */
function loadLastRate(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const fromLs = parseStoredRate(localStorage.getItem(LAST_RATE_STORAGE_KEY));
    if (fromLs != null) return fromLs;
    return parseStoredRate(sessionStorage.getItem(LAST_RATE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function loadLastRateUpdatedAt(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const lsAt = parseStoredAt(localStorage.getItem(LAST_RATE_UPDATED_AT_KEY));
    const ssAt = parseStoredAt(sessionStorage.getItem(LAST_RATE_UPDATED_AT_KEY));
    if (lsAt && ssAt) return lsAt.getTime() >= ssAt.getTime() ? lsAt : ssAt;
    return lsAt ?? ssAt;
  } catch {
    return null;
  }
}

function loadLastRateSource(): StoredUsdKrwSource | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = localStorage.getItem(LAST_RATE_SOURCE_KEY);
    const ss = sessionStorage.getItem(LAST_RATE_SOURCE_KEY);
    const v = ls ?? ss;
    if (v === "manual" || v === "api") return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * 페이지 로드 시 사용: 네트워크 호출 없이 저장소(또는 저장 없을 때만 MOCK 폴백)만 읽습니다.
 * 저장된 환율이 있으면 항상 그것을 쓰고 status는 cached입니다.
 */
export function readStoredUsdKrwRate(): UsdKrwRateState {
  const lastRate = loadLastRate();
  const lastUpdatedAt = loadLastRateUpdatedAt();
  if (lastRate != null) {
    const src = loadLastRateSource();
    const status: RateStatus = src === "manual" ? "manual" : "cached";
    return { rate: lastRate, lastUpdatedAt, status };
  }
  const fallbackRate = MOCK_PRICES["USDKRW"] ?? 1460;
  return { rate: fallbackRate, lastUpdatedAt: null, status: "fallback" };
}

/**
 * 사용자가 입력한 USD/KRW 환율을 저장합니다 (브라우저 localStorage + sessionStorage 백업).
 * 성공 시 대시보드에서 status "manual" 로 반영하면 됩니다.
 */
export function saveManualUsdKrwRate(
  rate: unknown
):
  | { ok: true; rate: number; lastUpdatedAt: Date }
  | { ok: false; error: string } {
  const n = coerceUsdKrwNumber(rate);
  if (n == null) {
    return { ok: false, error: "100보다 큰 유효한 환율을 입력해 주세요." };
  }
  const iso = new Date().toISOString();
  const saveResult = saveLastRate(n, iso, "manual");
  if (!saveResult.ok) {
    return {
      ok: false,
      error: "저장에 실패했습니다. 브라우저 저장소 설정을 확인해 주세요.",
    };
  }
  return { ok: true, rate: n, lastUpdatedAt: new Date(iso) };
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
      return "저장 실패 · localStorage";
    default:
      return FX_REFRESH_FAILED_USER_MESSAGE;
  }
}

/**
 * "달러 새로고침" 전용: API로만 조회하고, 성공 시에만 저장합니다.
 * 실패 시 저장값을 바꾸지 않으므로, 호출 측은 기존 state를 유지하면 됩니다.
 */
export async function refreshUsdKrwRateFromApi(): Promise<
  | { ok: true; rate: number; lastUpdatedAt: Date }
  | {
      ok: false;
      error: string;
      reason?: RefreshUsdKrwFailureReason;
      httpStatus?: number;
      /** 디버그용: 응답 본문 앞부분 또는 파싱된 payload 요약 */
      detail?: string;
    }
> {
  const symbol = "USDKRW=X";
  const reqUrl = `/api/price?symbols=${encodeURIComponent(symbol)}`;
  const absoluteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${reqUrl}`
      : reqUrl;

  try {
    console.log("[FX_TRACE][2] 클라이언트 요청 URL:", { reqUrl, absoluteUrl });

    const res = await fetch(reqUrl, { cache: "no-store" });
    const httpStatus = res.status;
    const text = await res.text();

    console.log("[FX_TRACE][7] 클라이언트 수신 HTTP status:", httpStatus);
    console.log("[FX_TRACE][8] 클라이언트 raw 응답 본문 (앞 1200자):", text.slice(0, 1200));

    if (!res.ok) {
      console.warn("[refreshUsdKrwRateFromApi] HTTP 비정상 (본문은 JSON 아닐 수 있음)", {
        reqUrl,
        httpStatus,
        bodyPreview: text.slice(0, 500),
      });
      return {
        ok: false,
        error: labelForFxRefreshFailure("http_error"),
        reason: "http_error",
        httpStatus,
        detail: text.slice(0, 200),
      };
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch (parseErr) {
      console.warn("[refreshUsdKrwRateFromApi] JSON 파싱 실패", {
        reqUrl,
        httpStatus,
        bodyPreview: text.slice(0, 400),
        parseErr,
      });
      return {
        ok: false,
        error: labelForFxRefreshFailure("parse_error"),
        reason: "parse_error",
        httpStatus,
        detail: text.slice(0, 200),
      };
    }

    const { rate, pickedKey } = extractUsdKrwFromPayload(data, symbol);
    console.log("[FX_TRACE][9] 클라이언트 파싱 환율값:", {
      expectedKey: symbol,
      pickedKey,
      rate,
      allKeys: Object.keys(data),
    });

    if (rate == null) {
      const rawVal = data[symbol];
      console.warn("[refreshUsdKrwRateFromApi] 환율 null 또는 추출 불가", {
        reqUrl,
        httpStatus,
        parsedPayload: data,
        rawForExpectedKey: rawVal,
      });
      return {
        ok: false,
        error: labelForFxRefreshFailure(
          rawVal === null || rawVal === undefined ? "server_null" : "rate_invalid"
        ),
        reason: rawVal === null || rawVal === undefined ? "server_null" : "rate_invalid",
        httpStatus,
        detail: JSON.stringify(data),
      };
    }

    const iso = new Date().toISOString();
    const saveResult = saveLastRate(rate, iso, "api");
    if (!saveResult.ok) {
      console.warn("[FX_TRACE][10][11] saveLastRate 실패", saveResult);
      return {
        ok: false,
        error: labelForFxRefreshFailure("storage_failed"),
        reason: "storage_failed",
        httpStatus,
        detail: saveResult.error,
      };
    }
    console.log("[FX_TRACE][10] saveLastRate 실행됨:", { rate, iso });
    try {
      const verify = localStorage.getItem(LAST_RATE_STORAGE_KEY);
      const verifyAt = localStorage.getItem(LAST_RATE_UPDATED_AT_KEY);
      const verifySs = sessionStorage.getItem(LAST_RATE_STORAGE_KEY);
      const verifySsAt = sessionStorage.getItem(LAST_RATE_UPDATED_AT_KEY);
      console.log("[FX_TRACE][11] 저장 확인:", {
        usdKrw_lastSuccessRate: verify ?? verifySs,
        usdKrw_lastUpdatedAt: verifyAt ?? verifySsAt,
      });
    } catch (e) {
      console.warn("[FX_TRACE][11] 저장소 읽기 확인 실패:", e);
    }

    console.log("[refreshUsdKrwRateFromApi] 성공", {
      reqUrl,
      httpStatus,
      symbol,
      pickedKey,
      finalExchangeRate: rate,
      lastSuccessAtIso: iso,
    });
    return { ok: true, rate, lastUpdatedAt: new Date(iso) };
  } catch (err) {
    console.error("[refreshUsdKrwRateFromApi] 네트워크/요청 오류", {
      reqUrl,
      err,
    });
    return {
      ok: false,
      error: labelForFxRefreshFailure("network"),
      reason: "network",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
