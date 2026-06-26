import { NextResponse } from "next/server";
import { deleteBTMOrder } from "@/lib/btmOrders";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = parseInt(idParam);
  if (isNaN(id)) {
    return NextResponse.json({ ok: false, error: "잘못된 ID입니다." }, { status: 400 });
  }

  const result = await deleteBTMOrder(id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
