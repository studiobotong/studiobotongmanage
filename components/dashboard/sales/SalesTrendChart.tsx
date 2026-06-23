"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { SalesBarPoint } from "@/types/dashboardSales";

const ACCENT = "#2563EB";

function formatKrwShort(v: number): string {
  if (v >= 10_000) {
    return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  }
  return v.toLocaleString("ko-KR");
}

function formatKrwFull(v: number): string {
  return `${v.toLocaleString("ko-KR")}원`;
}

interface SalesTrendChartProps {
  data: SalesBarPoint[];
  title: string;
  /** true면 외부 카드 없이 차트만 렌더 (HomeSalesTrendChart용) */
  embedded?: boolean;
}

export default function SalesTrendChart({
  data,
  title,
  embedded = false,
}: SalesTrendChartProps) {
  const chart = (
    <div
      className={
        embedded ? "h-44 sm:h-52 w-full min-w-0" : "h-64 sm:h-72 w-full min-w-0"
      }
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={{ stroke: "#E5E7EB" }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#9CA3AF" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatKrwShort}
            width={48}
          />
          <Tooltip
            formatter={(value) => formatKrwFull(Number(value))}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              fontSize: 13,
            }}
          />
          <Bar dataKey="sales" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList
              dataKey="sales"
              position="top"
              formatter={(v) => formatKrwShort(Number(v))}
              style={{ fontSize: 10, fill: "#6B7280" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (embedded) return chart;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-6">{title}</h3>
      {chart}
    </div>
  );
}
