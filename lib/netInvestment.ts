/**
 * 순투자금·수익·수익률 — AssetPortfolioDashboard `investmentKRW` 및
 * AssetSummaryCards(스냅샷 필드 없을 때)와 동일한 현금흐름 규칙.
 *
 * 데이터 원천: Supabase `cashflow` 테이블 (getCashflows / 클라이언트와 동일 스키마).
 * - snapshot_date(포함) 이전의 flow_date 만 합산
 * - DEPOSIT: +amount, WITHDRAW: -amount
 * - DIVIDEND: 순투자금에서 제외 (대시보드 수익률과 동일)
 */

import type { AssetSnapshot, Cashflow } from "@/types/assets";

/** KST 기준 오늘 날짜 YYYY-MM-DD (`flow_date`·스냅샷 날짜와 동일 형식) */
export function todayDateStringKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date()
  );
}

/** YYYY-MM-DD 문자열 비교 (로컬 날짜 기준) */
export function flowDateOnOrBefore(flowDate: string, asOfInclusive: string): boolean {
  return flowDate.localeCompare(asOfInclusive) <= 0;
}

/**
 * 해당 일자까지의 순투자금(KRW) = 누적 입금 − 누적 출금.
 * cashflow 행이 하나도 없으면 null (계산 불가).
 */
export function netInvestmentKrwFromCashflowsUpTo(
  cashflows: Cashflow[],
  asOfDateInclusive: string
): number | null {
  if (cashflows.length === 0) return null;

  let sum = 0;
  for (const cf of cashflows) {
    if (!flowDateOnOrBefore(cf.flow_date, asOfDateInclusive)) continue;
    if (cf.type === "DEPOSIT") sum += cf.amount;
    else if (cf.type === "WITHDRAW") sum -= cf.amount;
  }
  return sum;
}

/**
 * profit = total_asset − net_investment (net이 숫자일 때 항상).
 * return_rate = net_investment > 0 일 때만 (profit / net_investment) * 100, 그 외 null.
 */
export function profitAndReturnRateFromTotalAndNet(
  totalAsset: number,
  netInvestment: number | null
): { profit: number | null; return_rate: number | null } {
  if (netInvestment === null) return { profit: null, return_rate: null };

  const profit = totalAsset - netInvestment;
  const return_rate = netInvestment > 0 ? (profit / netInvestment) * 100 : null;
  return { profit, return_rate };
}

/**
 * 스냅샷 요약 행용: total_asset과 cashflow로 net / profit / return_rate 계산.
 */
export function computeSnapshotInvestmentMetrics(
  snapshotDate: string,
  totalAsset: number,
  cashflows: Cashflow[]
): {
  net_investment: number | null;
  profit: number | null;
  return_rate: number | null;
} {
  const net_investment = netInvestmentKrwFromCashflowsUpTo(cashflows, snapshotDate);
  const { profit, return_rate } = profitAndReturnRateFromTotalAndNet(totalAsset, net_investment);
  return { net_investment, profit, return_rate };
}

/**
 * 수익률을 UI에 표시할 **퍼센트 숫자**(퍼센트 포인트)로 맞춥니다.
 *
 * - 앱·`profitAndReturnRateFromTotalAndNet`가 쓰는 규칙: (profit / net) × 100 → 29.5 = 29.5%.
 * - 레거시·엑셀 등에서 소수(0.295)로 저장된 값은 profit·net과의 거리로 판별해 ×100 보정합니다.
 * - 검증에 쓸 profit이 없거나 net≤0이면 DB 값을 그대로 둡니다(추가 보정 없음).
 */
export function snapshotReturnRatePercentForDisplay(
  snap: Pick<AssetSnapshot, "total_asset" | "net_investment" | "profit" | "return_rate">
): number | null {
  const net = snap.net_investment;
  const profitFromDb =
    snap.profit != null && Number.isFinite(snap.profit) ? snap.profit : null;
  const profit =
    profitFromDb ??
    (net != null && Number.isFinite(net) && Number.isFinite(snap.total_asset)
      ? snap.total_asset - net
      : null);

  const db =
    snap.return_rate != null && Number.isFinite(snap.return_rate)
      ? snap.return_rate
      : null;

  if (net != null && net > 0 && profit !== null) {
    const computedPercent = (profit / net) * 100;
    if (db !== null) {
      const errAsPercentPoints = Math.abs(db - computedPercent);
      const errIfDbWasDecimal = Math.abs(db * 100 - computedPercent);
      if (errIfDbWasDecimal < errAsPercentPoints - 1e-9) {
        return db * 100;
      }
      return db;
    }
    return computedPercent;
  }

  return db;
}

/** `snapshotReturnRatePercentForDisplay` 결과(퍼센트 숫자)를 "+29.50%" 형태로 */
export function formatReturnRatePercentPoints(percentPoints: number): string {
  const sign = percentPoints >= 0 ? "+" : "";
  return `${sign}${percentPoints.toFixed(2)}%`;
}
