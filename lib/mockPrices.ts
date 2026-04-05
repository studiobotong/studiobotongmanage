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

const MOCK_PRICES: Record<string, number> = {
  // KRX (KRW)
  "005930": 75000,
  "000660": 185000,
  "032830": 108500,
  "079550": 215000,
  "003230": 850000,
  "012330": 215000,
  "005380": 200000,
  "012450": 620000,
  // US (USD)
  PLTR: 25.5,
  NVDA: 875.0,
  ETN: 238.0,
  GOOGL: 175.0,
  LEU: 45.0,
  TSM: 148.0,
  SNDK: 68.0,
  EMR: 108.0,
  META: 510.0,
  HII: 280.0,
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
