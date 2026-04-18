import { NextResponse } from "next/server";
import {
  CNN_FEAR_GREED_FETCH_HEADERS,
  CNN_FEAR_GREED_GRAPH_URL,
  CNN_FEAR_GREED_SOURCE_NAME,
  parseCnnFearGreedGraphJson,
} from "@/lib/cnnFearGreed";

export const dynamic = "force-dynamic";

export async function GET() {
  let rawBody: unknown;
  try {
    const res = await fetch(CNN_FEAR_GREED_GRAPH_URL, {
      cache: "no-store",
      headers: CNN_FEAR_GREED_FETCH_HEADERS,
    });

    const text = await res.text();
    try {
      rawBody = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json(
        {
          ok: false as const,
          error: `Fear & Greed API JSON 파싱 실패 (HTTP ${res.status})`,
          source: CNN_FEAR_GREED_SOURCE_NAME,
          requestUrl: CNN_FEAR_GREED_GRAPH_URL,
        },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: `CNN Fear & Greed HTTP ${res.status}`,
          source: CNN_FEAR_GREED_SOURCE_NAME,
          requestUrl: CNN_FEAR_GREED_GRAPH_URL,
          raw: rawBody,
        },
        { status: 502 }
      );
    }

    const parsed = parseCnnFearGreedGraphJson(rawBody);
    if (!parsed.ok) {
      return NextResponse.json(
        {
          ok: false as const,
          error: parsed.error,
          source: CNN_FEAR_GREED_SOURCE_NAME,
          requestUrl: CNN_FEAR_GREED_GRAPH_URL,
          raw: rawBody,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      ok: true as const,
      value: parsed.parsed.value,
      rating: parsed.parsed.rating,
      source: CNN_FEAR_GREED_SOURCE_NAME,
      requestUrl: CNN_FEAR_GREED_GRAPH_URL,
      indexTimestamp: parsed.parsed.indexTimestampIso,
      raw: rawBody,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json(
      {
        ok: false as const,
        error: msg,
        source: CNN_FEAR_GREED_SOURCE_NAME,
        requestUrl: CNN_FEAR_GREED_GRAPH_URL,
        raw: rawBody ?? null,
      },
      { status: 502 }
    );
  }
}
