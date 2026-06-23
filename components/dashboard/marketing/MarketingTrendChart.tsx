"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MarketingTrendPoint } from "@/types/adReports";

const SPEND_COLOR = "#9CA3AF";
const REVENUE_COLOR = "#2563EB";

function formatKrwShort(v: number): string {
  if (v >= 10_000) {
    return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만`;
  }
  return v.toLocaleString("ko-KR");
}

interface MarketingTrendChartProps {
  data: MarketingTrendPoint[];
}

export default function MarketingTrendChart({
  data,
}: MarketingTrendChartProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-6">
        광고비 vs 매출 추이
      </h3>
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
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
              formatter={(value) =>
                `${Number(value).toLocaleString("ko-KR")}원`
              }
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            <Line
              type="monotone"
              dataKey="spend"
              name="광고비"
              stroke={SPEND_COLOR}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              name="기여 매출"
              stroke={REVENUE_COLOR}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
