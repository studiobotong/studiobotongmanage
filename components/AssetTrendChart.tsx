"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AssetSnapshot } from "@/types/assets";

// ---------------------------------------------------------------------------
// Period type & aggregation
// ---------------------------------------------------------------------------

type Period = "daily" | "monthly" | "yearly";

const PERIOD_BUTTONS: { key: Period; label: string }[] = [
  { key: "daily", label: "일" },
  { key: "monthly", label: "월" },
  { key: "yearly", label: "년" },
];

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function yearKey(dateStr: string): string {
  return dateStr.slice(0, 4);
}

/**
 * 기간별 집계 — 같은 월/연에서 마지막 레코드(날짜 오름차순 가정)를 반환합니다.
 */
function aggregateByPeriod(
  data: AssetSnapshot[],
  period: Period
): AssetSnapshot[] {
  if (period === "daily") return data;

  const map = new Map<string, AssetSnapshot>();
  for (const snap of data) {
    const key =
      period === "monthly"
        ? monthKey(snap.snapshot_date)
        : yearKey(snap.snapshot_date);
    map.set(key, snap);
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// KRW 포맷터
// ---------------------------------------------------------------------------

function formatKRW(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.floor((abs % 100_000_000) / 10_000);
    return man > 0
      ? `${sign}${eok}억 ${man.toLocaleString()}만원`
      : `${sign}${eok}억원`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.floor(abs / 10_000).toLocaleString()}만원`;
  }
  return `${sign}${abs.toLocaleString()}원`;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: AssetSnapshot }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const snap = payload[0].payload;
  const totalAsset = snap.total_asset;
  const investment = snap.net_investment ?? 0;
  const netProfit = investment > 0 ? totalAsset - investment : null;
  const returnRate =
    investment > 0 && netProfit !== null
      ? (netProfit / investment) * 100
      : null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="text-xs font-medium text-gray-400 mb-2.5">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#5b6af4]" />
            <span className="text-xs text-gray-500">총 자산</span>
          </div>
          <span className="text-sm font-bold text-gray-900">
            {formatKRW(totalAsset)}
          </span>
        </div>

        {investment > 0 && (
          <div className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-xs text-gray-500">투자금</span>
            </div>
            <span className="text-sm font-semibold text-amber-600">
              {formatKRW(investment)}
            </span>
          </div>
        )}

        {netProfit !== null && returnRate !== null && (
          <div className="border-t border-gray-100 mt-2 pt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-8">
              <span className="text-xs text-gray-500">순수익</span>
              <span
                className={`text-xs font-semibold ${
                  netProfit >= 0 ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                {netProfit >= 0 ? "+" : ""}
                {formatKRW(netProfit)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-8">
              <span className="text-xs text-gray-500">수익률</span>
              <span
                className={`text-xs font-bold ${
                  returnRate >= 0 ? "text-emerald-600" : "text-rose-500"
                }`}
              >
                {returnRate >= 0 ? "+" : ""}
                {returnRate.toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AssetTrendChartProps {
  snapshots: AssetSnapshot[];
}

export default function AssetTrendChart({ snapshots }: AssetTrendChartProps) {
  const [period, setPeriod] = useState<Period>("daily");

  const chartData = useMemo(
    () => aggregateByPeriod(snapshots, period),
    [snapshots, period]
  );

  // 투자금 라인이 의미있는 데이터인지 확인
  const hasInvestment = useMemo(
    () => chartData.some((d) => (d.net_investment ?? 0) > 0),
    [chartData]
  );

  const { yMin, yMax } = useMemo(() => {
    if (!chartData.length) return { yMin: 0, yMax: 0 };
    const allValues = chartData.flatMap((d) =>
      hasInvestment
        ? [d.total_asset, d.net_investment ?? d.total_asset]
        : [d.total_asset]
    );
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    return {
      yMin: Math.floor(min * 0.97),
      yMax: Math.ceil(max * 1.03),
    };
  }, [chartData, hasInvestment]);

  const xTickFormatter = (date: string) => {
    if (period === "yearly") return date.slice(0, 4);
    if (period === "monthly") return date.slice(0, 7);
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const yTickFormatter = (v: number) => {
    if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
    if (v >= 10_000) return `${Math.floor(v / 10_000)}만`;
    return v.toLocaleString();
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">자산 변동 추이</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            KRW 기준 · {chartData.length}개 데이터
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-xl p-1">
          {PERIOD_BUTTONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === key
                  ? "bg-[#5b6af4] text-white shadow-sm shadow-indigo-200"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="px-5 pt-4 flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-0.5 bg-[#5b6af4] rounded-full" />
          <span className="text-xs text-gray-500">총 자산</span>
        </div>
        {hasInvestment && (
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4" viewBox="0 0 20 4">
              <line
                x1="0" y1="2" x2="20" y2="2"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
            </svg>
            <span className="text-xs text-gray-500">투자금</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="px-2 py-4 flex-1">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-sm text-gray-400">
            자산 스냅샷 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 24, left: 12, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="snapshot_date"
                tickFormatter={xTickFormatter}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={yTickFormatter}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              {/* 총 자산 라인 */}
              <Line
                type="monotone"
                dataKey="total_asset"
                stroke="#5b6af4"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#5b6af4", strokeWidth: 0 }}
              />
              {/* 투자금 라인 (데이터 있을 때만) */}
              {hasInvestment && (
                <Line
                  type="monotone"
                  dataKey="net_investment"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
