/**
 * Fear & Greed 지수 — DB `market_data_cache` 가 단일 소스입니다.
 * (과거 브라우저 저장 로직은 제거되었습니다.)
 */

import { CNN_FEAR_GREED_SOURCE_NAME } from "@/lib/cnnFearGreed";

export type FearGreedStatus = "live" | "cached" | "fallback";

export interface FearGreedState {
  value: number;
  lastUpdatedAt: Date | null;
  /** CNN 지수 기준 시각(지수 스냅샷) */
  indexAsOf: Date | null;
  status: FearGreedStatus;
}

/** 저장 레코드 출처 — 구버전(암호화폐 API 등) 값은 무시 */
export const FEAR_GREED_DATA_SOURCE_CNN_US = "cnn_us" as const;

/** 저장 없을 때 방어자산 가이드 계산용 중립 기본값 */
export const FEAR_GREED_FALLBACK_VALUE = 50;

export const FNG_REFRESH_FAILED_CACHED_MESSAGE =
  "실시간 조회 실패 · 마지막 저장값 사용";
export const FNG_REFRESH_FAILED_FALLBACK_MESSAGE =
  "실시간 조회 실패 · 기본값 사용";

export type FearGreedRefreshOk = {
  ok: true;
  value: number;
  lastUpdatedAt: Date;
  indexAsOf: Date | null;
  sourceName: string;
  requestUrl: string;
  rawPayload: unknown;
  parsedLatestValue: number;
  indexDateIso: string | null;
  previousDisplayedValue: number;
};

export type FearGreedRefreshResult =
  | FearGreedRefreshOk
  | {
      ok: false;
      error: string;
      previousDisplayedValue: number;
      requestUrl?: string;
      rawPayload?: unknown;
    };

/**
 * 초기 렌더용. 실제 값은 `GET /api/market-data` 로 DB에서 로드합니다.
 */
export function readStoredFearGreed(): FearGreedState {
  return {
    value: FEAR_GREED_FALLBACK_VALUE,
    lastUpdatedAt: null,
    indexAsOf: null,
    status: "fallback",
  };
}

/**
 * Fear & Greed 새로고침 — 서버가 CNN 조회 후 DB에 저장합니다.
 */
export async function refreshFearGreedFromApi(
  previousDisplayedValue: number
): Promise<FearGreedRefreshResult> {
  try {
    const { refreshFearGreedViaServer, syncOptionalBrowserCacheFromBundle } =
      await import("./marketDataClient");
    const res = await refreshFearGreedViaServer();
    if (!res.ok) {
      return {
        ok: false,
        error: res.error,
        previousDisplayedValue,
        requestUrl: CNN_FEAR_GREED_SOURCE_NAME,
      };
    }
    syncOptionalBrowserCacheFromBundle(res.bundle);
    const fg = res.bundle.fearGreed;
    return {
      ok: true,
      value: fg.value,
      lastUpdatedAt: fg.lastUpdatedAt ?? new Date(),
      indexAsOf: fg.indexAsOf,
      sourceName: CNN_FEAR_GREED_SOURCE_NAME,
      requestUrl: "/api/market-data/refresh",
      rawPayload: null,
      parsedLatestValue: fg.value,
      indexDateIso: fg.indexAsOf?.toISOString() ?? null,
      previousDisplayedValue,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "네트워크 오류",
      previousDisplayedValue,
    };
  }
}
