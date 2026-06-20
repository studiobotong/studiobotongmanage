import Papa from "papaparse";
import { normalizeNaverImageUrl } from "@/lib/utils/imageUrl";
import type { ProductCsvRow } from "@/types/products";

const REQUIRED_HEADERS = [
  "상품명",
  "재고수량",
  "판매가",
  "판매상태",
] as const;

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function buildCategory(
  major: unknown,
  middle: unknown,
  minor: unknown
): string | null {
  const parts = [major, middle, minor]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" > ") : null;
}

function parseActiveStatus(value: unknown): boolean {
  return String(value ?? "").trim() === "판매중";
}

function getField(row: Record<string, string>, key: string): string {
  return String(row[key] ?? "").trim();
}

export function parseProductCsv(text: string): {
  rows: ProductCsvRow[];
  errors: string[];
} {
  const cleaned = stripBom(text);
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      errors.push(`CSV 파싱 오류 (행 ${(err.row ?? 0) + 1}): ${err.message}`);
    }
  }

  const headers = parsed.meta.fields ?? [];
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      errors.push(`필수 컬럼 누락: '${required}'`);
    }
  }

  if (errors.some((e) => e.startsWith("필수 컬럼"))) {
    return { rows: [], errors };
  }

  const rows: ProductCsvRow[] = [];

  parsed.data.forEach((row, index) => {
    const rowNum = index + 2;
    const productName = getField(row, "상품명");

    if (!productName) {
      errors.push(`행 ${rowNum}: 상품명이 비어 있습니다.`);
      return;
    }

    rows.push({
      product_name: productName,
      sku: getField(row, "상품번호(스마트스토어)") || null,
      category: buildCategory(
        row["대분류"],
        row["중분류"],
        row["소분류"]
      ),
      image_url: (() => {
        const url = getField(row, "대표이미지 URL");
        return url ? normalizeNaverImageUrl(url) : null;
      })(),
      selling_price: parseNumber(row["판매가"]),
      stock_qty: parseNumber(row["재고수량"]),
      is_active: parseActiveStatus(row["판매상태"]),
    });
  });

  return { rows, errors };
}
