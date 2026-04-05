"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import clsx from "clsx";
import type { Holding } from "@/types/transactions";
import { formatNumber } from "@/lib/transactionCalculator";

type SortKey = keyof Holding;
type SortDir = "asc" | "desc";

interface AssetTableProps {
  holdings: Holding[];
}

function ProfitBadge({ value, suffix = "" }: { value: number; suffix?: string }) {
  const isPos = value > 0;
  const isNeg = value < 0;
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 font-semibold tabular-nums",
        isPos ? "text-emerald-600" : isNeg ? "text-red-500" : "text-gray-400"
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {isPos ? "+" : ""}
      {value.toFixed(suffix === "%" ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
      {suffix}
    </span>
  );
}

function SortIcon({
  column,
  sort,
}: {
  column: SortKey;
  sort: { key: SortKey; dir: SortDir } | null;
}) {
  if (!sort || sort.key !== column)
    return <ChevronsUpDown className="w-3 h-3 text-gray-300" />;
  return sort.dir === "asc" ? (
    <ChevronUp className="w-3 h-3 text-[#5b6af4]" />
  ) : (
    <ChevronDown className="w-3 h-3 text-[#5b6af4]" />
  );
}

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "종목명", align: "left" },
  { key: "symbol", label: "티커", align: "left" },
  { key: "market", label: "시장", align: "left" },
  { key: "quantity", label: "보유수량", align: "right" },
  { key: "avgPrice", label: "평균단가", align: "right" },
  { key: "currentPrice", label: "현재가", align: "right" },
  { key: "evaluationAmount", label: "평가금액", align: "right" },
  { key: "profit", label: "평가손익", align: "right" },
  { key: "returnRate", label: "수익률", align: "right" },
];

function formatValue(key: SortKey, holding: Holding): string {
  const v = holding[key] as number;
  if (key === "quantity") return formatNumber(v, 4).replace(/\.?0+$/, "");
  if (key === "returnRate") return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  if (
    ["avgPrice", "currentPrice", "evaluationAmount", "profit", "totalBuyAmount"].includes(key)
  ) {
    if (holding.currency === "USD")
      return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${v.toLocaleString("ko-KR")}원`;
  }
  return String(holding[key]);
}

export default function AssetTable({ holdings }: AssetTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({
    key: "evaluationAmount",
    dir: "desc",
  });

  const sorted = [...holdings].sort((a, b) => {
    if (!sort) return 0;
    const va = a[sort.key] as string | number;
    const vb = b[sort.key] as string | number;
    if (typeof va === "number" && typeof vb === "number") {
      return sort.dir === "asc" ? va - vb : vb - va;
    }
    return sort.dir === "asc"
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-medium text-gray-400">보유 자산 없음</p>
        <p className="text-xs text-gray-300 mt-1">거래 내역을 업로드하거나 직접 입력하세요</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={clsx(
                  "px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap",
                  "hover:text-gray-700 transition-colors",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.align === "right" && (
                    <SortIcon column={col.key} sort={sort} />
                  )}
                  {col.label}
                  {col.align === "left" && (
                    <SortIcon column={col.key} sort={sort} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((h) => (
            <tr
              key={h.symbol}
              className="hover:bg-gray-50/60 transition-colors group"
            >
              <td className="px-4 py-3.5">
                <span className="font-semibold text-gray-800">{h.name}</span>
              </td>
              <td className="px-4 py-3.5">
                <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {h.symbol}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <span className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                  {h.market}
                </span>
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-700 font-medium">
                {formatValue("quantity", h)}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-600">
                {formatValue("avgPrice", h)}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-800 font-semibold">
                {formatValue("currentPrice", h)}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-800 font-semibold">
                {formatValue("evaluationAmount", h)}
              </td>
              <td className="px-4 py-3.5 text-right">
                <ProfitBadge
                  value={h.profit}
                  suffix={h.currency === "USD" ? "" : ""}
                />
              </td>
              <td className="px-4 py-3.5 text-right">
                <ProfitBadge value={h.returnRate} suffix="%" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
