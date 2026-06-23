import * as XLSX from "xlsx";
import type { OptionExcelRow } from "@/types/productOptions";

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[★⭐*()（）]/g, "")
    .replace(/네이버에도입력/g, "")
    .replace(/네이버옵션조합/g, "")
    .replace(/선택/g, "");
}

function pick(row: Record<string, unknown>, candidates: string[]): unknown {
  const normMap: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    normMap[normalizeKey(k)] = k;
  }
  for (const c of candidates) {
    const normalized = normalizeKey(c);
    const exact = normMap[normalized];
    if (exact !== undefined) return row[exact];

    const prefixMatch = Object.entries(normMap).find(([nk]) =>
      nk.startsWith(normalized)
    );
    if (prefixMatch) return row[prefixMatch[1]];
  }
  return undefined;
}

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
  return String(v).trim();
}

function parseNumber(v: unknown): number {
  if (isEmptyValue(v)) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const cleaned = String(v).replace(/,/g, "").trim();
  if (!cleaned || cleaned.toLowerCase() === "nan") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeProductSku(v: unknown): string {
  if (isEmptyValue(v)) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.trunc(v));
  }
  const raw = toStr(v);
  if (/^\d+\.0+$/.test(raw)) return raw.replace(/\.0+$/, "");
  return raw;
}

function mapRow(record: Record<string, unknown>): OptionExcelRow | null {
  const product_sku = normalizeProductSku(pick(record, ["상품번호"]));
  const sku_code = toStr(pick(record, ["옵션관리코드"]));
  const option_name = toStr(pick(record, ["옵션정보"]));

  if (!product_sku || !sku_code) return null;

  return {
    product_sku,
    sku_code,
    option_name: option_name || "(옵션 없음)",
    cost_price: parseNumber(pick(record, ["원가"])),
    safety_stock: parseNumber(pick(record, ["안전재고"])),
    stock_qty: parseNumber(pick(record, ["현재고"])),
  };
}

export function parseOptionCostExcel(buffer: ArrayBuffer): {
  rows: OptionExcelRow[];
  errors: string[];
} {
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch (e) {
    return {
      rows: [],
      errors: [
        `엑셀 파일을 읽을 수 없습니다: ${e instanceof Error ? e.message : "알 수 없는 오류"}`,
      ],
    };
  }

  const sheetName =
    workbook.SheetNames.find((name) =>
      normalizeKey(name).includes("옵션원가")
    ) ?? workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["시트를 찾을 수 없습니다."] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  if (matrix.length < 2) {
    return { rows: [], errors: ["데이터 행이 없습니다."] };
  }

  const headerRow = matrix[0] ?? [];
  const headers = headerRow.map((h) => toStr(h));

  const hasProductSku = headers.some((h) => normalizeKey(h).includes("상품번호"));
  const hasSkuCode = headers.some((h) => normalizeKey(h).includes("옵션관리코드"));

  if (!hasProductSku) {
    errors.push("'상품번호' 컬럼을 찾을 수 없습니다.");
  }
  if (!hasSkuCode) {
    errors.push("'옵션관리코드' 컬럼을 찾을 수 없습니다.");
  }
  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: OptionExcelRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    if (cells.every((c) => isEmptyValue(c))) continue;

    const record: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      record[key] = cells[j] ?? null;
    }

    const parsed = mapRow(record);
    if (parsed) rows.push(parsed);
  }

  if (rows.length === 0) {
    errors.push("파싱된 옵션 데이터가 없습니다.");
  }

  return { rows, errors };
}
