import { NextRequest } from "next/server";

// 항상 동적으로 실행 (정적 최적화 방지)
export const dynamic = "force-dynamic";

const IS_DEV = process.env.NODE_ENV === "development";

/** Yahoo 등 외부 HTTP 응답: text → JSON (빈 본문·깨진 JSON 안전 처리) */
async function readJsonFromExternalResponse(
  res: Response,
  label: string,
  requestUrl: string
): Promise<unknown | null> {
  const text = await res.text();
  const preview = text.slice(0, 200);
  if (!text.trim()) {
    if (IS_DEV) {
      console.warn("[price/route] 외부 API 빈 본문", {
        label,
        requestUrl,
        status: res.status,
      });
    }
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.warn("[price/route] 외부 API JSON 파싱 실패", {
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
}

const YAHOO_V8_BASE   = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_V7_QUOTE  = "https://query2.finance.yahoo.com/v7/finance/quote";
const YAHOO_CRUMB_URL = "https://query2.finance.yahoo.com/v1/test/getcrumb";
const YAHOO_FC_URL    = "https://fc.yahoo.com";
const STOOQ_BASE      = "https://stooq.com/q/l/";
/** USDKRW 최종 백업 — Stooq/Yahoo 모두 실패 시 (open.er-api.com 무료 엔드포인트) */
const OPEN_ER_USD_LATEST = "https://open.er-api.com/v6/latest/USD";
const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN ?? "";
const TIMEOUT_MS = 8000;

const COMMON_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,ko;q=0.8",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

// ── Yahoo Finance crumb 세션 관리 ─────────────────────────────────────────────
// Yahoo Finance는 crumb + cookie 쌍이 있어야 rate limit 없이 조회 가능합니다.
// 약 2시간마다 자동 갱신합니다.

let _crumb: string | null = null;
let _sessionCookie: string | null = null;
let _sessionExpiry = 0;

async function getYahooSession(): Promise<{ crumb: string; cookie: string } | null> {
  if (_crumb && _sessionCookie && Date.now() < _sessionExpiry) {
    return { crumb: _crumb, cookie: _sessionCookie };
  }

  try {
    const fcRes = await fetch(YAHOO_FC_URL, {
      headers: COMMON_HEADERS,
      cache: "no-store",
    });
    const rawCookies = fcRes.headers.getSetCookie?.() ?? [];
    const cookieStr = rawCookies.join("; ");

    if (!cookieStr) {
      console.warn("[price/route] ⚠ Yahoo session: 쿠키 없음");
    }

    const crumbRes = await fetch(YAHOO_CRUMB_URL, {
      headers: { ...COMMON_HEADERS, Cookie: cookieStr },
      cache: "no-store",
    });

    if (!crumbRes.ok) {
      console.warn("[price/route] ⚠ Yahoo crumb 발급 실패:", crumbRes.status);
      return null;
    }

    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes("<") || crumb.length > 30) {
      console.warn("[price/route] ⚠ Yahoo crumb 유효하지 않음:", crumb.substring(0, 40));
      return null;
    }

    _crumb = crumb;
    _sessionCookie = cookieStr;
    _sessionExpiry = Date.now() + 1000 * 60 * 60 * 2; // 2시간 캐시

    console.log("[price/route] ✓ Yahoo 세션 갱신 | crumb:", crumb.substring(0, 8) + "...");
    return { crumb, cookie: cookieStr };
  } catch (err) {
    console.error("[price/route] ✗ Yahoo 세션 발급 에러:", err);
    return null;
  }
}

// ── Yahoo Finance v8/finance/chart ────────────────────────────────────────────

async function fetchViaChart(
  symbol: string,
  session: { crumb: string; cookie: string } | null,
  isDebug: boolean
): Promise<number | null> {
  const crumbParam = session ? `&crumb=${encodeURIComponent(session.crumb)}` : "";
  const url = `${YAHOO_V8_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false${crumbParam}`;

  if (isDebug) {
    console.log("[price/route] ▶ v8/chart | symbol:", symbol, "| crumb:", !!session);
    console.log("[price/route] ▶ REQUEST URL:", url);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { ...COMMON_HEADERS, ...(session ? { Cookie: session.cookie } : {}) },
    });

    if (isDebug) {
      console.log("[price/route] ▶ v8/chart RESPONSE:", res.status, res.statusText);
    }

    if (res.status === 429) {
      console.warn("[price/route] ✗ v8/chart 429 (rate limited) for", symbol);
      return null;
    }
    if (!res.ok) {
      console.warn("[price/route] ✗ v8/chart", res.status, "for", symbol);
      return null;
    }

    const data = (await readJsonFromExternalResponse(res, "v8/chart", url)) as {
      chart?: { result?: unknown[]; error?: unknown };
    } | null;
    if (!data) return null;
    const result0 = data?.chart?.result?.[0] as
      | {
          meta?: {
            symbol?: string;
            regularMarketPrice?: number | null;
            chartPreviousClose?: number | null;
            previousClose?: number | null;
            regularMarketTime?: number;
            currency?: string;
            exchangeName?: string;
            instrumentType?: string;
          };
        }
      | undefined;
    const meta = result0?.meta;

    if (isDebug) {
      console.log("[price/route] ▶ chart.error:", data?.chart?.error);
      console.log("[price/route] ▶ meta fields:", {
        symbol:             meta?.symbol,
        regularMarketPrice: meta?.regularMarketPrice,
        chartPreviousClose: meta?.chartPreviousClose,
        previousClose:      meta?.previousClose,
        regularMarketTime:  meta?.regularMarketTime
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : undefined,
        currency:           meta?.currency,
        exchangeName:       meta?.exchangeName,
        instrumentType:     meta?.instrumentType,
      });
    }

    if (!meta) {
      console.warn("[price/route] ✗ v8/chart: meta 없음 for", symbol,
        "| chart.error:", JSON.stringify(data?.chart?.error));
      return null;
    }

    const price =
      meta.regularMarketPrice != null
        ? (meta.regularMarketPrice as number)
        : meta.chartPreviousClose != null
          ? (meta.chartPreviousClose as number)
          : null;

    if (isDebug) {
      const usedField =
        meta.regularMarketPrice != null ? "regularMarketPrice"
        : meta.chartPreviousClose != null ? "chartPreviousClose (fallback)"
        : "null — 유효 필드 없음";
      console.log("[price/route] ▶ v8/chart FINAL price:", price, "| field:", usedField);
    }

    if (price == null) {
      console.warn("[price/route] ✗ v8/chart null price for", symbol,
        "| regularMarketPrice:", meta?.regularMarketPrice,
        "| chartPreviousClose:", meta?.chartPreviousClose);
    }

    return price;
  } catch (err) {
    console.error("[price/route] ✗ v8/chart 에러 for", symbol, ":", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Yahoo Finance v7/finance/quote ────────────────────────────────────────────

async function fetchViaYahooQuote(
  symbol: string,
  session: { crumb: string; cookie: string } | null,
  isDebug: boolean
): Promise<number | null> {
  const crumbParam = session ? `&crumb=${encodeURIComponent(session.crumb)}` : "";
  const url = `${YAHOO_V7_QUOTE}?symbols=${encodeURIComponent(symbol)}&fields=regularMarketPrice,regularMarketPreviousClose${crumbParam}`;

  if (isDebug) {
    console.log("[price/route] ▶ v7/quote | symbol:", symbol);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { ...COMMON_HEADERS, ...(session ? { Cookie: session.cookie } : {}) },
    });

    if (isDebug) {
      console.log("[price/route] ▶ v7/quote RESPONSE:", res.status, res.statusText);
    }

    if (res.status === 429) {
      console.warn("[price/route] ✗ v7/quote 429 (rate limited) for", symbol);
      return null;
    }
    if (!res.ok) return null;

    const data = (await readJsonFromExternalResponse(res, "v7/quote", url)) as {
      quoteResponse?: { result?: unknown[] };
    } | null;
    if (!data) return null;
    const quote = data?.quoteResponse?.result?.[0] as
      | {
          regularMarketPrice?: number | null;
          regularMarketPreviousClose?: number | null;
        }
      | undefined;
    if (!quote) return null;

    const price =
      quote.regularMarketPrice != null
        ? (quote.regularMarketPrice as number)
        : quote.regularMarketPreviousClose != null
          ? (quote.regularMarketPreviousClose as number)
          : null;

    if (isDebug) {
      console.log("[price/route] ▶ v7/quote FINAL price:", price);
    }
    return price;
  } catch (err) {
    console.error("[price/route] ✗ v7/quote 에러 for", symbol, ":", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Finnhub quote fallback ────────────────────────────────────────────────────
// Yahoo Finance 차단/실패 시 미국 주식용 폴백 (환율 심볼에는 사용하지 않음).

async function fetchViaFinnhub(symbol: string, isDebug: boolean): Promise<number | null> {
  if (!FINNHUB_TOKEN) return null;

  const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(FINNHUB_TOKEN)}`;

  if (isDebug) {
    console.log("[price/route] ▶ Finnhub | symbol:", symbol);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": COMMON_HEADERS["User-Agent"] },
    });

    if (isDebug) {
      console.log("[price/route] ▶ Finnhub RESPONSE:", res.status, res.statusText);
    }

    if (!res.ok) {
      console.warn("[price/route] ✗ Finnhub non-ok:", res.status, "for", symbol);
      return null;
    }

    const data = (await readJsonFromExternalResponse(res, "Finnhub", url)) as {
      c?: number | null;
      pc?: number | null;
    } | null;
    if (!data) return null;

    const current = typeof data.c === "number" ? data.c : null;
    const prevClose = typeof data.pc === "number" ? data.pc : null;
    const price =
      current != null && current > 0
        ? current
        : prevClose != null && prevClose > 0
          ? prevClose
          : null;

    if (isDebug) {
      const usedField =
        current != null && current > 0 ? "c"
        : prevClose != null && prevClose > 0 ? "pc (fallback)"
        : "null — 유효 필드 없음";
      console.log("[price/route] ▶ Finnhub FINAL price:", price, "| field:", usedField);
    }

    if (price == null) {
      console.warn("[price/route] ✗ Finnhub null price for", symbol,
        "| c:", data.c, "| pc:", data.pc);
    }

    return price;
  } catch (err) {
    console.error("[price/route] ✗ Finnhub 에러 for", symbol, ":", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Stooq CSV fallback ────────────────────────────────────────────────────────
// Yahoo Finance rate limit 시 최종 fallback.
// CSV 형식(f=sd2t2ohlcvn): symbol,date,time,open,high,low,close,volume,name
// close 필드(index 6)가 현재가입니다.

/** Yahoo FX 심볼 문자열 정규화 (ZWSP 등으로 인해 USDKRW=X 엄격 비교가 실패할 수 있음) */
function normalizeFxSymbol(raw: string): string {
  return raw
    .replace(/\u200B/g, "")
    .replace(/\uFEFF/g, "")
    // 전각 '=' 등으로 인해 USDKRW=X 패턴이 깨지는 경우 방지
    .replace(/[\uFF1D]/g, "=")
    .trim();
}

function isUsdKrwYahooSymbol(symbol: string): boolean {
  const cleaned = normalizeFxSymbol(symbol);
  return /^USDKRW\s*=\s*X$/i.test(cleaned) || /^KRW\s*=\s*X$/i.test(cleaned);
}

function toStooqSymbol(symbol: string): string {
  const cleaned = normalizeFxSymbol(symbol);
  const u = cleaned.toUpperCase();
  // Yahoo 환율 심볼 → Stooq 티커 (USDKRW=X 그대로는 N/D만 반환됨)
  if (u === "USDKRW=X" || u === "KRW=X") return "usdkrw";
  // 엄격 비교 실패 시에도 USDKRW 패턴이면 usdkrw (보이지 않는 문자 대비)
  if (/^USDKRW\s*=\s*X$/i.test(cleaned) || /^KRW\s*=\s*X$/i.test(cleaned)) {
    return "usdkrw";
  }
  // Stooq는 US 종목에 .US 접미사를 사용합니다 (단, =X 환율 심볼 제외)
  if (cleaned.endsWith("=X") || cleaned.includes(".")) return cleaned;
  return `${cleaned}.US`;
}

function parseStooqFxCsvLine(line: string): { closeStr: string } | null {
  const trimmed = line.replace(/^\uFEFF/, "").trim();
  if (!trimmed || trimmed.startsWith("<")) return null;
  const fields = trimmed.split(",");
  if (fields.length < 7) return null;
  const closeStr = fields[6]?.trim() ?? "";
  return { closeStr };
}

async function fetchViaStooq(symbol: string, isDebug: boolean): Promise<number | null> {
  const normalizedIn = normalizeFxSymbol(symbol);
  const stooqSym = toStooqSymbol(symbol);
  const url = `${STOOQ_BASE}?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcvn&e=csv`;

  if (isDebug) {
    console.log("[FX_TRACE][4] normalizeFxSymbol(입력)→", JSON.stringify(normalizedIn));
    console.log("[FX_TRACE][5] toStooqSymbol(입력)→", JSON.stringify(stooqSym));
    console.log("[FX_TRACE][6] Stooq 최종 요청 URL:", url);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": COMMON_HEADERS["User-Agent"] },
    });

    if (isDebug) {
      console.log("[FX_TRACE][7] Stooq HTTP status:", res.status, res.statusText);
    }

    if (!res.ok) {
      console.warn("[price/route] ✗ Stooq non-ok:", res.status, "for", stooqSym);
      return null;
    }

    const rawText = await res.text();
    const csv = rawText.replace(/^\uFEFF/, "").trim();

    if (isDebug) {
      console.log("[FX_TRACE][8] Stooq raw 응답 본문:", csv.slice(0, 800));
    }

    // 헤더+데이터 2줄 이상이면 마지막 데이터 줄만 사용
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const dataLine = lines.length > 1 ? lines[lines.length - 1] : lines[0] ?? "";

    const parsed = parseStooqFxCsvLine(dataLine);
    if (!parsed) {
      console.warn("[price/route] ✗ Stooq 파싱 실패 for", stooqSym, "| raw:", csv.slice(0, 500));
      return null;
    }

    const { closeStr } = parsed;
    if (!closeStr || closeStr === "N/D") {
      console.warn("[price/route] ✗ Stooq N/D for", stooqSym, "| url:", url, "| raw:", csv.slice(0, 400));
      return null;
    }

    const price = parseFloat(closeStr.replace(",", "."));
    if (isDebug) {
      console.log("[FX_TRACE][9] Stooq 파싱된 close 문자열→", closeStr, "| parseFloat→", price);
    }

    if (isNaN(price) || price <= 0) {
      console.warn("[price/route] ✗ Stooq 유효하지 않은 가격:", closeStr, "for", stooqSym);
      return null;
    }

    if (isDebug) {
      console.log("[price/route] ▶ Stooq FINAL price:", price);
    }

    return price;
  } catch (err) {
    console.error("[price/route] ✗ Stooq 에러 for", stooqSym, ":", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaOpenErUsdKrw(isDebug: boolean): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (isDebug) {
      console.log("[FX_TRACE][6b] OpenEr USD latest URL:", OPEN_ER_USD_LATEST);
    }
    const res = await fetch(OPEN_ER_USD_LATEST, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": COMMON_HEADERS["User-Agent"] },
    });
    if (isDebug) {
      console.log("[FX_TRACE][7b] OpenEr HTTP status:", res.status);
    }
    if (!res.ok) {
      console.warn("[price/route] ✗ OpenEr non-ok:", res.status);
      return null;
    }
    const text = await res.text();
    if (isDebug) {
      console.log("[FX_TRACE][8b] OpenEr raw (앞 600자):", text.slice(0, 600));
    }
    let data: { result?: string; rates?: Record<string, number | string> };
    try {
      data = JSON.parse(text) as { result?: string; rates?: Record<string, number | string> };
    } catch {
      console.warn("[price/route] ✗ OpenEr JSON 파싱 실패");
      return null;
    }
    if (data.result && data.result !== "success") {
      console.warn("[price/route] ✗ OpenEr result not success:", data.result);
      return null;
    }
    const krw = data?.rates?.KRW;
    const num =
      typeof krw === "number"
        ? krw
        : typeof krw === "string"
          ? parseFloat(krw.replace(",", "."))
          : NaN;
    if (isDebug) {
      console.log("[FX_TRACE][9b] OpenEr 파싱 KRW:", num);
    }
    if (!isNaN(num) && num > 100 && num < 50000) return num;
    return null;
  } catch (err) {
    console.error("[price/route] ✗ OpenEr 에러:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── 단일 심볼 현재가 조회 ─────────────────────────────────────────────────────
// 우선순위(미국): Yahoo v8/chart → Yahoo v7/quote → Finnhub → Stooq CSV

async function fetchOnePrice(
  symbol: string,
  session: { crumb: string; cookie: string } | null
): Promise<number | null> {
  const normalized = normalizeFxSymbol(symbol);
  const isDebug =
    normalized.startsWith("032830") ||
    normalized.toUpperCase() === "SNDK" ||
    isUsdKrwYahooSymbol(normalized);

  if (isDebug && isUsdKrwYahooSymbol(normalized)) {
    console.log("[FX_TRACE][3] 서버 수신 symbol (raw):", JSON.stringify(symbol));
    console.log("[FX_TRACE][3b] normalizeFxSymbol 후:", JSON.stringify(normalized));
    console.log(
      "[price/route] USDKRW 조회 시작 | Yahoo 세션:",
      session ? "있음" : "없음(crumb 없이 시도)",
      "| normalized:",
      JSON.stringify(normalized)
    );
  }

  // 환율(USDKRW)은 Yahoo 429에 자주 막히므로 Stooq(usdkrw)를 먼저 시도
  if (isUsdKrwYahooSymbol(normalized)) {
    const stooqFirst = await fetchViaStooq(normalized, isDebug);
    if (stooqFirst != null && stooqFirst > 0) {
      return stooqFirst;
    }
  }

  // 1차: Yahoo Finance v8/finance/chart (crumb 포함)
  const priceChart = await fetchViaChart(normalized, session, isDebug);
  if (priceChart != null && priceChart > 0) return priceChart;

  // 2차: Yahoo Finance v7/finance/quote (crumb 포함)
  if (isDebug) {
    console.log("[price/route] ⚠ v8 null/0 → v7/quote 시도 | symbol:", normalized);
  }
  const priceQuote = await fetchViaYahooQuote(normalized, session, isDebug);
  if (priceQuote != null && priceQuote > 0) return priceQuote;

  // 3차: Finnhub (미국 주식, Yahoo 실패 시 — 환율 심볼 제외)
  let priceFinnhub: number | null = null;
  if (!isUsdKrwYahooSymbol(normalized)) {
    if (isDebug) {
      console.log("[price/route] ⚠ Yahoo 모두 실패 → Finnhub fallback | symbol:", normalized);
    }
    priceFinnhub = await fetchViaFinnhub(normalized, isDebug);
    if (priceFinnhub != null && priceFinnhub > 0) return priceFinnhub;
  }

  // 4차: Stooq CSV fallback
  if (isDebug) {
    console.log("[price/route] ⚠ Finnhub 실패/건너뜀 → Stooq fallback | symbol:", normalized);
  }
  const priceStooq = await fetchViaStooq(normalized, isDebug);
  if (priceStooq != null && priceStooq > 0) return priceStooq;

  if (isUsdKrwYahooSymbol(normalized)) {
    const openEr = await fetchViaOpenErUsdKrw(isDebug);
    if (openEr != null && openEr > 0) {
      if (isDebug) {
        console.log("[price/route] ✓ USDKRW via OpenEr (백업):", openEr);
      }
      return openEr;
    }
  }

  console.warn("[price/route] ✗ 모든 소스 실패 | symbol:", normalized,
    "| v8:", priceChart, "| v7:", priceQuote, "| Finnhub:", priceFinnhub, "| Stooq:", priceStooq);
  if (isUsdKrwYahooSymbol(normalized)) {
    console.warn(
      "[price/route] USDKRW 실패 요약: Stooq·Yahoo·OpenEr 모두 실패했을 수 있습니다."
    );
  }
  return null;
}

// ── API 핸들러 ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const requestUrl = request.url;
  const raw = request.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (IS_DEV) {
    console.log("[price/route] GET", { requestUrl, symbolCount: symbols.length });
  }

  if (symbols.length === 0) {
    return Response.json(
      { ok: true as const, prices: {} as Record<string, number | null> },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    // Yahoo 세션(crumb + cookie) 먼저 확보 — 실패해도 계속 진행
    const session = await getYahooSession();
    if (!session) {
      console.warn("[price/route] ⚠ Yahoo 세션 없음 — Stooq fallback이 작동합니다");
    }

    const settled = await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const price = await fetchOnePrice(symbol, session);
          const body = { symbol, price: price ?? null } as const;
          const logDetail =
            isUsdKrwYahooSymbol(symbol) || symbols.length <= 5;
          if (logDetail) {
            console.log("[price/route] GET 결과", {
              symbol,
              price: body.price,
              usedFallback: body.price == null,
              note: body.price == null
                ? "모든 소스가 null — 클라이언트는 마지막 저장값 사용"
                : "ok",
            });
          }
          return body;
        } catch (err) {
          console.error("[price/route] ✗ fetchOnePrice 예외 | symbol:", symbol, err);
          return { symbol, price: null };
        }
      })
    );

    const prices: Record<string, number | null> = {};
    for (const r of settled) {
      if (r.status === "fulfilled") {
        prices[r.value.symbol] = r.value.price;
      }
    }

    if (symbols.length <= 5 || symbols.some((s) => isUsdKrwYahooSymbol(s))) {
      console.log("[price/route] 응답 payload 요약", {
        symbols,
        keys: Object.keys(prices),
        values: prices,
      });
    }

    return Response.json(
      { ok: true as const, prices },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (IS_DEV) {
      console.error("[price/route] GET 예외", {
        requestUrl,
        error: msg.slice(0, 300),
        stack: e instanceof Error ? e.stack : undefined,
      });
    } else {
      console.error("[price/route] GET 예외", msg.slice(0, 200));
    }
    return Response.json(
      { ok: false as const, error: msg || "서버 오류" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
