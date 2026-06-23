"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import Button from "@/components/Button";
import DashboardHomePeriodFilter from "@/components/dashboard/DashboardHomePeriodFilter";
import DashboardKpiCards from "@/components/dashboard/DashboardKpiCards";
import HomeSalesTrendChart from "@/components/dashboard/HomeSalesTrendChart";
import HomeTopProducts from "@/components/dashboard/HomeTopProducts";
import { defaultHomePeriodFilter, getDashboardHomeData } from "@/lib/dashboard";
import type { DashboardHomeData, HomePeriodFilter } from "@/types/dashboard";

interface DashboardHomeTabProps {
  refreshKey?: number;
}

export default function DashboardHomeTab({ refreshKey = 0 }: DashboardHomeTabProps) {
  const [period, setPeriod] = useState<HomePeriodFilter>(defaultHomePeriodFilter);
  const [data, setData] = useState<DashboardHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalRefresh, setInternalRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardHomeData(period);
      setData(result);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "대시보드 데이터를 불러오지 못했습니다.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load, refreshKey, internalRefresh]);

  const handleRefresh = () => {
    setInternalRefresh((k) => k + 1);
  };

  const periodLabel = data?.periodLabel ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <DashboardHomePeriodFilter value={period} onChange={setPeriod} />
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span className="ml-1.5">새로고침</span>
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
          <DashboardKpiCards kpi={data.kpi} />

          <HomeSalesTrendChart refreshKey={refreshKey + internalRefresh} />

          <HomeTopProducts
            products={data.topProducts}
            periodLabel={periodLabel}
            loading={loading}
          />
        </>
      ) : null}
    </div>
  );
}
