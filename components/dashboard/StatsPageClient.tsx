"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import DashboardKpiCards from "@/components/dashboard/DashboardKpiCards";
import HomeSalesTrendChart from "@/components/dashboard/HomeSalesTrendChart";
import SalesTopProducts from "@/components/dashboard/sales/SalesTopProducts";
import SalesCategoryDonut from "@/components/dashboard/sales/SalesCategoryDonut";
import SalesWeeklyChart from "@/components/dashboard/sales/SalesWeeklyChart";
import { getDashboardData } from "@/lib/dashboard";
import type { DashboardData } from "@/types/dashboard";

export default function StatsPageClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboardData();
      setData(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "통계 데이터를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <>
      <div className="px-8 py-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <PageHeader
            title="통계 분석"
            description="판매 현황과 성과 지표를 한눈에 확인하세요"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span className="ml-1.5">새로고침</span>
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">데이터 불러오는 중…</span>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <DashboardKpiCards kpi={data.kpi} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HomeSalesTrendChart refreshKey={refreshKey} />
              <SalesTopProducts
                products={data.topProducts}
                title={`인기 상품 Top 5 · ${data.periodLabel}`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesCategoryDonut categories={data.categories} />
              <SalesWeeklyChart data={data.weekly} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
