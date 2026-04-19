import { NextRequest, NextResponse } from "next/server";

import {
  CNN_FEAR_GREED_FETCH_HEADERS,
  CNN_FEAR_GREED_GRAPH_URL,
  CNN_FEAR_GREED_SOURCE_NAME,
  parseCnnFearGreedGraphJson,
} from "@/lib/cnnFearGreed";
import { applyStockPricesToLatestHoldings } from "@/lib/applyMarketPricesToHoldings";
import { priceInputsFromHoldings } from "@/lib/holdingsQuoteTargets";
import {
  FEAR_GREED_CACHE_MARKET,
  FEAR_GREED_CACHE_SYMBOL,
  FEAR_GREED_KEY,
  FX_CACHE_MARKET,
  FX_CACHE_SYMBOL,
  FX_KEY,
  fetchMarketDataBundleFromDb,
  makeQuoteCacheKey,
  upsertMarketRow,
} from "@/lib/marketDataDb";
import {
  classifyPriceInputMarket,
  extractUsdKrwFromPayload,
  type PriceInput,
  toYahooSymbol,
} from "@/lib/priceService";
import { fetchLatestHoldings, originFromRequest } from "@/lib/snapshotAutoSave";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

const USDKRW_YAHOO = "USDKRW=X";

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * market_data_cache 규칙 (key / market / symbol)
 * - FX:USDKRW — market='FX', symbol='USDKRW'
 * - SENTIMENT:FEAR_GREED — market='INDEX', symbol='FEAR_GREED'
 * - US:NVDA — market='US', symbol='NVDA'
 * - KRX:032830 — market='KRX', symbol='032830'
 */

/** 서버 → 내부 GET /api/price?symbols=… → `{ ok, prices }` 에서 prices 만 추출 */
async function parseInternalPriceGet(
  res: Response,
  label: string,
  requestUrl: string
): Promise<Record<string, number | null> | null> {
  const text = await res.text();
  const preview = text.slice(0, 200);
  if (!text.trim()) {
    if (IS_DEV) {
      console.warn("[market-data/refresh] 내부 /api/price 빈 본문", {
        label,
        requestUrl,
        status: res.status,
      });
    }
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.warn("[market-data/refresh] 내부 /api/price JSON 파싱 실패", {
        label,
        requestUrl,
        status: res.status,
        contentType: res.headers.get("content-type"),
        preview,
        error: msg,
      });
    }
    return null;
  }
  if (parsed && typeof parsed === "object" && parsed !== null && "ok" in parsed) {
    const o = parsed as {
      ok?: boolean;
      prices?: Record<string, number | null>;
      error?: string;
    };
    if (o.ok === false) {
      if (IS_DEV) {
        console.warn("[market-data/refresh] 내부 /api/price ok:false", {
          label,
          requestUrl,
          error: o.error,
        });
      }
      return null;
    }
    if (o.ok === true && o.prices && typeof o.prices === "object") {
      return o.prices;
    }
  }
  if (IS_DEV) {
    console.warn("[market-data/refresh] 내부 /api/price 응답 형식 불일치", {
      label,
      requestUrl,
      preview,
    });
  }
  return null;
}

/** 서버 → 내부 GET /api/price/krx */
async function parseInternalKrxGet(
  res: Response,
  label: string,
  requestUrl: string
): Promise<{ price: number | null } | null> {
  const text = await res.text();
  const preview = text.slice(0, 200);
  if (!text.trim()) {
    if (IS_DEV) {
      console.warn("[market-data/refresh] 내부 /api/price/krx 빈 본문", {
        label,
        requestUrl,
        status: res.status,
      });
    }
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.warn("[market-data/refresh] 내부 /api/price/krx JSON 파싱 실패", {
        label,
        requestUrl,
        status: res.status,
        preview,
        error: msg,
      });
    }
    return null;
  }
  if (parsed && typeof parsed === "object" && parsed !== null && "ok" in parsed) {
    const o = parsed as { ok?: boolean; price?: number | null; error?: string };
    if (o.ok === false) {
      if (IS_DEV) {
        console.warn("[market-data/refresh] 내부 /api/price/krx ok:false", {
          label,
          requestUrl,
          error: o.error,
        });
      }
      return null;
    }
    if (o.ok === true) {
      return { price: o.price ?? null };
    }
  }
  return null;
}

function missingEnvResponse() {
  return NextResponse.json(
    { ok: false, error: "Supabase 환경변수가 설정되지 않았습니다." },
    { status: 500 }
  );
}

function fromYahooSymbol(yahooSymbol: string): string {
  if (yahooSymbol.endsWith(".KS") || yahooSymbol.endsWith(".KQ")) {
    return yahooSymbol.slice(0, -3);
  }
  return yahooSymbol;
}

function storageMarketForQuote(h: PriceInput): "KRX" | "US" {
  const m = classifyPriceInputMarket(h);
  if (m === "KRX") return "KRX";
  return "US";
}

async function fetchUsdKrwFromInternalApi(
  base: string,
  internalInit: RequestInit
): Promise<{
  rate: number | null;
  source: string;
  httpStatus: number;
  priceKeys: string[];
}> {
  const url = `${base}/api/price?symbols=${encodeURIComponent(USDKRW_YAHOO)}`;
  const res = await fetch(url, internalInit);
  if (!res.ok) {
    return {
      rate: null,
      source: "http_error",
      httpStatus: res.status,
      priceKeys: [],
    };
  }
  const data = await parseInternalPriceGet(res, "usdKrw", url);
  const priceKeys = data ? Object.keys(data as Record<string, number | null>) : [];
  if (!data) {
    return {
      rate: null,
      source: "parse_error",
      httpStatus: res.status,
      priceKeys,
    };
  }
  const { rate } = extractUsdKrwFromPayload(data as Record<string, unknown>, USDKRW_YAHOO);
  return {
    rate,
    source: "yahoo_stooq_open_er",
    httpStatus: res.status,
    priceKeys,
  };
}

async function fetchKrxPriceInternal(
  base: string,
  symbol: string,
  internalInit: RequestInit
): Promise<number | null> {
  const url = `${base}/api/price/krx?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, internalInit);
  if (!res.ok) return null;
  const data = await parseInternalKrxGet(res, "krx", url);
  if (!data) return null;
  const p = data.price;
  return typeof p === "number" && p > 0 ? p : null;
}

async function fetchUsBatchInternal(
  base: string,
  yahooSymbols: string[],
  internalInit: RequestInit
): Promise<Record<string, number | null>> {
  if (yahooSymbols.length === 0) return {};
  const url = `${base}/api/price?symbols=${encodeURIComponent(yahooSymbols.join(","))}`;
  const res = await fetch(url, internalInit);
  if (!res.ok) return {};
  const data = await parseInternalPriceGet(res, "usBatch", url);
  if (!data) return {};
  const out: Record<string, number | null> = {};
  for (const [yahooSym, price] of Object.entries(data)) {
    out[fromYahooSymbol(yahooSym)] = price;
  }
  return out;
}

/**
 * POST — 외부 조회 후 market_data_cache 저장 (옵션: holdings 반영)
 *
 * Body:
 * - manualFx?: number — 수동 환율 (우선 처리)
 * - fx?: boolean — USD/KRW API 조회 후 DB 저장
 * - fearGreed?: boolean — CNN 조회 후 DB 저장
 * - fromHoldings?: boolean — true일 때만 asset_snapshot_holdings 최신 일자 STOCK으로 시세 조회·캐시 upsert
 * - applyHoldings?: boolean — 조회한 종목가를 최신 holdings 행에 반영 (기본 true)
 *
 * 종목 시세 목록은 서버가 holdings에서만 계산합니다. 클라이언트가 임의 symbol 목록을 보내지 않습니다.
 */
export async function POST(request: NextRequest) {
  const routePath = request.nextUrl?.pathname ?? "/api/market-data/refresh";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
    if (!url || !key) {
      return missingEnvResponse();
    }

    if (IS_DEV) {
      console.log("[market-data/refresh] POST", {
        requestUrl: request.url,
        routePath,
      });
    }

    const rawBodyText = await request.text();
    let body: {
      manualFx?: number;
      fx?: boolean;
      fearGreed?: boolean;
      fromHoldings?: boolean;
      applyHoldings?: boolean;
    };
    if (!rawBodyText.trim()) {
      return NextResponse.json(
        { ok: false, error: "JSON 본문이 필요합니다." },
        { status: 400 }
      );
    }
    try {
      body = JSON.parse(rawBodyText) as typeof body;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (IS_DEV) {
        console.warn("[market-data/refresh] 요청 본문 JSON 파싱 실패", {
          routePath,
          preview: rawBodyText.slice(0, 200),
          error: msg,
        });
      }
      return NextResponse.json(
        { ok: false, error: "유효한 JSON 본문이 필요합니다." },
        { status: 400 }
      );
    }

    const base = originFromRequest(request);
    const forwardCookie = request.headers.get("cookie");
    const internalInit: RequestInit = {
      cache: "no-store",
      ...(forwardCookie ? { headers: { Cookie: forwardCookie } } : {}),
    };

    if (IS_DEV) {
      console.log("[market-data/refresh] 요청 body", {
        routePath,
        body,
        base,
        internalFetchCookieForwarded: Boolean(forwardCookie),
      });
    }

    const steps: Record<string, string> = {};
    const failures: string[] = [];
    const iso = () => new Date().toISOString();

    // 1) 수동 환율
    if (
      typeof body.manualFx === "number" &&
      !Number.isNaN(body.manualFx) &&
      body.manualFx > 100
    ) {
      const row = {
        key: FX_KEY,
        category: "fx" as const,
        symbol: FX_CACHE_SYMBOL,
        market: FX_CACHE_MARKET,
        value_numeric: body.manualFx,
        value_text: null,
        currency: "KRW",
        source: "manual",
        status: "manual",
        updated_at: iso(),
      };
      if (IS_DEV) {
        console.log("[market-data/refresh] manualFx upsert payload", row);
      }
      const r = await upsertMarketRow(supabase, row);
      steps.manualFx = r.ok ? "ok" : `error:${r.error}`;
      if (IS_DEV) {
        console.log("[market-data/refresh] manualFx upsert", {
          ok: r.ok,
          error: r.ok ? undefined : r.error,
        });
      }
      if (!r.ok) failures.push(`manualFx:${r.error}`);
    }

    // 2) 환율 API
    if (body.fx === true) {
      const urlFx = `${base}/api/price?symbols=${encodeURIComponent(USDKRW_YAHOO)}`;
      const fxFetch = await fetchUsdKrwFromInternalApi(base, internalInit);
      if (IS_DEV) {
        console.log("[market-data/refresh] 내부 GET /api/price (USDKRW)", {
          requestUrl: urlFx,
          httpStatus: fxFetch.httpStatus,
          priceKeys: fxFetch.priceKeys,
          rate: fxFetch.rate,
          source: fxFetch.source,
        });
      }
      const { rate, source } = fxFetch;
      if (rate != null && rate > 100) {
        const row = {
          key: FX_KEY,
          category: "fx" as const,
          symbol: FX_CACHE_SYMBOL,
          market: FX_CACHE_MARKET,
          value_numeric: rate,
          value_text: null,
          currency: "KRW",
          source,
          status: "live",
          updated_at: iso(),
        };
        if (IS_DEV) {
          console.log("[market-data/refresh] fx upsert payload", row);
        }
        const r = await upsertMarketRow(supabase, row);
        steps.fx = r.ok ? "ok" : `error:${r.error}`;
        if (IS_DEV) {
          console.log("[market-data/refresh] fx upsert", {
            ok: r.ok,
            error: r.ok ? undefined : r.error,
          });
        }
        if (!r.ok) failures.push(`fx_upsert:${r.error}`);
      } else {
        steps.fx = "fetch_failed";
        failures.push(
          "fx:실시간_환율_조회_실패(/api/price 응답에 유효한 USDKRW 가 없음)"
        );
      }
    }

    // 3) 종목가 — fromHoldings=true 일 때만: asset_snapshot_holdings 최신 일자 STOCK → 파생 캐시
    let priceInputs: PriceInput[] = [];
    if (body.fromHoldings === true) {
      const { holdings, sourceSnapshotDate } = await fetchLatestHoldings(supabase);
      priceInputs = priceInputsFromHoldings(holdings);
      steps.fromHoldings = `symbols:${priceInputs.length}`;
      if (IS_DEV) {
        console.log("[market-data/refresh] holdings 기준 종목 목록", {
          sourceSnapshotDate,
          targets: priceInputs.map((p) => ({
            symbol: p.symbol,
            currency: p.currency,
            market: p.market,
          })),
        });
      }
    }

    const applyHoldings = body.applyHoldings !== false;
    const priceMap: Record<string, number> = {};
    /** 이번 요청에서 조회한 시세 행의 공통 updated_at (응답 lastQuoteRefreshAt 용) */
    let quoteBatchAt: string | null = null;

    if (priceInputs.length > 0) {
      quoteBatchAt = iso();
      const krxItems: PriceInput[] = [];
      const usItems: PriceInput[] = [];
      for (const h of priceInputs) {
        const m = classifyPriceInputMarket(h);
        if (m === "KRX") krxItems.push(h);
        else if (m !== "CASH") usItems.push(h);
      }

      for (const h of krxItems) {
        const krxUrl = `${base}/api/price/krx?symbol=${encodeURIComponent(h.symbol)}`;
        const p = await fetchKrxPriceInternal(base, h.symbol, internalInit);
        if (IS_DEV) {
          console.log("[market-data/refresh] 내부 GET /api/price/krx", {
            requestUrl: krxUrl,
            symbol: h.symbol,
            price: p,
          });
        }
        if (p != null && p > 0) {
          priceMap[h.symbol] = p;
          const mkt = storageMarketForQuote(h);
          const cacheKey = makeQuoteCacheKey(mkt, h.symbol);
          const row = {
            key: cacheKey,
            category: "quote" as const,
            symbol: h.symbol.trim(),
            market: mkt,
            value_numeric: p,
            value_text: null,
            currency: h.currency ?? "KRW",
            source: "naver_krx",
            status: "live",
            updated_at: quoteBatchAt,
          };
          if (IS_DEV) {
            console.log("[market-data/refresh] quote upsert payload (KRX)", row);
          }
          const ur = await upsertMarketRow(supabase, row);
          if (IS_DEV) {
            console.log("[market-data/refresh] quote upsert (KRX)", {
              key: cacheKey,
              ok: ur.ok,
              error: ur.ok ? undefined : ur.error,
            });
          }
          if (!ur.ok) failures.push(`quote_upsert:${cacheKey}:${ur.error}`);
        }
      }

      if (usItems.length > 0) {
        const yahooSymbols = [
          ...new Set(usItems.map((h) => toYahooSymbol(h.symbol, h.currency))),
        ];
        const batchUrl = `${base}/api/price?symbols=${encodeURIComponent(yahooSymbols.join(","))}`;
        const batch = await fetchUsBatchInternal(base, yahooSymbols, internalInit);
        if (IS_DEV) {
          console.log("[market-data/refresh] 내부 GET /api/price (US batch)", {
            requestUrl: batchUrl,
            yahooSymbols,
            batchKeys: Object.keys(batch),
            batch,
          });
        }
        for (const h of usItems) {
          const p = batch[h.symbol];
          if (p != null && p > 0) {
            priceMap[h.symbol] = p;
            const mkt = storageMarketForQuote(h);
            const cacheKey = makeQuoteCacheKey(mkt, h.symbol);
            const row = {
              key: cacheKey,
              category: "quote" as const,
              symbol: h.symbol.trim(),
              market: mkt,
              value_numeric: p,
              value_text: null,
              currency: h.currency ?? "USD",
              source: "yahoo",
              status: "live",
              updated_at: quoteBatchAt,
            };
            if (IS_DEV) {
              console.log("[market-data/refresh] quote upsert payload (US)", row);
            }
            const ur = await upsertMarketRow(supabase, row);
            if (IS_DEV) {
              console.log("[market-data/refresh] quote upsert (US)", {
                key: cacheKey,
                ok: ur.ok,
                error: ur.ok ? undefined : ur.error,
              });
            }
            if (!ur.ok) failures.push(`quote_upsert:${cacheKey}:${ur.error}`);
          }
        }
      }

      steps.quotes = `ok:${Object.keys(priceMap).length}`;

      if (
        body.fromHoldings === true &&
        priceInputs.length > 0 &&
        Object.keys(priceMap).length === 0
      ) {
        failures.push(
          "quotes:보유_STOCK_종목이_있으나_모든_시세_조회에_실패했습니다"
        );
      }

      if (applyHoldings && Object.keys(priceMap).length > 0) {
        const { updatedRows } = await applyStockPricesToLatestHoldings(
          supabase,
          priceMap
        );
        steps.applyHoldings = `updated:${updatedRows}`;
        if (IS_DEV) {
          console.log("[market-data/refresh] applyStockPricesToLatestHoldings", {
            updatedRows,
          });
        }
      }
    }

    // 4) Fear & Greed
    if (body.fearGreed === true) {
      try {
        const res = await fetch(CNN_FEAR_GREED_GRAPH_URL, {
          cache: "no-store",
          headers: CNN_FEAR_GREED_FETCH_HEADERS,
        });
        const text = await res.text();
        if (IS_DEV) {
          console.log("[market-data/refresh] CNN Fear&Greed 외부 응답", {
            httpStatus: res.status,
            bodyPreview: text.slice(0, 300),
          });
        }
        let rawBody: unknown;
        try {
          rawBody = JSON.parse(text) as unknown;
        } catch {
          steps.fearGreed = "parse_json_failed";
          rawBody = null;
        }

        if (rawBody != null) {
          const parsed = parseCnnFearGreedGraphJson(rawBody);
          if (parsed.ok) {
            const v = Math.round(parsed.parsed.value);
            const meta = JSON.stringify({
              indexTimestamp: parsed.parsed.indexTimestampIso,
            });
            const row = {
              key: FEAR_GREED_KEY,
              category: "sentiment" as const,
              symbol: FEAR_GREED_CACHE_SYMBOL,
              market: FEAR_GREED_CACHE_MARKET,
              value_numeric: v,
              value_text: meta,
              currency: null,
              source: CNN_FEAR_GREED_SOURCE_NAME,
              status: "live",
              updated_at: iso(),
            };
            if (IS_DEV) {
              console.log("[market-data/refresh] fearGreed upsert payload", row);
            }
            const upsert = await upsertMarketRow(supabase, row);
            steps.fearGreed = upsert.ok ? "ok" : `error:${upsert.error}`;
            if (IS_DEV) {
              console.log("[market-data/refresh] fearGreed upsert", {
                ok: upsert.ok,
                error: upsert.ok ? undefined : upsert.error,
              });
            }
            if (!upsert.ok) failures.push(`fearGreed_upsert:${upsert.error}`);
          } else {
            steps.fearGreed = `cnn:${parsed.error}`;
            failures.push(`fearGreed:${parsed.error}`);
          }
        } else {
          failures.push("fearGreed:CNN_본문_JSON_파싱_실패");
        }
      } catch (e) {
        const em = e instanceof Error ? e.message : "network";
        steps.fearGreed = em;
        failures.push(`fearGreed:${em}`);
      }
    }

    const bundle = await fetchMarketDataBundleFromDb(supabase);

    const mergedQuotes = { ...bundle.quotes, ...priceMap };
    const lastQuoteRefreshOut =
      Object.keys(priceMap).length > 0 && quoteBatchAt
        ? quoteBatchAt
        : bundle.lastQuoteRefreshAt?.toISOString() ?? null;

    const payload = {
      ok: true as const,
      steps,
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
      quotes: mergedQuotes,
      lastQuoteRefreshAt: lastQuoteRefreshOut,
    };

    const success = failures.length === 0;
    if (IS_DEV) {
      console.log("[market-data/refresh] 최종 응답", {
        ok: success,
        failures,
        steps,
        summary: payload,
      });
    }

    if (!success) {
      return NextResponse.json(
        {
          ok: false as const,
          error: failures.join(" | "),
          steps,
          usdKrw: payload.usdKrw,
          fearGreed: payload.fearGreed,
          quotes: mergedQuotes,
          lastQuoteRefreshAt: lastQuoteRefreshOut,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const preview = msg.slice(0, 200);
    if (IS_DEV) {
      console.error("[market-data/refresh] POST 처리 중 예외:", {
        routePath,
        error: preview,
        stack: e instanceof Error ? e.stack : undefined,
      });
    } else {
      console.error("[market-data/refresh] POST 처리 중 예외:", preview);
    }
    return NextResponse.json(
      { ok: false as const, error: msg || "서버 오류" },
      { status: 500 }
    );
  }
}
