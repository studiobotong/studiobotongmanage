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
    timeRange: JSON.stringify({ since: dateFrom, until: dateTo }),
    timeIncrement: "1",   // 일별 집계
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
