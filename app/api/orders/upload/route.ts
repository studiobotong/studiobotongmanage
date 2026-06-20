import { NextResponse } from "next/server";
import { parseOrderExcel } from "@/lib/orderParser";
import { processOrderUpload } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const password = String(formData.get("password") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "업로드할 파일이 없습니다." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { ok: false, error: ".xlsx 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    const applyStock = formData.get("applyStock") !== "false";

    const buffer = await file.arrayBuffer();
    const { rows, errors: parseErrors } = await parseOrderExcel(
      buffer,
      password
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: parseErrors[0] ?? "파싱된 주문 데이터가 없습니다.",
        },
        { status: 400 }
      );
    }

    const result = await processOrderUpload(rows, { applyStock });

    return NextResponse.json({
      ok: true,
      result: {
        ...result,
        parseWarnings: parseErrors,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "업로드 처리 중 오류가 발생했습니다.";
    const status = message.includes("비밀번호") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
