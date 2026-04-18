"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AssetSnapshot, AssetSnapshotHolding } from "@/types/assets";

interface AssetAllocationChartProps {
  latestSnapshot?: AssetSnapshot | null;
  holdings?: AssetSnapshotHolding[];
  usdKrwRate?: number;
}

const COLORS = {
  kr: "#5b6af4",
  us: "#10b981",
  cash: "#f59e0b",
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

export default function AssetAllocationChart({
  latestSnapshot,
  holdings = [],
  usdKrwRate = 1460,
}: AssetAllocationChartProps) {
  const pieData = useMemo(() => {
    // 스냅샷에 breakdown 데이터가 있으면 우선 사용
    if (
      latestSnapshot &&
      (latestSnapshot.kr_asset != null ||
        latestSnapshot.us_asset != null ||
        latestSnapshot.cash_asset != null)
    ) {
      const total = latestSnapshot.total_asset || 1;
      return [
        {
          name: "국내",
          value: latestSnapshot.kr_asset ?? 0,
          pct: ((latestSnapshot.kr_asset ?? 0) / total) * 100,
          color: COLORS.kr,
        },
        {
          name: "미국",
          value: latestSnapshot.us_asset ?? 0,
          pct: ((latestSnapshot.us_asset ?? 0) / total) * 100,
          color: COLORS.us,
        },
        {
          name: "현금·기타",
          value: latestSnapshot.cash_asset ?? 0,
          pct: ((latestSnapshot.cash_asset ?? 0) / total) * 100,
          color: COLORS.cash,
        },
      ].filter((d) => d.value > 0);
    }

    // 보유 종목 기준 집계 (market 필드 활용)
    if (holdings.length > 0) {
      const toKRW = (h: AssetSnapshotHolding) =>
        h.currency === "USD" ? h.evaluated_amount * usdKrwRate : h.evaluated_amount;

      const kr = holdings
        .filter((h) => h.market === "KRX")
        .reduce((s, h) => s + toKRW(h), 0);
      const us = holdings
        .filter((h) => h.market === "NASDAQ" || h.market === "NYSE")
        .reduce((s, h) => s + toKRW(h), 0);
      const cash = holdings
        .filter((h) => h.market !== "KRX" && h.market !== "NASDAQ" && h.market !== "NYSE")
        .reduce((s, h) => s + toKRW(h), 0);
      const total = kr + us + cash || 1;

      return [
        { name: "국내",    value: kr,   pct: (kr   / total) * 100, color: COLORS.kr   },
        { name: "미국",    value: us,   pct: (us   / total) * 100, color: COLORS.us   },
        { name: "현금·기타", value: cash, pct: (cash / total) * 100, color: COLORS.cash },
      ].filter((d) => d.value > 0);
    }

    return [];
  }, [latestSnapshot, holdings, usdKrwRate]);

  const legends = [
    { name: "국내",     bgClass: "bg-indigo-50/60 border-indigo-100",  dotColor: "bg-[#5b6af4]",    pctColor: "text-[#5b6af4]"   },
    { name: "미국",     bgClass: "bg-emerald-50/60 border-emerald-100", dotColor: "bg-emerald-500",  pctColor: "text-emerald-600" },
    { name: "현금·기타", bgClass: "bg-amber-50/60 border-amber-100",    dotColor: "bg-amber-400",    pctColor: "text-amber-600"   },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">자산 구성</h3>
        <p className="text-xs text-gray-400 mt-0.5">국내 · 미국 · 현금 비중 (KRW 환산)</p>
      </div>

      {pieData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          자산 구성 데이터가 없습니다
        </div>
      ) : (
        <div className="flex flex-col md:flex-row items-center gap-6 px-6 py-6">
          <div className="w-full md:w-56 h-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
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

          <div className="flex-1 w-full space-y-2.5">
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
                    <p className="text-sm font-semibold text-gray-800">{leg.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatKRW(item.value)}</p>
                    <p className={`text-xs font-semibold ${leg.pctColor}`}>
                      {item.pct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
