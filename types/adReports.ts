export type AdPlatform = "meta" | "naver";

export interface AdReport {
  id: string;
  platform: AdPlatform;
  campaign_name: string | null;
  report_date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  created_at: string;
}

export interface AdReportInput {
  platform: AdPlatform;
  campaign_name?: string;
  report_date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface AdReportUploadResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

export type MarketingPlatformFilter = "all" | AdPlatform;

export interface MarketingKpi {
  totalSpend: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  spendChangePct: number | null;
  roasChangePct: number | null;
}

export interface MarketingTrendPoint {
  label: string;
  spend: number;
  revenue: number;
  key: string;
}

export interface MarketingCampaignRow {
  campaignName: string;
  platform: AdPlatform;
  spend: number;
  revenue: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
}

export interface MarketingTabData {
  kpi: MarketingKpi;
  trend: MarketingTrendPoint[];
  campaigns: MarketingCampaignRow[];
}
