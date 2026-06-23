"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import DashboardDateFilter from "@/components/dashboard/DashboardDateFilter";
import SalesKpiCards from "@/components/dashboard/sales/SalesKpiCards";
import SalesTrendChart from "@/components/dashboard/sales/SalesTrendChart";
import SalesTopProducts from "@/components/dashboard/sales/SalesTopProducts";
import SalesCategoryDonut from "@/components/dashboard/sales/SalesCategoryDonut";
import SalesWeeklyChart from "@/components/dashboard/sales/SalesWeeklyChart";
import {
  defaultDateFilter,
  getSalesTabData,
} from "@/lib/dashboardSales";
import type { DateFilterValue, SalesTabData } from "@/types/dashboardSales";

interface DashboardSalesTabProps {
  refreshKey: number;
}

export default function DashboardSalesTab({ refreshKey }: DashboardSalesTabProps) {
  const [filter, setFilter] = useState<DateFilterValue>(defaultDateFilter);
  const [data, setData] = useState<SalesTabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSalesTabData(filter);
      setData(result);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "매출 데이터를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const trendTitle =
    filter.granularity === "year"
      ? "월별 매출 추이"
      : filter.granularity === "month"
        ? "일별 매출 추이"
        : "시간대별 매출 추이";

  return (
    <div className="space-y-6">
      <DashboardDateFilter value={filter} onChange={setFilter} />

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
          <SalesKpiCards kpi={data.kpi} />
          <SalesTrendChart data={data.trend} title={trendTitle} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SalesTopProducts products={data.topProducts} showProfit />
            <SalesCategoryDonut categories={data.categories} showList />
          </div>
          <SalesWeeklyChart data={data.weekly} />
        </>
      ) : null}
    </div>
  );
}
