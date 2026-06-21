import { NextResponse } from "next/server";
import { deleteOrdersBulk } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { orderIds?: string[]; restoreStock?: boolean };
  try {
    body = (await request.json()) as { orderIds?: string[]; restoreStock?: boolean };
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 본문이 필요합니다." },
      { status: 400 }
    );
  }

  const orderIds = Array.isArray(body.orderIds) ? body.orderIds : [];
  const restoreStock = body.restoreStock === true;

  if (orderIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "삭제할 주문을 선택해주세요." },
      { status: 400 }
    );
  }

  const result = await deleteOrdersBulk(orderIds, { restoreStock });
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        deleted: result.deleted,
        restoredOrders: result.restoredOrders,
        error: result.error ?? "일괄 삭제에 실패했습니다.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    deleted: result.deleted,
    restoredOrders: result.restoredOrders,
    error: null,
  });
}
