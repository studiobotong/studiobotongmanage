import { NextResponse } from "next/server";
import { deleteOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return NextResponse.json(
      { ok: false, error: "주문 ID가 필요합니다." },
      { status: 400 }
    );
  }

  let restoreStock = false;
  try {
    const body = (await request.json()) as { restoreStock?: boolean };
    restoreStock = body.restoreStock === true;
  } catch {
    // body 없음 — restoreStock false 유지
  }

  const result = await deleteOrder(id, { restoreStock });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "주문 삭제에 실패했습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, error: null });
}
