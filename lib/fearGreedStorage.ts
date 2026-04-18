/**
 * Fear & Greed 지수 — 브라우저 저장 + 수동 새로고침만 네트워크 조회.
 * (환율 USDKRW와 동일: value / lastUpdatedAt / status)
 * 데이터는 CNN 미국 주식 Fear & Greed만 허용합니다.
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

const STORAGE_VALUE_KEY = "fearGreed_lastValue";
const STORAGE_UPDATED_AT_KEY = "fearGreed_lastUpdatedAt";
const STORAGE_INDEX_ASOF_KEY = "fearGreed_indexAsOfIso";
const STORAGE_SOURCE_KEY = "fearGreed_dataSource";

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
  /** 화면 반영 직전에 표시되던 값 (로그용, 호출부에서 넣음) */
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

function parseValue(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function parseAt(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function loadStoredSource(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = localStorage.getItem(STORAGE_SOURCE_KEY);
    const ss = sessionStorage.getItem(STORAGE_SOURCE_KEY);
    return ls ?? ss;
  } catch {
    return null;
  }
}

function loadStoredValue(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const ls = parseValue(localStorage.getItem(STORAGE_VALUE_KEY));
    if (ls != null) return ls;
    return parseValue(sessionStorage.getItem(STORAGE_VALUE_KEY));
  } catch {
    return null;
  }
}

function loadStoredUpdatedAt(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const lsAt = parseAt(localStorage.getItem(STORAGE_UPDATED_AT_KEY));
    const ssAt = parseAt(sessionStorage.getItem(STORAGE_UPDATED_AT_KEY));
    if (lsAt && ssAt) return lsAt.getTime() >= ssAt.getTime() ? lsAt : ssAt;
    return lsAt ?? ssAt;
  } catch {
    return null;
  }
}

function loadStoredIndexAsOf(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const lsAt = parseAt(localStorage.getItem(STORAGE_UPDATED_AT_KEY));
    const ssAt = parseAt(sessionStorage.getItem(STORAGE_UPDATED_AT_KEY));
    const lsIx = parseAt(localStorage.getItem(STORAGE_INDEX_ASOF_KEY));
    const ssIx = parseAt(sessionStorage.getItem(STORAGE_INDEX_ASOF_KEY));
    if (lsAt && ssAt) {
      return lsAt.getTime() >= ssAt.getTime() ? lsIx : ssIx;
    }
    return lsIx ?? ssIx;
  } catch {
    return null;
  }
}

function saveFearGreed(
  value: number,
  updatedAtIso: string,
  indexAsOfIso: string | null
): { ok: true } | { ok: false } {
  if (typeof window === "undefined") return { ok: false };
  const s = String(Math.round(value));
  const ix = indexAsOfIso ?? "";
  let ok = false;
  try {
    localStorage.setItem(STORAGE_VALUE_KEY, s);
    localStorage.setItem(STORAGE_UPDATED_AT_KEY, updatedAtIso);
    localStorage.setItem(STORAGE_SOURCE_KEY, FEAR_GREED_DATA_SOURCE_CNN_US);
    if (ix) {
      localStorage.setItem(STORAGE_INDEX_ASOF_KEY, ix);
    } else {
      localStorage.removeItem(STORAGE_INDEX_ASOF_KEY);
    }
    ok = true;
  } catch {
    /* sessionStorage 폴백 */
  }
  try {
    sessionStorage.setItem(STORAGE_VALUE_KEY, s);
    sessionStorage.setItem(STORAGE_UPDATED_AT_KEY, updatedAtIso);
    sessionStorage.setItem(STORAGE_SOURCE_KEY, FEAR_GREED_DATA_SOURCE_CNN_US);
    if (ix) {
      sessionStorage.setItem(STORAGE_INDEX_ASOF_KEY, ix);
    } else {
      sessionStorage.removeItem(STORAGE_INDEX_ASOF_KEY);
    }
    ok = true;
  } catch {
    /* ignore */
  }
  return ok ? { ok: true } : { ok: false };
}

/**
 * 네트워크 없이 저장소만 읽습니다. 저장 없거나 CNN 미승인 데이터면 fallback 값·상태.
 */
export function readStoredFearGreed(): FearGreedState {
  const source = loadStoredSource();
  const v = loadStoredValue();
  const at = loadStoredUpdatedAt();
  const ix = loadStoredIndexAsOf();

  if (v != null && source === FEAR_GREED_DATA_SOURCE_CNN_US) {
    return {
      value: v,
      lastUpdatedAt: at,
      indexAsOf: ix,
      status: "cached",
    };
  }

  return {
    value: FEAR_GREED_FALLBACK_VALUE,
    lastUpdatedAt: null,
    indexAsOf: null,
    status: "fallback",
  };
}

export async function refreshFearGreedFromApi(
  previousDisplayedValue: number
): Promise<FearGreedRefreshResult> {
  try {
    const res = await fetch("/api/fear-greed", { cache: "no-store" });
    const text = await res.text();
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: "응답이 JSON이 아닙니다.",
        previousDisplayedValue,
        requestUrl: "/api/fear-greed",
      };
    }

    const errRequestUrl =
      typeof j.requestUrl === "string" ? j.requestUrl : undefined;

    if (!res.ok || j.ok !== true) {
      const err =
        typeof j.error === "string"
          ? j.error
          : `HTTP ${res.status}`;
      return {
        ok: false,
        error: err,
        previousDisplayedValue,
        requestUrl: errRequestUrl,
        rawPayload: j.raw,
      };
    }

    if (typeof j.value !== "number" || !Number.isFinite(j.value)) {
      return {
        ok: false,
        error: "Fear & Greed 지수 파싱 실패",
        previousDisplayedValue,
      };
    }

    const value = Math.round(j.value);
    if (value < 0 || value > 100) {
      return {
        ok: false,
        error: "Fear & Greed 지수 범위 오류",
        previousDisplayedValue,
      };
    }

    const sourceName =
      typeof j.source === "string" ? j.source : CNN_FEAR_GREED_SOURCE_NAME;
    if (!sourceName.startsWith("CNN")) {
      return {
        ok: false,
        error: "허용되지 않은 Fear & Greed 출처입니다.",
        previousDisplayedValue,
      };
    }

    const requestUrl =
      typeof j.requestUrl === "string"
        ? j.requestUrl
        : "";

    const rawIndexTs =
      typeof j.indexTimestamp === "string" ? j.indexTimestamp : null;
    const indexAsOf =
      rawIndexTs && rawIndexTs.trim() ? new Date(rawIndexTs) : null;
    const indexAsOfValid =
      indexAsOf && !isNaN(indexAsOf.getTime()) ? indexAsOf : null;

    const iso = new Date().toISOString();
    const save = saveFearGreed(
      value,
      iso,
      indexAsOfValid ? indexAsOfValid.toISOString() : null
    );
    if (!save.ok) {
      return {
        ok: false,
        error: "로컬 저장에 실패했습니다.",
        previousDisplayedValue,
      };
    }

    return {
      ok: true,
      value,
      lastUpdatedAt: new Date(iso),
      indexAsOf: indexAsOfValid,
      sourceName,
      requestUrl,
      rawPayload: j.raw ?? j,
      parsedLatestValue: value,
      indexDateIso: indexAsOfValid ? indexAsOfValid.toISOString() : null,
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
