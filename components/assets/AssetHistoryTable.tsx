"use client";

import { TrendingUp, TrendingDown, DatabaseZap } from "lucide-react";
import type { AssetHistory } from "@/types/assets";
import { formatKRWCompact } from "@/lib/assets";

interface Props {
  history: AssetHistory[];
}

function ProfitCell({ value }: { value: number }) {
  const isProfit = value >= 0;
  const isNeutral = value === 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${
        isNeutral
          ? "text-gray-400"
          : isProfit
          ? "text-emerald-600"
          : "text-red-500"
      }`}
    >
      {!isNeutral &&
        (isProfit ? (
          <TrendingUp className="w-3 h-3 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-3 h-3 flex-shrink-0" />
        ))}
      {isProfit && !isNeutral ? "+" : ""}
      {formatKRWCompact(value)}
    </span>
  );
}

function RateCell({ value }: { value: number }) {
  const isProfit = value >= 0;
  const isNeutral = value === 0;
  return (
    <span
      className={`text-sm font-semibold tabular-nums ${
        isNeutral ? "text-gray-400" : isProfit ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isProfit && !isNeutral ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

export default function AssetHistoryTable({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
          <DatabaseZap className="w-5 h-5 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">
          저장된 스냅샷이 없습니다
        </p>
        <p className="text-xs text-gray-400 mt-1.5">
          상단 저장 버튼으로 현재 자산 상태를 기록하세요
        </p>
      </div>
    );
  }

  // Most recent first
  const sorted = [...history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-gray-100">
            {[
              { label: "날짜", align: "left" },
              { label: "매입금액", align: "right" },
              { label: "평가금액", align: "right" },
              { label: "평가손익", align: "right" },
              { label: "수익률", align: "right" },
              { label: "양도소득(PSY)", align: "right" },
              { label: "국내수익", align: "right" },
            ].map((col, i) => (
              <th
                key={i}
                className={`px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => (
            <tr
              key={entry.id}
              className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/70 transition-colors ${
                idx % 2 === 0 ? "" : "bg-gray-50/20"
              }`}
            >
              {/* 날짜 */}
              <td className="px-4 py-3">
                <span className="text-sm font-mono font-medium text-gray-700">
                  {entry.date}
                </span>
              </td>

              {/* 매입금액 */}
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-600 tabular-nums">
                  {formatKRWCompact(entry.totalBuyAmount)}
                </span>
              </td>

              {/* 평가금액 */}
              <td className="px-4 py-3 text-right">
                <span className="text-sm font-semibold text-gray-800 tabular-nums">
                  {formatKRWCompact(entry.totalEvaluationAmount)}
                </span>
              </td>

              {/* 평가손익 */}
              <td className="px-4 py-3 text-right">
                <ProfitCell value={entry.totalProfit} />
              </td>

              {/* 수익률 */}
              <td className="px-4 py-3 text-right">
                <RateCell value={entry.totalReturnRate} />
              </td>

              {/* 양도소득 */}
              <td className="px-4 py-3 text-right">
                <ProfitCell value={entry.psyAmount} />
              </td>

              {/* 국내수익 */}
              <td className="px-4 py-3 text-right">
                <ProfitCell value={entry.domesticProfit} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
