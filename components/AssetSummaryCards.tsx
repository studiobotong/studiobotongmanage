"use client";

import { TrendingUp, TrendingDown, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import type { AssetSnapshot, Cashflow } from "@/types/assets";
import {
  netInvestmentKrwFromCashflowsUpTo,
  todayDateStringKst,
} from "@/lib/netInvestment";

interface AssetSummaryCardsProps {
  snapshots: AssetSnapshot[];
  cashflows: Cashflow[];
}

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

interface CardProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
  badge?: { label: string; color: string };
}

function SummaryCard({
  title,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor = "text-gray-900",
  badge,
}: CardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      {badge && (
        <span className={`self-start text-xs font-semibold px-2.5 py-1 rounded-lg ${badge.color}`}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

export default function AssetSummaryCards({
  snapshots,
  cashflows,
}: AssetSummaryCardsProps) {
  const latest = snapshots.length
    ? [...snapshots].sort((a, b) =>
        b.snapshot_date.localeCompare(a.snapshot_date)
      )[0]
    : null;

  const totalAsset = latest?.total_asset ?? 0;

  let totalDeposit = 0;
  let totalWithdraw = 0;

  for (const cf of cashflows) {
    if (cf.type === "DEPOSIT") totalDeposit += cf.amount;
    else if (cf.type === "WITHDRAW") totalWithdraw += cf.amount;
  }

  // 순투자금: 스냅샷에 있으면 사용, 없으면 DEPOSIT/WITHDRAW만 누적(배당 제외)
  const netInvestment =
    latest?.net_investment ??
    netInvestmentKrwFromCashflowsUpTo(cashflows, todayDateStringKst());

  const profit =
    latest?.profit ??
    (netInvestment !== null ? totalAsset - netInvestment : null);

  const returnRate =
    latest?.return_rate ??
    (netInvestment && netInvestment > 0 && profit !== null
      ? (profit / netInvestment) * 100
      : null);

  const isProfit = profit !== null && profit >= 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        title="총 자산"
        value={totalAsset > 0 ? formatKRW(totalAsset) : "-"}
        sub={latest ? `${latest.snapshot_date} 기준` : "데이터 없음"}
        icon={TrendingUp}
        iconBg="bg-indigo-50"
        iconColor="text-indigo-500"
        badge={
          returnRate !== null
            ? {
                label: `${returnRate >= 0 ? "+" : ""}${returnRate.toFixed(2)}%`,
                color: returnRate >= 0
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-500",
              }
            : undefined
        }
      />
      <SummaryCard
        title="순투자금"
        value={netInvestment !== null ? formatKRW(netInvestment) : "-"}
        sub="누적 입금 - 누적 출금"
        icon={TrendingUp}
        iconBg="bg-blue-50"
        iconColor="text-blue-500"
        badge={
          profit !== null
            ? {
                label: `${isProfit ? "+" : ""}${formatKRW(profit)}`,
                color: isProfit
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-red-50 text-red-500",
              }
            : undefined
        }
      />
      <SummaryCard
        title="누적 입금액"
        value={cashflows.length > 0 ? formatKRW(totalDeposit) : "-"}
        sub={cashflows.length > 0 ? `${cashflows.length}건` : "cashflow 데이터 없음"}
        icon={ArrowDownToLine}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-500"
        valueColor="text-emerald-700"
      />
      <SummaryCard
        title="누적 출금액"
        value={cashflows.length > 0 ? formatKRW(totalWithdraw) : "-"}
        sub={totalWithdraw > 0 ? "출금 합산" : "출금 내역 없음"}
        icon={totalWithdraw > 0 ? TrendingDown : ArrowUpFromLine}
        iconBg="bg-rose-50"
        iconColor="text-rose-400"
        valueColor="text-rose-600"
      />
    </div>
  );
}
