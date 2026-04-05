"use client";

import { useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  Landmark,
  PiggyBank,
  Pencil,
  Check,
} from "lucide-react";
import { formatKRW } from "@/lib/assets";
import type { AssetSummary } from "@/types/assets";

interface Props {
  summary: AssetSummary;
  onPsyChange: (value: number) => void;
  onDomesticProfitChange: (value: number) => void;
}

interface CardProps {
  title: string;
  value: string;
  sub?: string;
  subColor?: string;
  valueColor?: string;
  accentColor: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  badge?: React.ReactNode;
  editable?: boolean;
  editValue?: number;
  onEdit?: (value: number) => void;
}

function SummaryCard({
  title,
  value,
  sub,
  subColor = "text-gray-400",
  valueColor = "text-gray-900",
  accentColor,
  icon: Icon,
  iconColor,
  iconBg,
  badge,
  editable = false,
  editValue,
  onEdit,
}: CardProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(editValue?.toString() ?? "0");

  const handleSave = () => {
    const parsed = Number(inputVal.replace(/,/g, ""));
    if (!isNaN(parsed) && onEdit) {
      onEdit(parsed);
    }
    setEditing(false);
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 border-l-4 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${accentColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              {title}
            </p>
            {badge}
          </div>

          {editing ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                className="w-full text-lg font-bold border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-100 text-gray-800 tabular-nums"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center hover:bg-indigo-100 transition-colors flex-shrink-0"
              >
                <Check className="w-3.5 h-3.5 text-indigo-600" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <p
                className={`text-xl font-bold tabular-nums leading-tight break-all ${valueColor}`}
              >
                {value}
              </p>
              {editable && (
                <button
                  onClick={() => {
                    setInputVal(editValue?.toString() ?? "0");
                    setEditing(true);
                  }}
                  className="w-6 h-6 rounded-md bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors opacity-50 hover:opacity-100 flex-shrink-0"
                >
                  <Pencil className="w-3 h-3 text-gray-500" />
                </button>
              )}
            </div>
          )}

          {sub && !editing && (
            <p className={`text-xs mt-1.5 font-medium ${subColor}`}>{sub}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export default function AssetSummaryCards({
  summary,
  onPsyChange,
  onDomesticProfitChange,
}: Props) {
  const {
    totalBuyAmount,
    totalEvaluationAmount,
    totalProfit,
    totalReturnRate,
    psyAmount,
    domesticProfit,
  } = summary;

  const isProfit = totalProfit >= 0;
  const isPsy = psyAmount >= 0;
  const isDomestic = domesticProfit >= 0;

  const profitSign = isProfit ? "+" : "";
  const psySign = isPsy ? "+" : "";
  const domesticSign = isDomestic ? "+" : "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 mb-8">
      {/* 총 매입금액 */}
      <SummaryCard
        title="총 매입금액"
        value={formatKRW(totalBuyAmount)}
        sub="원금 기준"
        icon={Wallet}
        iconColor="text-blue-500"
        iconBg="bg-blue-50"
        accentColor="border-l-blue-400"
        subColor="text-gray-400"
      />

      {/* 총 평가금액 */}
      <SummaryCard
        title="총 평가금액"
        value={formatKRW(totalEvaluationAmount)}
        sub={`원금 대비 ${profitSign}${formatKRW(totalProfit)}`}
        subColor={isProfit ? "text-emerald-500" : "text-red-500"}
        icon={Landmark}
        iconColor="text-[#5b6af4]"
        iconBg="bg-[#eef0fe]"
        accentColor="border-l-[#5b6af4]"
      />

      {/* 총 평가손익 */}
      <SummaryCard
        title="총 평가손익"
        value={`${profitSign}${formatKRW(totalProfit)}`}
        valueColor={isProfit ? "text-emerald-600" : "text-red-500"}
        sub={isProfit ? "수익 실현 중" : "손실 구간"}
        subColor={isProfit ? "text-emerald-500" : "text-red-500"}
        icon={isProfit ? TrendingUp : TrendingDown}
        iconColor={isProfit ? "text-emerald-500" : "text-red-500"}
        iconBg={isProfit ? "bg-emerald-50" : "bg-red-50"}
        accentColor={isProfit ? "border-l-emerald-400" : "border-l-red-400"}
      />

      {/* 총 수익률 */}
      <SummaryCard
        title="총 수익률"
        value={`${profitSign}${totalReturnRate.toFixed(2)}%`}
        valueColor={isProfit ? "text-emerald-600" : "text-red-500"}
        sub="전체 포트폴리오"
        subColor="text-gray-400"
        icon={BarChart2}
        iconColor={isProfit ? "text-emerald-500" : "text-red-500"}
        iconBg={isProfit ? "bg-emerald-50" : "bg-red-50"}
        accentColor={isProfit ? "border-l-emerald-400" : "border-l-red-400"}
      />

      {/* 양도소득(PSY) */}
      <SummaryCard
        title="양도소득(PSY)"
        value={`${psySign}${formatKRW(psyAmount)}`}
        valueColor={isPsy ? "text-emerald-600" : "text-red-500"}
        sub="직접 입력 가능"
        subColor="text-gray-400"
        icon={isPsy ? ArrowUpRight : ArrowDownRight}
        iconColor={isPsy ? "text-emerald-500" : "text-red-500"}
        iconBg={isPsy ? "bg-emerald-50" : "bg-red-50"}
        accentColor={isPsy ? "border-l-emerald-400" : "border-l-red-400"}
        editable
        editValue={psyAmount}
        onEdit={onPsyChange}
      />

      {/* 국내수익 */}
      <SummaryCard
        title="국내수익"
        value={`${domesticSign}${formatKRW(domesticProfit)}`}
        valueColor={isDomestic ? "text-emerald-600" : "text-red-500"}
        sub="KRX 종목 기준"
        subColor="text-gray-400"
        icon={PiggyBank}
        iconColor={isDomestic ? "text-emerald-500" : "text-red-500"}
        iconBg={isDomestic ? "bg-emerald-50" : "bg-red-50"}
        accentColor={isDomestic ? "border-l-emerald-400" : "border-l-red-400"}
        editable
        editValue={domesticProfit}
        onEdit={onDomesticProfitChange}
      />
    </div>
  );
}
