import { NextResponse } from "next/server";
import { parseSettlementExcel } from "@/lib/settlementParser";
import { processBTMSettlementUpload } from "@/lib/btmSettlements";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

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

    const buffer = await file.arrayBuffer();
    const { rows, errors: parseErrors, month } = parseSettlementExcel(buffer);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: parseErrors[0] ?? "파싱된 정산 데이터가 없습니다.",
        },
        { status: 400 }
      );
    }

    const result = await processBTMSettlementUpload(rows, month);

    return NextResponse.json({
      ok: true,
      result: {
        ...result,
        parseWarnings: parseErrors,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "업로드 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
