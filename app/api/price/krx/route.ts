/**
 * app/api/price/krx/route.ts
 *
 * KRX(국내주식) 현재가 서버사이드 조회 라우트.
 *
 * 데이터 소스: 네이버 금융 실시간 폴링 API
 *   https://polling.finance.naver.com/api/realtime/domestic/stock/{symbol}
 *
 * 클라이언트에서 직접 이 API를 호출하면 CORS 차단이 발생하므로,
 * 서버 라우트를 경유하여 서버→네이버 요청으로 처리합니다.
 *
 * 요청: GET /api/price/krx?symbol=005930
 * 응답: { symbol: "005930", price: 73600 }
 *       실패 시: { symbol: "005930", price: null }
 */

import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const IS_DEV = process.env.NODE_ENV === "development";

const NAVER_POLLING_BASE =
  "https://polling.finance.naver.com/api/realtime/domestic/stock";
const TIMEOUT_MS = 8000;

async function fetchNaverKrxPrice(symbol: string): Promise<number | null> {
  const url = `${NAVER_POLLING_BASE}/${encodeURIComponent(symbol)}`;

  console.log("[krx/route] ▶ symbol:", symbol);
  console.log("[krx/route] ▶ market: KRX");
  console.log("[krx/route] ▶ REQUEST URL:", url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: "https://finance.naver.com/",
      },
    });

    console.log("[krx/route] ▶ RESPONSE status:", res.status, res.statusText);

    if (!res.ok) {
      console.warn(
        "[krx/route] ✗ non-ok response for",
        symbol,
        "→ status:",
        res.status
      );
      return null;
    }

    const rawText = await res.text();
    let data: { datas?: unknown[] };
    try {
      data = JSON.parse(rawText) as { datas?: unknown[] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (IS_DEV) {
        console.warn("[krx/route] 네이버 응답 JSON 파싱 실패", {
          url,
          status: res.status,
          preview: rawText.slice(0, 200),
          error: msg,
        });
      }
      return null;
    }

    // 원본 응답 로그 (길이 제한)
    console.log(
      "[krx/route] ▶ RAW response:",
      JSON.stringify(data).slice(0, 600)
    );

    // 네이버 폴링 API 응답 구조:
    // { datas: [{ closePrice: "73600", openPrice: "...", ... }] }
    // closePrice: 장중에는 현재가, 장 종료 후에는 종가 (문자열, 쉼표 포함 가능)
    const item = data?.datas?.[0] as
      | {
          closePrice?: string | number;
          currentPrice?: string | number;
          stockPrice?: string | number;
        }
      | undefined;
    if (!item) {
      console.warn("[krx/route] ✗ datas[0] not found for", symbol);
      return null;
    }

    // closePrice → 현재가 (장중) / 종가 (장 후)
    // 쉼표 제거 후 파싱
    const rawPrice =
      item.closePrice ?? item.currentPrice ?? item.stockPrice ?? null;

    const price =
      typeof rawPrice === "string"
        ? parseFloat(rawPrice.replace(/,/g, ""))
        : typeof rawPrice === "number"
          ? rawPrice
          : null;

    console.log(
      "[krx/route] ▶ rawPrice field:",
      rawPrice,
      "| FINAL current_price:",
      price
    );

    return price != null && !isNaN(price) && price > 0 ? price : null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      console.error("[krx/route] ✗ TIMEOUT for", symbol, "(8s 초과)");
    } else {
      console.error("[krx/route] ✗ fetch error for", symbol, ":", err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = request.url;
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";

  if (IS_DEV) {
    console.log("[price/krx] GET", { requestUrl, symbol: symbol || "(empty)" });
  }

  if (!symbol) {
    return Response.json(
      { ok: false as const, error: "symbol 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const price = await fetchNaverKrxPrice(symbol);
    return Response.json(
      { ok: true as const, symbol, price },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.error("[price/krx] GET 예외", {
        requestUrl,
        symbol,
        error: msg.slice(0, 300),
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
    return Response.json(
      { ok: false as const, error: msg || "서버 오류" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
