import { NextResponse } from "next/server";
import { requestNaverAdReport } from "@/lib/naverAdSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

// GET: 보고서 생성 요청 (Cron 1 — KST 10:00)
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await requestNaverAdReport();
    return NextResponse.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST: 날짜 지정 보고서 생성 요청
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as { date?: string };
    const result = await requestNaverAdReport(body.date);
    return NextResponse.json({ ok: true, result, timestamp: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
