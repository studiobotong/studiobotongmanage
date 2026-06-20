import * as XLSX from "xlsx";
import { decrypt as decryptOfficeFile } from "officecrypto-tool";
import type { ParsedOrderRow } from "@/types/orders";

export const ORDER_SHEET_NAME = "발주발송관리";
export const PURCHASE_CONFIRMATION_SHEET_NAME = "구매확정내역";

export type OrderExcelFormat = "fulfillment" | "purchase_confirmation";

export const ORDER_HEADERS = [
  "상품주문번호",
  "주문번호",
  "배송속성",
  "풀필먼트사(주문 기준)",
  "배송방법(구매자 요청)",
  "배송방법",
  "택배사",
  "송장번호",
  "발송일",
  "판매채널",
  "구매자명",
  "구매자ID",
  "수취인명",
  "주문상태",
  "주문세부상태",
  "수량클레임 여부",
  "결제위치",
  "결제일",
  "상품명",
  "상품종류",
  "옵션정보",
  "옵션관리코드",
  "수량",
  "옵션가격",
  "상품가격",
  "최종 상품별 할인액",
  "최초 상품별 할인액",
  "판매자 부담 할인액",
  "최종 상품별 총 주문금액",
  "최초 상품별 총 주문금액",
  "사은품",
  "발주확인일",
  "발송기한",
  "발송처리일",
  "송장출력일",
  "배송비 묶음번호",
  "배송비 유형",
  "배송비 합계",
  "제주/도서 추가배송비",
  "배송비 할인액",
  "수취인연락처1",
  "수취인연락처2",
  "통합배송지",
  "기본배송지",
  "상세배송지",
  "구매자연락처",
  "우편번호",
  "배송메세지",
  "출고지",
  "결제수단",
  "네이버페이 주문관리 수수료",
  "매출연동 수수료",
  "정산예정금액",
  "주문일시",
  "배송희망일",
  "배송태그 유형",
  "출입방법 유형",
  "출입방법 내용",
  "수령위치 유형",
  "수령위치 내용",
] as const;

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" || t.toLowerCase() === "nan";
  }
  return false;
}

function toStr(v: unknown): string {
  if (isEmptyValue(v)) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

export function parseNumber(v: unknown): number {
  if (isEmptyValue(v)) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (!cleaned || cleaned.toLowerCase() === "nan") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseDateTime(v: unknown): string | null {
  if (isEmptyValue(v)) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString();
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = epoch.getTime() + v * 86_400_000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const raw = String(v).trim();
  const normalized = raw
    .replace(/\./g, "-")
    .replace(/\//g, "-")
    .replace(" ", "T");
  const d = new Date(normalized);
  if (!Number.isNaN(d.getTime())) return d.toISOString();

  const match = raw.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (match) {
    const [, y, mo, da, h = "0", mi = "0", s = "0"] = match;
    const parsed = new Date(
      Number(y),
      Number(mo) - 1,
      Number(da),
      Number(h),
      Number(mi),
      Number(s)
    );
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return null;
}

function rowToRecord(
  headers: string[],
  cells: unknown[]
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (!key) continue;
    record[key] = cells[i] ?? null;
  }
  return record;
}

function mapRow(record: Record<string, unknown>): ParsedOrderRow | null {
  const productOrderNo = toStr(record["상품주문번호"]);
  if (!productOrderNo) return null;

  const optionRaw = toStr(record["옵션정보"]);
  const orderDate =
    parseDateTime(record["주문일시"]) ??
    parseDateTime(record["결제일"]) ??
    parseDateTime(record["구매확정일"]) ??
    parseDateTime(record["발송일"]);

  return {
    product_order_no: productOrderNo,
    order_no: toStr(record["주문번호"]),
    order_date: orderDate,
    product_name: toStr(record["상품명"]),
    option_name: optionRaw,
    quantity: parseNumber(record["수량"]),
    product_price: parseNumber(record["상품가격"]),
    total_order_amount: parseNumber(record["최종 상품별 총 주문금액"]),
    shipping_fee: parseNumber(record["배송비 합계"]),
    naver_fee: parseNumber(record["네이버페이 주문관리 수수료"]),
    channel_fee: parseNumber(record["매출연동 수수료"]),
    settlement_amount: parseNumber(record["정산예정금액"]),
    order_status: toStr(record["주문상태"]),
    order_status_detail: toStr(record["주문세부상태"]) || null,
    payment_method: toStr(record["결제수단"]),
    channel: toStr(record["판매채널"]),
    buyer_id_masked: toStr(record["구매자ID"]) || null,
    raw_row: record,
  };
}

export async function decryptExcelBuffer(
  buffer: ArrayBuffer,
  password: string
): Promise<Buffer> {
  const input = Buffer.from(buffer);
  let needsDecrypt = false;

  try {
    XLSX.read(input, { type: "buffer" });
    return input;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("password")) {
      needsDecrypt = true;
    } else {
      throw e;
    }
  }

  if (!needsDecrypt) return input;

  if (!password.trim()) {
    throw new Error("비밀번호가 필요합니다.");
  }

  try {
    return await decryptOfficeFile(input, { password: password.trim() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("incorrect")) {
      throw new Error("비밀번호가 올바르지 않습니다.");
    }
    throw e;
  }
}

function isHeaderRow(row: unknown[]): boolean {
  return toStr(row[0]) === "상품주문번호";
}

function detectOrderExcelFormat(workbook: XLSX.WorkBook): {
  format: OrderExcelFormat | null;
  sheetName: string;
} {
  if (workbook.SheetNames.includes(PURCHASE_CONFIRMATION_SHEET_NAME)) {
    return {
      format: "purchase_confirmation",
      sheetName: PURCHASE_CONFIRMATION_SHEET_NAME,
    };
  }
  if (workbook.SheetNames.includes(ORDER_SHEET_NAME)) {
    return { format: "fulfillment", sheetName: ORDER_SHEET_NAME };
  }

  const sheetName = workbook.SheetNames[0] ?? "";
  if (!sheetName) {
    return { format: null, sheetName: "" };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  if (isHeaderRow(matrix[0] ?? [])) {
    return { format: "purchase_confirmation", sheetName };
  }

  if (matrix.length >= 2 && isHeaderRow(matrix[1] ?? [])) {
    return { format: "fulfillment", sheetName };
  }

  return { format: null, sheetName };
}

function parseRowsFromMatrix(
  matrix: unknown[][],
  headerRowIndex: number,
  dataStartIndex: number
): { rows: ParsedOrderRow[]; errors: string[] } {
  const errors: string[] = [];
  const headerRow = matrix[headerRowIndex] ?? [];
  const headers = headerRow.map((h) => toStr(h));

  if (!headers.includes("상품주문번호")) {
    errors.push("'상품주문번호' 컬럼을 찾을 수 없습니다.");
    return { rows: [], errors };
  }

  const rows: ParsedOrderRow[] = [];
  for (let i = dataStartIndex; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    if (cells.every((c) => isEmptyValue(c))) continue;

    const record = rowToRecord(headers, cells);
    const parsed = mapRow(record);
    if (!parsed) continue;
    rows.push(parsed);
  }

  if (rows.length === 0) {
    errors.push("파싱된 주문 데이터가 없습니다.");
  }

  return { rows, errors };
}

function parseFulfillmentMatrix(matrix: unknown[][]): {
  rows: ParsedOrderRow[];
  errors: string[];
} {
  if (matrix.length < 3) {
    return { rows: [], errors: ["데이터 행이 없습니다."] };
  }
  return parseRowsFromMatrix(matrix, 1, 2);
}

function parsePurchaseConfirmationMatrix(matrix: unknown[][]): {
  rows: ParsedOrderRow[];
  errors: string[];
} {
  if (matrix.length < 2) {
    return { rows: [], errors: ["데이터 행이 없습니다."] };
  }
  return parseRowsFromMatrix(matrix, 0, 1);
}

export function parseOrderWorkbook(buffer: Buffer): {
  rows: ParsedOrderRow[];
  errors: string[];
  format: OrderExcelFormat | null;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const { format, sheetName } = detectOrderExcelFormat(workbook);

  if (!format || !sheetName) {
    return {
      rows: [],
      errors: ["지원하지 않는 엑셀 형식입니다."],
      format: null,
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const parsed =
    format === "purchase_confirmation"
      ? parsePurchaseConfirmationMatrix(matrix)
      : parseFulfillmentMatrix(matrix);

  return { ...parsed, format };
}

export async function parseOrderExcel(
  buffer: ArrayBuffer,
  password: string
): Promise<{
  rows: ParsedOrderRow[];
  errors: string[];
  format: OrderExcelFormat | null;
}> {
  const decrypted = await decryptExcelBuffer(buffer, password);
  return parseOrderWorkbook(decrypted);
}
