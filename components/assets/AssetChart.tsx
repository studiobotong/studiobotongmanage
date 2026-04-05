"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AssetItem } from "@/lib/fetchAssets";

interface Props {
  items: AssetItem[];
  totalEvaluation: number;
}

const CHART_COLORS = [
  "#5b6af4",
  "#818cf8",
  "#34d399",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ec4899",
];

function formatKRWShort(value: number): string {
  if (value >= 100_000_000) {
    return `${(value / 100_000_000).toFixed(1)}억`;
  }
  if (value >= 10_000_000) {
    return `${(value / 10_000_000).toFixed(1)}천만`;
  }
  if (value >= 10_000) {
    return `${Math.floor(value / 10_000).toLocaleString()}만`;
  }
  return value.toLocaleString();
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: { pct: string };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 min-w-[120px]">
      <p className="text-xs font-semibold text-gray-800 mb-1.5">{d.name}</p>
      <p className="text-xs text-gray-500 tabular-nums">
        {formatKRWShort(d.value)}원
      </p>
      <p className="text-xs font-semibold text-[#5b6af4] mt-0.5">
        {d.payload.pct}%
      </p>
    </div>
  );
}

interface LegendPayloadItem {
  value: string;
  color: string;
}

function CustomLegend({ payload }: { payload?: LegendPayloadItem[] }) {
  if (!payload) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-gray-500 truncate max-w-[80px]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AssetChart({ items, totalEvaluation }: Props) {
  if (!items.length || totalEvaluation <= 0) return null;

  // Top 8 by evaluation amount; group the rest as "기타"
  const sorted = [...items].sort(
    (a, b) => b.evaluationAmount - a.evaluationAmount
  );
  const top = sorted.slice(0, 8);
  const rest = sorted.slice(8);

  const chartData = top.map((item) => ({
    name: item.name,
    value: item.evaluationAmount,
    pct: ((item.evaluationAmount / totalEvaluation) * 100).toFixed(1),
  }));

  if (rest.length > 0) {
    const restTotal = rest.reduce((s, i) => s + i.evaluationAmount, 0);
    chartData.push({
      name: "기타",
      value: restTotal,
      pct: ((restTotal / totalEvaluation) * 100).toFixed(1),
    });
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={65}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          stroke="none"
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
