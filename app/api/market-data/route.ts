import { NextResponse } from "next/server";

import { fetchMarketDataBundleFromDb } from "@/lib/marketDataDb";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const IS_DEV = process.env.NODE_ENV === "development";

function missingEnvResponse() {
  return NextResponse.json(
    { ok: false, error: "Supabase 환경변수가 설정되지 않았습니다." },
    { status: 500 }
  );
}

/** GET — DB market_data_cache 기준 환율·Fear&Greed·종목가 */
export async function GET(request: Request) {
  try {
    if (IS_DEV) {
      console.log("[market-data] GET", { requestUrl: request.url });
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (!url || !key) {
      return missingEnvResponse();
    }

    const bundle = await fetchMarketDataBundleFromDb(supabase);

    return NextResponse.json({
      ok: true as const,
      usdKrw: {
        rate: bundle.usdKrw.rate,
        lastUpdatedAt: bundle.usdKrw.lastUpdatedAt?.toISOString() ?? null,
        status: bundle.usdKrw.status,
      },
      fearGreed: {
        value: bundle.fearGreed.value,
        lastUpdatedAt: bundle.fearGreed.lastUpdatedAt?.toISOString() ?? null,
        indexAsOf: bundle.fearGreed.indexAsOf?.toISOString() ?? null,
        status: bundle.fearGreed.status,
      },
      quotes: bundle.quotes,
      quotesMeta: Object.fromEntries(
        Object.entries(bundle.quotesMeta).map(([k, v]) => [
          k,
          {
            ...v,
            updatedAt: v.updatedAt?.toISOString() ?? null,
          },
        ])
      ),
      lastQuoteRefreshAt: bundle.lastQuoteRefreshAt?.toISOString() ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.error("[market-data] GET 처리 중 예외:", {
        requestUrl: request.url,
        error: msg.slice(0, 200),
        stack: e instanceof Error ? e.stack : undefined,
      });
    } else {
      console.error("[market-data] GET 처리 중 예외:", msg.slice(0, 200));
    }
    return NextResponse.json(
      { ok: false as const, error: msg || "서버 오류" },
      { status: 500 }
    );
  }
}
