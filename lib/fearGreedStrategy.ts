/**
 * Fear & Greed 지수 구간별 권장 현금 비중(중간값) 및 제안 문구.
 * 지수 값은 CNN 미국 주식 Fear & Greed(0~100)를 전제로 합니다.
 */

export type FearGreedZoneKey =
  | "extreme_fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme_greed";

export type FearGreedBand = {
  zone: FearGreedZoneKey;
  /** 한글 상태 텍스트 */
  labelKo: string;
  /** 권장 현금 비중 구간 [%] */
  cashRange: { min: number; max: number };
  /** 권장 현금 비중 중간값 [%] */
  recommendedCashMidPct: number;
};

export function bandFromIndex(value: number): FearGreedBand {
  const v = Math.max(0, Math.min(100, Math.round(value)));

  if (v <= 24) {
    return {
      zone: "extreme_fear",
      labelKo: "극단적 공포",
      cashRange: { min: 5, max: 10 },
      recommendedCashMidPct: 7.5,
    };
  }
  if (v <= 44) {
    return {
      zone: "fear",
      labelKo: "공포",
      cashRange: { min: 10, max: 15 },
      recommendedCashMidPct: 12.5,
    };
  }
  if (v <= 55) {
    return {
      zone: "neutral",
      labelKo: "중립",
      cashRange: { min: 15, max: 20 },
      recommendedCashMidPct: 17.5,
    };
  }
  if (v <= 74) {
    return {
      zone: "greed",
      labelKo: "탐욕",
      cashRange: { min: 20, max: 25 },
      recommendedCashMidPct: 22.5,
    };
  }
  return {
    zone: "extreme_greed",
    labelKo: "극단적 탐욕",
    cashRange: { min: 25, max: 35 },
    recommendedCashMidPct: 30,
  };
}

const GAP_EPS = 1;

export type CashStrategySuggestion = {
  /** 권장 − 현재 [%]. 양수면 현금 확보 쪽, 음수면 현금 여유(주식 확대 여지) */
  gapPct: number;
  headline: string;
  detail: string;
};

/**
 * @param currentCashPct 현재 현금 비중 (%)
 * @param recommendedMidPct 권장 현금 비중 중간값 (%)
 */
export function suggestCashStrategy(
  currentCashPct: number,
  recommendedMidPct: number
): CashStrategySuggestion {
  const gapPct = recommendedMidPct - currentCashPct;

  if (gapPct > GAP_EPS) {
    return {
      gapPct,
      headline: `현금 ${gapPct.toFixed(1)}% 추가 확보 권장`,
      detail:
        "신규 매수는 보수적으로 · SELL 후보 종목 정리를 우선 고려해 보세요.",
    };
  }
  if (gapPct < -GAP_EPS) {
    return {
      gapPct,
      headline: "현금 충분 / BUY·분할매수 검토 가능",
      detail: `권장 대비 현금이 약 ${Math.abs(gapPct).toFixed(1)}% 많은 편입니다. 종목별 분할 매수·비중 확대를 검토해 보세요.`,
    };
  }
  return {
    gapPct,
    headline: "현금 비중이 권장 구간과 유사",
    detail: "시장 심리에 맞춰 큰 증감 없이 유지해도 됩니다.",
  };
}

export type DefensiveStrategySuggestion = {
  /** 권장 − 현재 [%]. 양수면 방어자산 확보 쪽, 음수면 방어자산 여유 */
  gapPct: number;
  headline: string;
  detail: string;
};

/**
 * 예수금+채권(방어자산) 비중 vs 권장 중간값 비교 제안.
 */
export function suggestDefensiveAssetStrategy(
  currentDefensivePct: number,
  recommendedMidPct: number
): DefensiveStrategySuggestion {
  const gapPct = recommendedMidPct - currentDefensivePct;

  if (gapPct > GAP_EPS) {
    return {
      gapPct,
      headline: `방어자산 ${gapPct.toFixed(1)}% 추가 확보 권장`,
      detail: "신규 매수 보수적 / SELL 종목 우선 정리",
    };
  }
  if (gapPct < -GAP_EPS) {
    return {
      gapPct,
      headline: "방어자산 충분",
      detail: "BUY 종목 중심 분할매수 가능",
    };
  }
  return {
    gapPct,
    headline: "방어자산이 권장 구간과 유사",
    detail: "시장 심리에 맞춰 큰 증감 없이 유지해도 됩니다.",
  };
}
