/**
 * SellerDailySettle 엑셀 파서
 * 네이버 스마트스토어 '가맹점별 일별 정산내역 - 일별' 시트 파싱
 */

import * as XLSX from "xlsx";

export interface ParsedSettlementRow {
  settlement_date: string;        // 정산예정일 (YYYY-MM-DD)
  completed_date: string | null;  // 정산완료일
  settlement_amount: number;      // 정산금액
  normal_amount: number;          // 일반정산금액
  quick_amount: number;           // 빠른정산금액
  base_amount: number;            // 정산기준금액 (매출 기준)
  fee_total: number;              // 수수료합계
  benefit_settlement: number;     // 혜택정산
  daily_deduction: number;        // 일별 공제/환급
  payment_hold: number;           // 지급보류
  minus_wallet: number;           // 마이너스비즈월렛상계
  return_care_fee: number;        // 반품안심케어비용
  preferential_fee_refund: number;// 우대수수료환급
  settlement_method: string;      // 정산방식
  raw_data: Record<string, unknown>; // 원본 행 전체
}

export interface SettlementParseResult {
  rows: ParsedSettlementRow[];
  errors: string[];
  month: string; // 예: "2023-07"
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(v: unknown): string | null {
  if (!v || v === "") return null;
  const s = String(v).trim();
  // 2023.07.13 → 2023-07-13
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(s)) {
    return s.replace(/\./g, "-");
  }
  // 이미 YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  // 숫자(엑셀 시리얼 날짜)
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

const SHEET_NAME = "가맹점별 일별 정산내역 - 일별";

export function parseSettlementExcel(buffer: ArrayBuffer): SettlementParseResult {
  const errors: string[] = [];
  const rows: ParsedSettlementRow[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(Buffer.from(buffer), { type: "buffer", cellDates: false });
  } catch (e) {
    return {
      rows: [],
      errors: [`엑셀 파일을 읽을 수 없습니다: ${e instanceof Error ? e.message : String(e)}`],
      month: "",
    };
  }

  // 시트 찾기 (정확한 이름 or 첫 번째 시트)
  const sheetName = workbook.SheetNames.includes(SHEET_NAME)
    ? SHEET_NAME
    : workbook.SheetNames[0] ?? "";

  if (!sheetName) {
    return { rows: [], errors: ["시트를 찾을 수 없습니다."], month: "" };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  if (matrix.length === 0) {
    return { rows: [], errors: ["데이터가 없습니다."], month: "" };
  }

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i]!;

    const settlementDate = parseDate(row["정산예정일"]);
    if (!settlementDate) {
      errors.push(`${i + 2}행: 정산예정일을 파싱할 수 없습니다 (값: ${row["정산예정일"]})`);
      continue;
    }

    rows.push({
      settlement_date: settlementDate,
      completed_date: parseDate(row["정산완료일"]),
      settlement_amount: toNum(row["정산금액"]),
      normal_amount: toNum(row["일반정산금액"]),
      quick_amount: toNum(row["빠른정산금액"]),
      base_amount: toNum(row["정산기준금액"]),
      fee_total: toNum(row["수수료합계"]),
      benefit_settlement: toNum(row["혜택정산"]),
      daily_deduction: toNum(row["일별 공제/환급"]),
      payment_hold: toNum(row["지급보류"]),
      minus_wallet: toNum(row["마이너스비즈월렛상계"]),
      return_care_fee: toNum(row["반품안심케어비용"]),
      preferential_fee_refund: toNum(row["우대수수료환급"]),
      settlement_method: String(row["정산방식"] ?? ""),
      raw_data: row,
    });
  }

  // 월 추출 (첫 번째 행의 정산예정일 기준)
  const month = rows[0]?.settlement_date?.slice(0, 7) ?? "";

  return { rows, errors, month };
}
