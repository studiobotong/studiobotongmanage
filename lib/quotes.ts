/**
 * lib/quotes.ts
 *
 * 시세 조회 레이어 — market 기준으로 소스를 분기합니다.
 *
 *   KRX  → fetchKrxPrice()   (네이버 금융 실시간 폴링 API → /api/price/krx 서버 라우트)
 *   US   → fetchUsPrice()    (Yahoo Finance /api/price 경유, 단일 심볼)
 *   CASH → null (조회 없음)
 *
 * 배치 조회(여러 종목 동시)는 lib/priceService.ts 를 사용하세요.
 */

export type QuoteMarket = "KRX" | "US" | "CASH";

// ── KRX 전용 조회 ─────────────────────────────────────────────────────────────
//
// 데이터 소스: 네이버 금융 실시간 폴링 API
//   서버 라우트: /api/price/krx?symbol={symbol}
//   원본 소스:   https://polling.finance.naver.com/api/realtime/domestic/stock/{symbol}
//   (CORS 이슈로 서버사이드 라우트를 경유합니다)

export async function fetchKrxPrice(symbol: string): Promise<number | null> {
  const url = `/api/price/krx?symbol=${encodeURIComponent(symbol)}`;

  console.log("[quotes] ▶ fetchKrxPrice | symbol:", symbol, "| market: KRX");
  console.log("[quotes] ▶ REQUEST URL:", url);

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.warn(
        "[quotes] ✗ /api/price/krx non-ok:",
        res.status,
        "| symbol:",
        symbol
      );
      return null;
    }

    const data: { symbol: string; price: number | null } = await res.json();

    console.log("[quotes] ▶ RAW response:", data);
    console.log("[quotes] ▶ FINAL current_price:", data.price);

    return data.price != null && data.price > 0 ? data.price : null;
  } catch (err) {
    console.error("[quotes] ✗ fetchKrxPrice error | symbol:", symbol, ":", err);
    return null;
  }
}

// ── US 전용 조회 (Yahoo Finance) ──────────────────────────────────────────────
// 단일 심볼 조회. 여러 종목을 동시에 조회할 때는 priceService.ts 의 배치 경로를 사용하세요.

export async function fetchUsPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(
      `/api/price?symbols=${encodeURIComponent(symbol)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data: Record<string, number | null> = await res.json();
    const price = data[symbol];
    return price != null && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// ── 공개 API ──────────────────────────────────────────────────────────────────

/**
 * 단일 종목 현재가 조회.
 *
 * - CASH 또는 심볼 없음 → null
 * - KRX → fetchKrxPrice() (네이버 금융 실시간 폴링 API)
 * - US  → fetchUsPrice()  (Yahoo Finance)
 *
 * 조회 실패·미지원 시 null 반환 → 호출 측에서 "조회 실패" 처리
 */
export async function getCurrentPrice(
  symbol: string,
  market: QuoteMarket
): Promise<number | null> {
  if (!symbol || market === "CASH") return null;
  if (market === "KRX") return fetchKrxPrice(symbol);
  if (market === "US") return fetchUsPrice(symbol);
  return null;
}
