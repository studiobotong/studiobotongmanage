import { NextResponse } from "next/server";
import { processNaverAdReport } from "@/lib/naverAdSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// GET: 보고서 다운로드 + DB 저장 (Cron 2 — KST 11:00)
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processNaverAdReport();
    return NextResponse.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
