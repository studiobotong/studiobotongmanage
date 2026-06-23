"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SalesWeeklyPoint } from "@/types/dashboardSales";

const ACCENT = "#2563EB";

function formatKrwShort(v: number): string {
  if (v >= 10_000) {
    return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  }
  return v.toLocaleString("ko-KR");
}

interface SalesWeeklyChartProps {
  data: SalesWeeklyPoint[];
}

export default function SalesWeeklyChart({ data }: SalesWeeklyChartProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        주간 판매 추이
      </h3>
      <p className="text-xs text-gray-400 mb-6">이번 주 요일별 (월~일)</p>
      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="weekday"
              tick={{ fontSize: 12, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={{ stroke: "#E5E7EB" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9CA3AF" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatKrwShort}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "sales") {
                  return [`${Number(value).toLocaleString("ko-KR")}원`, "매출"];
                }
                return [`${value}건`, "주문"];
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                fontSize: 13,
              }}
            />
            <Bar dataKey="sales" name="sales" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
