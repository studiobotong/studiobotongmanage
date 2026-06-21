import { NextResponse } from "next/server";
import { getBulkStockDeductionSummary } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { productOrderNos?: string[] };
  try {
    body = (await request.json()) as { productOrderNos?: string[] };
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문이 필요합니다." },
      { status: 400 }
    );
  }

  const productOrderNos = Array.isArray(body.productOrderNos)
    ? body.productOrderNos
    : [];

  const summary = await getBulkStockDeductionSummary(productOrderNos);
  return NextResponse.json({ ok: true, summary });
}
