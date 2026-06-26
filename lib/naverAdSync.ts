import { btmSupabase } from "./btmSupabaseClient";
import { fetchNaverAdCampaigns, fetchNaverAdStats } from "./naverAdApi";

export interface AdSyncResult {
  upserted: number;
  errors: string[];
  elapsedMs: number;
  dateRange: { from: string; to: string };
}

// KST 기준 날짜 문자열 반환 (YYYY-MM-DD)
function kstDateStr(offsetDays = 0): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setDate(kst.getDate() + offsetDays);
  return kst.toISOString().slice(0, 10);
}

export async function syncNaverAdReports(
  dateFrom?: string,
  dateTo?: string
): Promise<AdSyncResult> {
  const started = Date.now();
  const from = dateFrom ?? kstDateStr(-1); // 기본: 어제
  const to = dateTo ?? kstDateStr(-1);

  const result: AdSyncResult = {
    upserted: 0,
    errors: [],
    elapsedMs: 0,
    dateRange: { from, to },
  };

  try {
    // 1. 캠페인 목록 조회
    const campaigns = await fetchNaverAdCampaigns();
    if (campaigns.length === 0) {
      result.errors.push("캠페인이 없습니다.");
      result.elapsedMs = Date.now() - started;
      return result;
    }

    const campaignMap: Record<string, string> = {};
    for (const c of campaigns) {
      campaignMap[c.nccCampaignId] = c.campaignName;
    }
    const campaignIds = Object.keys(campaignMap);

    // 2. 일별 통계 조회
    const stats = await fetchNaverAdStats(campaignIds, from, to);

    // 3. btm_ad_reports에 upsert
    for (const stat of stats) {
      const { error } = await btmSupabase
        .from("btm_ad_reports")
        .upsert(
          {
            report_date: stat.date,
            campaign_id: stat.id,
            campaign_name: campaignMap[stat.id] ?? stat.id,
            channel: "naver_search_ad",
            imp_count: stat.impCnt ?? 0,
            click_count: stat.clkCnt ?? 0,
            cost: stat.salesAmt ?? 0,
            ctr: stat.ctr ?? 0,
            cpc: stat.cpc ?? 0,
            roas: (stat.ror ?? 0) / 100, // % → 배수
          },
          { onConflict: "report_date,campaign_id" }
        );

      if (error) {
        result.errors.push(`${stat.date} ${stat.id}: ${error.message}`);
      } else {
        result.upserted++;
      }
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  result.elapsedMs = Date.now() - started;
  return result;
}
