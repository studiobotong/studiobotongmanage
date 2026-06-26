import { btmSupabase } from "./btmSupabaseClient";
import {
  createStatReport,
  getStatReport,
  downloadAndParseStatReport,
  fetchNaverAdCampaigns,
} from "./naverAdApi";

// ── btm_settings에서 값 읽기/쓰기 ────────────────────────────────
async function getSetting(key: string): Promise<string | null> {
  const { data } = await btmSupabase
    .from("btm_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await btmSupabase
    .from("btm_settings")
    .upsert({ key, value }, { onConflict: "key" });
}

async function deleteSetting(key: string): Promise<void> {
  await btmSupabase.from("btm_settings").delete().eq("key", key);
}

// KST 기준 어제 날짜 (YYYY-MM-DD)
function yesterdayKst(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() - 1);
  return kst.toISOString().slice(0, 10);
}

// ── STEP 1: 보고서 생성 요청 (Cron 1) ────────────────────────────
export interface RequestReportResult {
  reportJobId: number;
  statDate: string;
  error?: string;
}

export async function requestNaverAdReport(
  statDate?: string
): Promise<RequestReportResult> {
  const date = statDate ?? yesterdayKst();

  try {
    const reportJobId = await createStatReport("AD", date);
    // jobId와 날짜를 settings에 저장
    await setSetting(
      "pending_ad_report",
      JSON.stringify({ reportJobId, statDate: date })
    );
    return { reportJobId, statDate: date };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { reportJobId: 0, statDate: date, error };
  }
}

// ── STEP 2: 보고서 다운로드 + DB 저장 (Cron 2) ────────────────────
export interface ProcessReportResult {
  upserted: number;
  statDate: string;
  errors: string[];
  status: "BUILT" | "WAITING" | "ERROR" | "NO_PENDING";
}

export async function processNaverAdReport(): Promise<ProcessReportResult> {
  // 1. 저장된 jobId 확인
  const pending = await getSetting("pending_ad_report");
  if (!pending) {
    return { upserted: 0, statDate: "", errors: [], status: "NO_PENDING" };
  }

  const { reportJobId, statDate } = JSON.parse(pending) as {
    reportJobId: number;
    statDate: string;
  };

  const result: ProcessReportResult = {
    upserted: 0,
    statDate,
    errors: [],
    status: "WAITING",
  };

  try {
    // 2. 보고서 상태 조회
    const job = await getStatReport(reportJobId);
    result.status = job.status as ProcessReportResult["status"];

    if (job.status === "ERROR") {
      await deleteSetting("pending_ad_report");
      result.errors.push(`보고서 생성 실패: jobId=${reportJobId}`);
      result.status = "ERROR";
      return result;
    }

    if (job.status !== "BUILT" || !job.downloadUrl) {
      // 아직 준비 중 — 다음 Cron에서 재시도
      return result;
    }

    // 3. TSV 다운로드 + 파싱
    const rows = await downloadAndParseStatReport(job.downloadUrl);

    // 캠페인명 조회 (AD 보고서 TSV에는 이름 없음)
    const campaigns = await fetchNaverAdCampaigns();
    const campaignMap = Object.fromEntries(
      campaigns.map((c) => [c.nccCampaignId, c.campaignName])
    );

    // 4. btm_ad_reports upsert
    for (const row of rows) {
      if (!row.campaignId || !row.statDate) continue;

      const { error } = await btmSupabase
        .from("btm_ad_reports")
        .upsert(
          {
            report_date:   row.statDate,
            campaign_id:   row.campaignId,
            campaign_name: campaignMap[row.campaignId] ?? row.campaignId,
            channel:       "naver_search_ad",
            imp_count:     row.impCnt,
            click_count:   row.clkCnt,
            cost:          Math.round(row.salesAmt),
            ctr:           row.ctr,
            cpc:           Math.round(row.cpc),
            roas:          row.ror / 100, // % → 배수
          },
          { onConflict: "report_date,campaign_id" }
        );

      if (error) {
        result.errors.push(`${row.statDate} ${row.campaignId}: ${error.message}`);
      } else {
        result.upserted++;
      }
    }

    // 5. 완료 → pending 설정 삭제
    await deleteSetting("pending_ad_report");
    result.status = "BUILT";
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  return result;
}
