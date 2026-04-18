/**
 * 목표 비중(min/max, %)과 현재 비중을 비교해 BUY / HOLD / SELL 신호를 계산합니다.
 * 주식(STOCK) 전용 — min·max가 모두 유효할 때만 신호를 표시합니다.
 */

export type AllocationSignal = "BUY" | "HOLD" | "SELL";

export function hasValidTargetBand(
  min: number | undefined | null,
  max: number | undefined | null
): boolean {
  return (
    min != null &&
    max != null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min <= max
  );
}

function fmtPctToken(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1).replace(/\.0$/, "");
}

/** 예: "20% ~ 30%" */
export function formatTargetRange(min: number, max: number): string {
  return `${fmtPctToken(min)}% ~ ${fmtPctToken(max)}%`;
}

/**
 * - weight < min → BUY, 차이 = weight − min (예: -8%)
 * - weight > max → SELL, 차이 = weight − max (예: +5%)
 * - 그 외 HOLD
 */
export function computeAllocationSignal(
  weightPercent: number,
  min: number,
  max: number
): { status: AllocationSignal; diffPercent: number | null } {
  if (weightPercent < min) {
    return { status: "BUY", diffPercent: weightPercent - min };
  }
  if (weightPercent > max) {
    return { status: "SELL", diffPercent: weightPercent - max };
  }
  return { status: "HOLD", diffPercent: null };
}

/** BUY/SELL 시 표시용: "+5%", "-8%" */
export function formatDiffLabel(diffPercent: number): string {
  const r = Math.round(diffPercent * 10) / 10;
  const body = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return `${r > 0 ? "+" : ""}${body}%`;
}
