import crypto from "crypto";

const API_KEY = process.env.NAVER_AD_API_KEY ?? "";
const SECRET_KEY = process.env.NAVER_AD_SECRET_KEY ?? "";
const CUSTOMER_ID = process.env.NAVER_AD_CUSTOMER_ID ?? "";
const BASE_URL = "https://api.naver.com";

// ── HMAC-SHA256 서명 생성 ─────────────────────────────────────────
function getHeaders(method: string, uri: string): Record<string, string> {
  const timestamp = String(Date.now());
  const message = `${timestamp}.${method}.${uri}`;
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(message)
    .digest("base64");

  return {
    "X-API-KEY": API_KEY,
    "X-CUSTOMER": CUSTOMER_ID,
    "X-Timestamp": timestamp,
    "X-Signature": signature,
    "Content-Type": "application/json; charset=UTF-8",
  };
}

// ── 타입 ─────────────────────────────────────────────────────────
export interface NaverAdCampaign {
  nccCampaignId: string;
  campaignName: string;
  campaignTp: string;
  status: string;
}

export interface NaverAdStat {
  id: string;          // campaignId
  date: string;        // YYYY-MM-DD
  impCnt: number;      // 노출수
  clkCnt: number;      // 클릭수
  salesAmt: number;    // 광고비 (원)
  ctr: number;         // 클릭률 (%)
  cpc: number;         // 클릭당 비용
  ror: number;         // ROAS (% — 100으로 나눠야 배수)
}

// ── 캠페인 목록 조회 ──────────────────────────────────────────────
export async function fetchNaverAdCampaigns(): Promise<NaverAdCampaign[]> {
  if (!API_KEY || !SECRET_KEY || !CUSTOMER_ID) {
    throw new Error("네이버 검색광고 API 환경변수가 설정되지 않았습니다.");
  }

  const uri = "/ncc/campaigns";
  const res = await fetch(`${BASE_URL}${uri}`, {
    headers: getHeaders("GET", uri),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`캠페인 조회 실패 (${res.status}): ${text}`);
  }

  const data = await res.json() as NaverAdCampaign[];
  return data;
}

// ── 캠페인 일별 통계 조회 ────────────────────────────────────────
// dateFrom, dateTo: "YYYY-MM-DD"
export async function fetchNaverAdStats(
  campaignIds: string[],
  dateFrom: string,
  dateTo: string
): Promise<NaverAdStat[]> {
  if (campaignIds.length === 0) return [];

  const uri = "/stats";
  const params = new URLSearchParams({
    ids: JSON.stringify(campaignIds),
    fields: JSON.stringify(["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "ror"]),
    datePreset: "yesterday",
    timeIncrement: "1",
  });

  const res = await fetch(`${BASE_URL}${uri}?${params.toString()}`, {
    headers: getHeaders("GET", uri),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`통계 조회 실패 (${res.status}): ${text}`);
  }

  // 응답: { data: [ { id, impCnt, clkCnt, salesAmt, ctr, cpc, ror, date } ] }
  const body = await res.json() as { data?: NaverAdStat[] };
  return body.data ?? [];
}

// ── STATREPORT 타입 ───────────────────────────────────────────────
export interface StatReportJob {
  reportJobId: number;
  status: "REGIST" | "RUNNING" | "BUILT" | "NONE" | "ERROR" | "WAITING" | "AGGREGATING";
  downloadUrl: string | null;
  reportTp: string;
  statDt: string;
}

// ── 대용량 보고서 생성 요청 ───────────────────────────────────────
// POST /stat-reports
// reportTp: "AD" (광고효과보고서 — 쇼핑검색 포함 캠페인별 일별 성과)
// statDate: "YYYY-MM-DD" (내부에서 statDt YYYYMMDD로 변환)
export async function createStatReport(
  reportTp: string,
  statDate: string
): Promise<number> {
  if (!API_KEY || !SECRET_KEY || !CUSTOMER_ID) {
    throw new Error("네이버 검색광고 API 환경변수가 설정되지 않았습니다.");
  }

  const uri = "/stat-reports";
  const statDt = statDate.replace(/-/g, "");
  const body = JSON.stringify({ reportTp, statDt });

  const res = await fetch(`${BASE_URL}${uri}`, {
    method: "POST",
    headers: getHeaders("POST", uri),
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`보고서 생성 실패 (${res.status}): ${text}`);
  }

  const data = await res.json() as { reportJobId: number };
  return data.reportJobId;
}

// ── 대용량 보고서 상태 조회 ───────────────────────────────────────
// GET /stat-reports/{reportJobId}
export async function getStatReport(reportJobId: number): Promise<StatReportJob> {
  const uri = `/stat-reports/${reportJobId}`;

  const res = await fetch(`${BASE_URL}${uri}`, {
    headers: getHeaders("GET", uri),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`보고서 조회 실패 (${res.status}): ${text}`);
  }

  return await res.json() as StatReportJob;
}

// ── 보고서 TSV 다운로드 + 파싱 ───────────────────────────────────
export interface AdReportRow {
  campaignId: string;
  campaignName: string;
  statDate: string;
  impCnt: number;
  clkCnt: number;
  salesAmt: number;
  ctr: number;
  cpc: number;
  ror: number;
}

function formatStatDate(raw: string): string {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw.slice(0, 10);
}

async function downloadStatReportTsv(downloadUrl: string): Promise<string> {
  const url = new URL(downloadUrl);
  const authtoken = url.searchParams.get("authtoken");
  if (!authtoken) throw new Error("downloadUrl에 authtoken이 없습니다.");

  const uri = "/report-download";
  const params = new URLSearchParams({ authtoken });
  const fileVersion = url.searchParams.get("fileVersion");
  if (fileVersion) params.set("fileVersion", fileVersion);

  const res = await fetch(`${BASE_URL}${uri}?${params}`, {
    headers: getHeaders("GET", uri),
  });
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  return await res.text();
}

// AD 보고서 TSV: 헤더 없음, 소재 단위 → 캠페인+일자별 집계
// cols: date, customerId, campaignId, adGroupId, keywordId, adId, ...
export async function downloadAndParseStatReport(
  downloadUrl: string
): Promise<AdReportRow[]> {
  const text = await downloadStatReportTsv(downloadUrl);
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const aggregated = new Map<string, AdReportRow>();

  for (const line of lines) {
    const cols = line.split("\t");
    if (cols.length < 12) continue;

    const statDate = formatStatDate(cols[0]!.trim());
    const campaignId = cols[2]!.trim();
    if (!campaignId.startsWith("cmp-a001-02-")) continue;

    const impCnt = parseInt(cols[9] ?? "0", 10) || 0;
    const clkCnt = parseInt(cols[10] ?? "0", 10) || 0;
    const salesAmt = parseFloat(cols[11] ?? "0") || 0;

    const key = `${statDate}\t${campaignId}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.impCnt += impCnt;
      existing.clkCnt += clkCnt;
      existing.salesAmt += salesAmt;
    } else {
      aggregated.set(key, {
        campaignId,
        campaignName: "",
        statDate,
        impCnt,
        clkCnt,
        salesAmt,
        ctr: 0,
        cpc: 0,
        ror: 0,
      });
    }
  }

  const rows: AdReportRow[] = [];
  for (const row of aggregated.values()) {
    row.ctr = row.impCnt > 0 ? (row.clkCnt / row.impCnt) * 100 : 0;
    row.cpc = row.clkCnt > 0 ? row.salesAmt / row.clkCnt : 0;
    rows.push(row);
  }

  return rows;
}
