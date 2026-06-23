"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import Button from "@/components/Button";
import DashboardDateFilter from "@/components/dashboard/DashboardDateFilter";
import MarketingKpiCards from "@/components/dashboard/marketing/MarketingKpiCards";
import MarketingTrendChart from "@/components/dashboard/marketing/MarketingTrendChart";
import MarketingCampaignTable from "@/components/dashboard/marketing/MarketingCampaignTable";
import AdReportInputModal from "@/components/dashboard/marketing/AdReportInputModal";
import {
  defaultMarketingDateFilter,
  getMarketingTabData,
} from "@/lib/adReports";
import type { MarketingPlatformFilter, MarketingTabData } from "@/types/adReports";
import type { DateFilterValue } from "@/types/dashboardSales";

interface DashboardMarketingTabProps {
  refreshKey: number;
}

const PLATFORM_OPTIONS: { value: MarketingPlatformFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "meta", label: "메타" },
  { value: "naver", label: "네이버" },
];

export default function DashboardMarketingTab({
  refreshKey,
}: DashboardMarketingTabProps) {
  const [filter, setFilter] = useState<DateFilterValue>(
    defaultMarketingDateFilter
  );
  const [platform, setPlatform] = useState<MarketingPlatformFilter>("all");
  const [data, setData] = useState<MarketingTabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMarketingTabData(filter, platform);
      setData(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "마케팅 데이터를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [filter, platform]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
            {PLATFORM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPlatform(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  platform === opt.value
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <DashboardDateFilter value={filter} onChange={setFilter} />
        </div>
        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span className="ml-1.5">데이터 입력</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">데이터 불러오는 중…</span>
        </div>
      ) : data ? (
        <>
          <MarketingKpiCards kpi={data.kpi} />
          <MarketingTrendChart data={data.trend} />
          <MarketingCampaignTable campaigns={data.campaigns} />
        </>
      ) : null}

      <AdReportInputModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => void load()}
      />
    </div>
  );
}
