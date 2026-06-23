"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BarChart3 } from "lucide-react";
import SalesTrendChart from "@/components/dashboard/sales/SalesTrendChart";
import {
  defaultHomeChartFilter,
  formatHomeChartSubtitle,
  getHomeTrendData,
  homeChartTitle,
} from "@/lib/dashboardSales";
import { todayKst } from "@/lib/kstDate";
import type { DateFilterGranularity, DateFilterValue } from "@/types/dashboardSales";
import type { SalesBarPoint } from "@/types/dashboardSales";

const GRANULARITY_OPTIONS: { value: DateFilterGranularity; label: string }[] = [
  { value: "year", label: "연" },
  { value: "month", label: "월" },
  { value: "day", label: "일" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface HomeSalesTrendChartProps {
  refreshKey?: number;
}

export default function HomeSalesTrendChart({
  refreshKey = 0,
}: HomeSalesTrendChartProps) {
  const [filter, setFilter] = useState<DateFilterValue>(defaultHomeChartFilter);
  const [data, setData] = useState<SalesBarPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getHomeTrendData(filter);
      setData(result);
    } catch (e) {
      console.error("[HomeSalesTrendChart]", e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const update = (patch: Partial<DateFilterValue>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  const selectGranularity = (granularity: DateFilterGranularity) => {
    const today = todayKst();
    const [y, m, d] = today.split("-").map(Number);
    setFilter((prev) => ({
      ...prev,
      granularity,
      year: y!,
      month: m!,
      day: d!,
    }));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">
            {homeChartTitle(filter)}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {formatHomeChartSubtitle(filter)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => selectGranularity(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter.granularity === opt.value
                    ? "bg-[#2563EB] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {filter.granularity === "month" && (
            <select
              value={filter.year}
              onChange={(e) => update({ year: Number(e.target.value) })}
              className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-gray-700 bg-white"
              aria-label="연도"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          )}
          {filter.granularity === "day" && (
            <>
              <select
                value={filter.year}
                onChange={(e) => update({ year: Number(e.target.value) })}
                className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-gray-700 bg-white"
                aria-label="연도"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                value={filter.month}
                onChange={(e) => update({ month: Number(e.target.value) })}
                className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-xs text-gray-700 bg-white"
                aria-label="월"
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </>
          )}
          <BarChart3 className="w-4 h-4 text-gray-300 hidden sm:block" />
        </div>
      </div>

      {loading && data.length === 0 ? (
        <div className="flex items-center justify-center h-44 sm:h-52 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">차트 불러오는 중…</span>
        </div>
      ) : (
        <div className="relative h-44 sm:h-52 w-full min-w-0">
          <SalesTrendChart data={data} title="" embedded />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
