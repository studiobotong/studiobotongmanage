/**
 * lib/transactionCalculator.ts
 *
 * 공통 포맷 유틸리티.
 * 거래원장 기반 계산 로직(aggregateTransactions, enrichWithPrices 등)은 제거되었습니다.
 */

export function formatCurrency(value: number, currency: string): string {
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (currency === "KRW") {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 100_000_000) {
      const eok = Math.floor(abs / 100_000_000);
      const man = Math.floor((abs % 100_000_000) / 10_000);
      return man > 0
        ? `${sign}${eok}억 ${man.toLocaleString()}만원`
        : `${sign}${eok}억원`;
    }
    if (abs >= 10_000) {
      return `${sign}${Math.floor(abs / 10_000).toLocaleString()}만원`;
    }
    return `${value.toLocaleString()}원`;
  }
  return value.toLocaleString();
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
