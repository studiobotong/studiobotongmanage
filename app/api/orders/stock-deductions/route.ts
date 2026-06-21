import { NextResponse } from "next/server";
import { getOrderStockDeductions } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const productOrderNo = new URL(request.url).searchParams
    .get("productOrderNo")
    ?.trim();

  if (!productOrderNo) {
    return NextResponse.json(
      { ok: false, error: "상품주문번호가 필요합니다." },
      { status: 400 }
    );
  }

  const deductions = await getOrderStockDeductions(productOrderNo);
  return NextResponse.json({ ok: true, deductions });
}
