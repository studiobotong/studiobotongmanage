"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AssetSnapshotHolding } from "@/types/assets";

interface DashboardAllocationChartProps {
  holdings: AssetSnapshotHolding[];
  usdKrwRate: number;
}

const COLORS = {
  krw: "#5b6af4",
  usd: "#10b981",
};

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

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { pct: number } }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800 mb-1">{item.name}</p>
      <p className="text-gray-600">{formatKRW(item.value)}</p>
      <p className="text-gray-400 text-xs mt-0.5">{item.payload.pct.toFixed(1)}%</p>
    </div>
  );
}

export default function DashboardAllocationChart({
  holdings,
  usdKrwRate,
}: DashboardAllocationChartProps) {
  const { pieData, totalKRW, totalUSD, totalKRWEquiv } = useMemo(() => {
    const krw = holdings
      .filter((h) => h.currency === "KRW")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usd = holdings
      .filter((h) => h.currency === "USD")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usdInKRW = usd * usdKrwRate;
    const total = krw + usdInKRW || 1;

    return {
      pieData: [
        {
          name: "한국 자산",
          value: krw,
          pct: (krw / total) * 100,
          color: COLORS.krw,
        },
        {
          name: "미국 자산",
          value: usdInKRW,
          pct: (usdInKRW / total) * 100,
          color: COLORS.usd,
        },
      ].filter((d) => d.value > 0),
      totalKRW: krw,
      totalUSD: usd,
      totalKRWEquiv: total,
    };
  }, [holdings, usdKrwRate]);

  const legends = [
    {
      name: "한국 자산",
      bgClass: "bg-indigo-50/60 border-indigo-100",
      dotColor: "bg-[#5b6af4]",
      pctColor: "text-[#5b6af4]",
      sub: formatKRW(totalKRW),
    },
    {
      name: "미국 자산",
      bgClass: "bg-emerald-50/60 border-emerald-100",
      dotColor: "bg-emerald-500",
      pctColor: "text-emerald-600",
      sub: `$${totalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${formatKRW(totalUSD * usdKrwRate)})`,
    },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden h-full">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">자산 비율</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          KRW · USD 비중 (환율 {usdKrwRate.toLocaleString()}원/USD 기준)
        </p>
      </div>

      {pieData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          보유 자산 데이터가 없습니다
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 px-6 py-6">
          {/* Donut */}
          <div className="w-full h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="w-full space-y-2.5">
            {legends.map((leg) => {
              const item = pieData.find((d) => d.name === leg.name);
              if (!item) return null;
              return (
                <div
                  key={leg.name}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border ${leg.bgClass}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${leg.dotColor}`} />
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{leg.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{leg.sub}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {formatKRW(item.value)}
                    </p>
                    <p className={`text-xs font-semibold ${leg.pctColor}`}>
                      {item.pct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="w-full pt-2 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-400">총 자산 (KRW 환산)</span>
            <span className="text-sm font-bold text-gray-800">
              {formatKRW(totalKRWEquiv)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
