/**
 * 브라우저·서버 공통: fetch Response → text → JSON.parse.
 * 빈 본문·HTML·비정상 JSON 시 예외 대신 { ok: false, error }.
 */

const IS_DEV =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

export function responseBodySnippet(text: string, maxLen = 200): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

/**
 * market-data 등 클라이언트 fetch 응답 파싱.
 */
export async function parseFetchJsonResponse<T>(
  res: Response,
  requestUrl: string,
  logContext: string
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const text = await res.text();
  const snippet = responseBodySnippet(text);
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();

  const fail = (error: string) => {
    if (IS_DEV) {
      console.warn("[parseFetchJsonResponse]", logContext, {
        requestUrl,
        finalUrl: res.url,
        status: res.status,
        responseOk: res.ok,
        redirected: res.redirected,
        contentType: ct || null,
        bodyLength: text.length,
        bodyPreview: snippet || "(empty)",
        error,
      });
    }
    return { ok: false as const, error };
  };

  if (res.redirected) {
    return fail(
      `리다이렉트 응답 (HTTP ${res.status}). 최종 URL: ${res.url}. 본문: ${snippet || "(비어 있음)"}`
    );
  }

  if (ct.includes("text/html") || /^\s*</.test(text)) {
    return fail(
      `HTML 응답 (HTTP ${res.status}, JSON 기대). 앞부분: ${snippet || "(비어 있음)"}`
    );
  }

  if (!text.trim()) {
    return fail(`응답 본문이 비어 있음 (HTTP ${res.status}). URL: ${requestUrl}`);
  }

  try {
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fail(
      `JSON 파싱 실패 (HTTP ${res.status}): ${msg}. 본문 앞부분: ${snippet}`
    );
  }
}
