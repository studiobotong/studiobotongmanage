"use client";

import clsx from "clsx";
import type { Cashflow } from "@/types/assets";

interface RecentTransactionsProps {
  cashflows: Cashflow[];
  limit?: number;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  DEPOSIT:  { label: "입금", bg: "bg-emerald-50", text: "text-emerald-600" },
  WITHDRAW: { label: "출금", bg: "bg-amber-50",   text: "text-amber-600"   },
  DIVIDEND: { label: "배당", bg: "bg-blue-50",    text: "text-blue-600"    },
};

function formatKRW(v: number, currency = "KRW"): string {
  if (currency === "USD") {
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

export default function RecentTransactions({
  cashflows,
  limit = 10,
}: RecentTransactionsProps) {
  const recent = [...cashflows]
    .sort((a, b) => b.flow_date.localeCompare(a.flow_date))
    .slice(0, limit);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">최근 현금 흐름</h3>
          <p className="text-xs text-gray-400 mt-0.5">최근 {limit}건</p>
        </div>
        <span className="text-xs font-semibold text-[#5b6af4] bg-[#eef0fe] px-2.5 py-1 rounded-lg">
          {cashflows.length}건
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="flex items-center justify-center py-14 text-sm text-gray-400">
          현금 흐름 내역이 없습니다
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {recent.map((cf) => {
            const cfg = TYPE_CONFIG[cf.type] ?? {
              label: cf.type,
              bg: "bg-gray-50",
              text: "text-gray-500",
            };
            return (
              <div
                key={cf.id}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
              >
                <div
                  className={clsx(
                    "flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg min-w-[40px] text-center",
                    cfg.bg,
                    cfg.text
                  )}
                >
                  {cfg.label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {cf.memo || cfg.label}
                  </p>
                  {cf.account && (
                    <p className="text-xs text-gray-400 mt-0.5">{cf.account}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-800 tabular-nums">
                    {formatKRW(cf.amount, cf.currency)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(cf.flow_date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
