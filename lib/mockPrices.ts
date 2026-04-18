/**
 * Mock current price provider.
 *
 * Replace `getPriceProvider()` with a real API adapter (e.g., Yahoo Finance,
 * KIS Developers, Polygon.io) without touching any other file.
 */

export interface PriceProvider {
  getPrice(symbol: string, currency: string): Promise<number | null>;
}

// ---------------------------------------------------------------------------
// Mock implementation — returns hardcoded prices for known symbols
// ---------------------------------------------------------------------------

// Yahoo Finance 2026-04-17 종가 기준 (환율 폴백 전용 — 개별 종목 시세에는 사용 안 함)
// ⚠️  이 값들은 실시간 시세가 아닙니다. /api/price 조회 실패 시에만
//    환율(USDKRW) 계산에 사용됩니다. 종목 현재가 표시에는 쓰이지 않습니다.
export const MOCK_PRICES: Record<string, number> = {
  // KRX (KRW) — 참고용. 실제 시세 표시에는 사용되지 않음
  "005930": 55600,
  "000660": 186600,
  "032830": 254500,   // 삼성생명 2026-04-17 기준
  "079550": 167500,
  "003230": 1175000,
  "012330": 234000,
  "005380": 157200,
  "012450": 734000,
  // US (USD) — 참고용. 실제 시세 표시에는 사용되지 않음
  NVDA: 104.49,
  ETN: 277.94,
  GOOGL: 153.95,
  TSM: 154.89,
  EMR: 101.81,
  PLTR: 84.19,
  SNDK: 37.99,
  META: 503.33,
  HII: 168.88,
  // 환율 — readStoredUsdKrwRate() 최초 폴백 전용
  USDKRW: 1418,
  // 현금·채권 (단가 = 1) — FIXED_PRICE_SYMBOLS에서 처리되므로 실제 미사용
  KRW_CASH: 1,
  BOND_USD: 1,
  USD_CASH: 1,
};

class MockPriceProvider implements PriceProvider {
  async getPrice(symbol: string): Promise<number | null> {
    return MOCK_PRICES[symbol.toUpperCase()] ?? MOCK_PRICES[symbol] ?? null;
  }
}

// Singleton — swap this out to switch providers
let _provider: PriceProvider = new MockPriceProvider();

export function getPriceProvider(): PriceProvider {
  return _provider;
}

/** Call this at startup to inject a real provider */
export function setPriceProvider(p: PriceProvider) {
  _provider = p;
}

export async function getCurrentPrice(
  symbol: string,
  currency: string
): Promise<number | null> {
  return _provider.getPrice(symbol, currency);
}
