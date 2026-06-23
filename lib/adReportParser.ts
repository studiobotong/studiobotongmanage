import * as XLSX from "xlsx";
import type { AdPlatform, AdReportInput } from "@/types/adReports";

function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[★⭐*()（）]/g, "");
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

    const partial = Object.entries(normMap).find(
      ([nk]) => nk.includes(normalized) || normalized.includes(nk)
    );
    if (partial) return row[partial[1]];
  }
  return undefined;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseNumber(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const cleaned = String(v).replace(/,/g, "").replace(/원/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseIntSafe(v: unknown): number {
  return Math.round(parseNumber(v));
}

function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
      v
    );
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86_400_000);
    if (!Number.isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
        d
      );
    }
  }
  const raw = String(v).trim();
  const m = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  return null;
}

function mapMetaRow(row: Record<string, unknown>): AdReportInput | null {
  const reportDate = parseDate(
    pick(row, ["날짜", "일자", "Date", "보고 시작", "보고시작"])
  );
  if (!reportDate) return null;

  return {
    platform: "meta",
    campaign_name:
      toStr(pick(row, ["캠페인명", "캠페인 이름", "Campaign name", "캠페인"])) ||
      undefined,
    report_date: reportDate,
    impressions: parseIntSafe(pick(row, ["노출", "노출수", "Impressions"])),
    clicks: parseIntSafe(pick(row, ["클릭", "클릭수", "Link clicks", "클릭(전체)"])),
    spend: parseNumber(
      pick(row, ["지출금액", "지출 금액", "Amount spent", "비용", "광고비"])
    ),
    conversions: parseIntSafe(
      pick(row, ["구매", "전환", "Purchases", "구매수", "전환수"])
    ),
    revenue: parseNumber(
      pick(row, [
        "구매전환값",
        "구매 전환값",
        "Purchase conversion value",
        "전환매출",
        "매출",
      ])
    ),
  };
}

function mapNaverRow(row: Record<string, unknown>): AdReportInput | null {
  const reportDate = parseDate(
    pick(row, ["날짜", "일자", "기간", "Date"])
  );
  if (!reportDate) return null;

  return {
    platform: "naver",
    campaign_name:
      toStr(pick(row, ["캠페인명", "캠페인", "Campaign"])) || undefined,
    report_date: reportDate,
    impressions: parseIntSafe(pick(row, ["노출수", "노출", "Impressions"])),
    clicks: parseIntSafe(pick(row, ["클릭수", "클릭", "Clicks"])),
    spend: parseNumber(
      pick(row, ["총비용", "총 비용", "비용", "광고비", "지출"])
    ),
    conversions: parseIntSafe(
      pick(row, ["전환수", "전환", "구매수", "Conversions"])
    ),
    revenue: parseNumber(
      pick(row, ["전환매출액", "전환 매출액", "매출", "전환매출"])
    ),
  };
}

function detectPlatform(headers: string[]): AdPlatform | null {
  const joined = headers.map(normalizeKey).join("|");
  if (
    joined.includes("구매전환값") ||
    joined.includes("purchases") ||
    joined.includes("amountspent")
  ) {
    return "meta";
  }
  if (joined.includes("총비용") || joined.includes("전환매출액")) {
    return "naver";
  }
  return null;
}

export function parseAdReportExcel(
  buffer: ArrayBuffer,
  platformHint?: AdPlatform
): { rows: AdReportInput[]; errors: string[] } {
  const errors: string[] = [];
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    return { rows: [], errors: ["엑셀 파일을 읽을 수 없습니다."] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], errors: ["시트가 없습니다."] };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  if (jsonRows.length === 0) {
    return { rows: [], errors: ["데이터 행이 없습니다."] };
  }

  const headers = Object.keys(jsonRows[0] ?? {});
  const platform = platformHint ?? detectPlatform(headers) ?? "meta";
  const mapper = platform === "meta" ? mapMetaRow : mapNaverRow;

  const rows: AdReportInput[] = [];
  let skipped = 0;

  for (const row of jsonRows) {
    const mapped = mapper(row);
    if (!mapped) {
      skipped += 1;
      continue;
    }
    if (!mapped.campaign_name) {
      mapped.campaign_name = "—";
    }
    rows.push(mapped);
  }

  if (rows.length === 0) {
    errors.push(
      `유효한 행이 없습니다. (스킵 ${skipped}건, 플랫폼: ${platform})`
    );
  }

  return { rows, errors };
}
