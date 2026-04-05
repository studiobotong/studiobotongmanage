"use client";

import type { ElementType } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import clsx from "clsx";

interface SummaryCardProps {
  title: string;
  value: string;
  suffix?: string;
  sub?: string;
  change?: number;
  changeLabel?: string;
  icon: ElementType;
  accentColor?: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}

export default function SummaryCard({
  title,
  value,
  suffix,
  sub,
  change,
  changeLabel,
  icon: Icon,
  accentColor = "border-l-[#5b6af4]",
  iconBg = "bg-[#eef0fe]",
  iconColor = "text-[#5b6af4]",
  valueColor,
}: SummaryCardProps) {
  const hasChange = change !== undefined;
  const isPos = hasChange && change! > 0;
  const isNeg = hasChange && change! < 0;
  const isZero = hasChange && change === 0;

  const autoValueColor =
    valueColor ??
    (isPos ? "text-emerald-600" : isNeg ? "text-red-500" : "text-gray-900");

  const TrendIcon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  const trendColor = isPos
    ? "text-emerald-600 bg-emerald-50"
    : isNeg
    ? "text-red-500 bg-red-50"
    : "text-gray-400 bg-gray-50";

  return (
    <div
      className={clsx(
        "bg-white rounded-2xl border border-gray-100 border-l-4 shadow-sm p-5",
        "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
        accentColor
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
            {title}
          </p>
          <div className="flex items-baseline gap-1.5 mt-2 flex-wrap">
            <p
              className={clsx(
                "text-2xl font-bold tabular-nums leading-tight",
                autoValueColor
              )}
            >
              {value}
            </p>
            {suffix && (
              <span className="text-sm font-medium text-gray-400">{suffix}</span>
            )}
          </div>
          {sub && (
            <p className="text-xs text-gray-400 mt-1.5 font-medium">{sub}</p>
          )}
          {hasChange && (
            <div
              className={clsx(
                "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg text-xs font-semibold",
                trendColor
              )}
            >
              {!isZero && <TrendIcon className="w-3 h-3" />}
              <span>
                {isPos ? "+" : ""}
                {change!.toFixed(2)}%{changeLabel ? ` ${changeLabel}` : ""}
              </span>
            </div>
          )}
        </div>
        <div
          className={clsx(
            "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0",
            iconBg
          )}
        >
          <Icon className={clsx("w-5 h-5", iconColor)} />
        </div>
      </div>
    </div>
  );
}
