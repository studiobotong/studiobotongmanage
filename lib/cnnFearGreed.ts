/**
 * CNN Fear & Greed (미국 주식) — edition.cnn.com 이 사용하는 dataviz JSON.
 * alternative.me 등 다른 포맷은 명시적으로 거부합니다.
 */

export const CNN_FEAR_GREED_GRAPH_URL =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata" as const;

export const CNN_FEAR_GREED_SOURCE_NAME = "CNN Fear & Greed (미국 주식)" as const;

/** CNN 페이지와 동일 출처 요청 (봇 차단 완화) */
export const CNN_FEAR_GREED_FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://edition.cnn.com/",
  Accept: "application/json",
};

/** alternative.me Crypto Fear & Greed JSON 형태 */
export function isCryptoAlternativeMePayload(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const o = body as Record<string, unknown>;
  if (!Array.isArray(o.data) || o.data.length === 0) return false;
  const row = o.data[0];
  if (!row || typeof row !== "object") return false;
  return "value" in (row as object) && "timestamp" in (row as object);
}

function hasCnnUsEquityIndicators(body: Record<string, unknown>): boolean {
  const mm = body.market_momentum_sp500;
  return (
    mm !== null &&
    typeof mm === "object" &&
    typeof (mm as { score?: unknown }).score === "number"
  );
}

export type ParsedCnnFearGreed = {
  value: number;
  rating: string;
  indexTimestampIso: string;
};

/**
 * CNN graphdata JSON에서 현재 지수만 추출·검증합니다.
 * 최신 시점은 fear_and_greed.timestamp 기준입니다.
 */
export function parseCnnFearGreedGraphJson(
  body: unknown
): { ok: true; parsed: ParsedCnnFearGreed } | { ok: false; error: string } {
  if (isCryptoAlternativeMePayload(body)) {
    return {
      ok: false,
      error:
        "암호화폐 Fear & Greed(alternative.me) 응답으로 보입니다. 미국 주식용 CNN 지수와 형식이 다릅니다.",
    };
  }

  if (!body || typeof body !== "object") {
    return { ok: false, error: "응답 JSON 형식이 올바르지 않습니다." };
  }

  const root = body as Record<string, unknown>;
  if (!hasCnnUsEquityIndicators(root)) {
    return {
      ok: false,
      error:
        "CNN 미국 주식 Fear & Greed 시리즈가 아닙니다. (market_momentum_sp500 없음)",
    };
  }

  const fg = root.fear_and_greed;
  if (!fg || typeof fg !== "object") {
    return { ok: false, error: "fear_and_greed 필드가 없습니다." };
  }

  const fgo = fg as Record<string, unknown>;
  const rawScore = fgo.score;
  const ts = fgo.timestamp;
  const rating = typeof fgo.rating === "string" ? fgo.rating : "";

  if (typeof rawScore !== "number" || !Number.isFinite(rawScore)) {
    return { ok: false, error: "fear_and_greed.score 파싱 실패" };
  }

  const value = Math.round(rawScore);
  if (value < 0 || value > 100) {
    return { ok: false, error: "지수가 0~100 범위를 벗어났습니다." };
  }

  if (typeof ts !== "string" || !ts.trim()) {
    return { ok: false, error: "fear_and_greed.timestamp이 없습니다." };
  }

  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    return { ok: false, error: "fear_and_greed.timestamp 날짜 파싱 실패" };
  }

  return {
    ok: true,
    parsed: {
      value,
      rating,
      indexTimestampIso: d.toISOString(),
    },
  };
}
