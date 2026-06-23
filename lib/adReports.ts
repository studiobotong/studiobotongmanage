import {
  addDaysKst,
  monthEndKst,
  monthStartKst,
  todayKst,
  yearStartKst,
} from "./kstDate";
import { calcChangePct } from "./dashboardOrders";
import { supabase } from "./supabaseClient";
import type {
  AdReport,
  AdReportInput,
  AdReportUploadResult,
  MarketingCampaignRow,
  MarketingKpi,
  MarketingPlatformFilter,
  MarketingTabData,
  MarketingTrendPoint,
} from "@/types/adReports";
import type { DateFilterValue } from "@/types/dashboardSales";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(r: Record<string, unknown>): AdReport {
  return {
    id: String(r.id ?? ""),
    platform: (r.platform === "naver" ? "naver" : "meta") as AdReport["platform"],
    campaign_name: r.campaign_name != null ? String(r.campaign_name) : null,
    report_date: String(r.report_date ?? "").slice(0, 10),
    spend: toNum(r.spend),
    impressions: toNum(r.impressions),
    clicks: toNum(r.clicks),
    conversions: toNum(r.conversions),
    revenue: toNum(r.revenue),
    created_at: String(r.created_at ?? ""),
  };
}

function getPeriodRange(filter: DateFilterValue): {
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
} {
  const { granularity, year, month, day } = filter;

  if (granularity === "year") {
    return {
      start: yearStartKst(`${year}-01-01`),
      end: `${year}-12-31`,
      prevStart: yearStartKst(`${year - 1}-01-01`),
      prevEnd: `${year - 1}-12-31`,
    };
  }

  if (granularity === "month") {
    const start = monthStartKst(`${year}-${String(month).padStart(2, "0")}-01`);
    const end = monthEndKst(year, month);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      start,
      end,
      prevStart: monthStartKst(
        `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
      ),
      prevEnd: monthEndKst(prevYear, prevMonth),
    };
  }

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const prev = addDaysKst(dateStr, -1);
  return { start: dateStr, end: dateStr, prevStart: prev, prevEnd: prev };
}

async function fetchReportsInRange(
  start: string,
  end: string,
  platform: MarketingPlatformFilter
): Promise<AdReport[]> {
  let q = supabase
    .from("botong_ad_reports")
    .select("*")
    .gte("report_date", start)
    .lte("report_date", end)
    .order("report_date", { ascending: true });

  if (platform !== "all") {
    q = q.eq("platform", platform);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[adReports] 조회 오류:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

function calcRoas(spend: number, revenue: number): number | null {
  if (spend <= 0) return null;
  return (revenue / spend) * 100;
}

function calcCpa(spend: number, conversions: number): number | null {
  if (conversions <= 0) return null;
  return spend / conversions;
}

function calcCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) return null;
  return (clicks / impressions) * 100;
}

function aggregateKpi(reports: AdReport[]): {
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
} {
  return reports.reduce(
    (acc, r) => ({
      spend: acc.spend + r.spend,
      revenue: acc.revenue + r.revenue,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
    }),
    { spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 }
  );
}

function buildTrend(
  reports: AdReport[],
  filter: DateFilterValue
): MarketingTrendPoint[] {
  const { granularity, year, month, day } = filter;
  const trendMap = new Map<string, { spend: number; revenue: number }>();

  const sumByKey = (key: string, r: AdReport) => {
    const map = trendMap.get(key) ?? { spend: 0, revenue: 0 };
    map.spend += r.spend;
    map.revenue += r.revenue;
    trendMap.set(key, map);
  };

  for (const r of reports) {
    if (granularity === "year") {
      sumByKey(r.report_date.slice(0, 7), r);
    } else if (granularity === "month") {
      sumByKey(r.report_date, r);
    } else {
      sumByKey(r.report_date, r);
    }
  }

  if (granularity === "year") {
    const points: MarketingTrendPoint[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const val = trendMap.get(key) ?? { spend: 0, revenue: 0 };
      points.push({
        key,
        label: `${m}월`,
        spend: val.spend,
        revenue: val.revenue,
      });
    }
    return points;
  }

  if (granularity === "month") {
    const start = monthStartKst(
      `${year}-${String(month).padStart(2, "0")}-01`
    );
    const end = monthEndKst(year, month);
    const points: MarketingTrendPoint[] = [];
    let cursor = start;
    while (cursor <= end) {
      const val = trendMap.get(cursor) ?? { spend: 0, revenue: 0 };
      const [, , d] = cursor.split("-");
      points.push({
        key: cursor,
        label: `${Number(d)}일`,
        spend: val.spend,
        revenue: val.revenue,
      });
      cursor = addDaysKst(cursor, 1);
    }
    return points;
  }

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dayReports = reports.filter((r) => r.report_date === dateStr);
  const agg = aggregateKpi(dayReports);
  return [
    {
      key: dateStr,
      label: dateStr,
      spend: agg.spend,
      revenue: agg.revenue,
    },
  ];
}

function buildCampaigns(reports: AdReport[]): MarketingCampaignRow[] {
  const map = new Map<
    string,
    {
      campaignName: string;
      platform: AdReport["platform"];
      spend: number;
      revenue: number;
      impressions: number;
      clicks: number;
      conversions: number;
    }
  >();

  for (const r of reports) {
    const name = r.campaign_name || "—";
    const key = `${r.platform}\0${name}`;
    const existing = map.get(key);
    if (existing) {
      existing.spend += r.spend;
      existing.revenue += r.revenue;
      existing.impressions += r.impressions;
      existing.clicks += r.clicks;
      existing.conversions += r.conversions;
    } else {
      map.set(key, {
        campaignName: name,
        platform: r.platform,
        spend: r.spend,
        revenue: r.revenue,
        impressions: r.impressions,
        clicks: r.clicks,
        conversions: r.conversions,
      });
    }
  }

  return [...map.values()]
    .map((c) => ({
      campaignName: c.campaignName,
      platform: c.platform,
      spend: c.spend,
      revenue: c.revenue,
      roas: calcRoas(c.spend, c.revenue),
      cpa: calcCpa(c.spend, c.conversions),
      ctr: calcCtr(c.clicks, c.impressions),
    }))
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
}

export async function getMarketingTabData(
  filter: DateFilterValue,
  platform: MarketingPlatformFilter
): Promise<MarketingTabData> {
  const { start, end, prevStart, prevEnd } = getPeriodRange(filter);

  const [current, previous] = await Promise.all([
    fetchReportsInRange(start, end, platform),
    fetchReportsInRange(prevStart, prevEnd, platform),
  ]);

  const cur = aggregateKpi(current);
  const prev = aggregateKpi(previous);

  const roas = calcRoas(cur.spend, cur.revenue);
  const prevRoas = calcRoas(prev.spend, prev.revenue);

  const kpi: MarketingKpi = {
    totalSpend: cur.spend,
    roas,
    cpa: calcCpa(cur.spend, cur.conversions),
    ctr: calcCtr(cur.clicks, cur.impressions),
    spendChangePct: calcChangePct(cur.spend, prev.spend),
    roasChangePct:
      roas != null && prevRoas != null
        ? calcChangePct(roas, prevRoas)
        : null,
  };

  return {
    kpi,
    trend: buildTrend(current, filter),
    campaigns: buildCampaigns(current),
  };
}

export async function insertAdReport(
  input: AdReportInput
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("botong_ad_reports").insert({
    platform: input.platform,
    campaign_name: input.campaign_name ?? null,
    report_date: input.report_date,
    spend: input.spend,
    impressions: input.impressions,
    clicks: input.clicks,
    conversions: input.conversions,
    revenue: input.revenue,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function uploadAdReports(
  rows: AdReportInput[]
): Promise<AdReportUploadResult> {
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const result = await insertAdReport(row);
    if (result.ok) {
      inserted += 1;
    } else {
      skipped += 1;
      if (result.error && errors.length < 5) {
        errors.push(result.error);
      }
    }
  }

  return { inserted, skipped, errors };
}

export async function sumAdSpendInRange(
  start: string,
  end: string
): Promise<number> {
  const { data, error } = await supabase
    .from("botong_ad_reports")
    .select("spend")
    .gte("report_date", start)
    .lte("report_date", end);

  if (error) {
    console.error("[adReports] 광고비 합계 조회 오류:", error.message);
    return 0;
  }

  return (data ?? []).reduce((sum, row) => sum + toNum(row.spend), 0);
}

export function defaultMarketingDateFilter(): DateFilterValue {
  const today = todayKst();
  const [y, m, d] = today.split("-").map(Number);
  return {
    granularity: "month",
    year: y!,
    month: m!,
    day: d!,
  };
}
