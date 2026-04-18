"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import clsx from "clsx";
import type { AssetSnapshotHolding } from "@/types/assets";

type SortKey = keyof AssetSnapshotHolding | "weight";
type SortDir = "asc" | "desc";

interface HoldingsTableProps {
  holdings: AssetSnapshotHolding[];
  usdKrwRate?: number;
}

function toKRW(h: AssetSnapshotHolding, rate: number): number {
  return h.currency === "USD" ? h.evaluated_amount * rate : h.evaluated_amount;
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

const MARKET_COLORS: Record<string, string> = {
  KRX: "bg-blue-50 text-blue-600 border-blue-100",
  NASDAQ: "bg-emerald-50 text-emerald-600 border-emerald-100",
  NYSE: "bg-teal-50 text-teal-600 border-teal-100",
  ETC: "bg-amber-50 text-amber-600 border-amber-100",
  CASH: "bg-gray-50 text-gray-500 border-gray-100",
};

export default function HoldingsTable({
  holdings,
  usdKrwRate = 1460,
}: HoldingsTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "evaluated_amount",
    dir: "desc",
  });

  const totalKRW = holdings.reduce((s, h) => s + toKRW(h, usdKrwRate), 0);

  const withWeight = holdings.map((h) => ({
    ...h,
    weight: h.weight ?? (totalKRW > 0 ? (toKRW(h, usdKrwRate) / totalKRW) * 100 : 0),
  }));

  const sorted = [...withWeight].sort((a, b) => {
    const va =
      sort.key === "weight"
        ? a.weight
        : (a[sort.key as keyof AssetSnapshotHolding] as number | string | undefined) ?? 0;
    const vb =
      sort.key === "weight"
        ? b.weight
        : (b[sort.key as keyof AssetSnapshotHolding] as number | string | undefined) ?? 0;
    if (typeof va === "number" && typeof vb === "number") {
      return sort.dir === "asc" ? va - vb : vb - va;
    }
    return sort.dir === "asc"
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  }

  function fmtPrice(h: AssetSnapshotHolding, v: number): string {
    if (h.currency === "USD")
      return `$${v.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    return `${v.toLocaleString("ko-KR")}원`;
  }

  const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
    { key: "name", label: "종목명", align: "left" },
    { key: "symbol", label: "티커", align: "left" },
    { key: "market", label: "시장", align: "left" },
    { key: "quantity", label: "수량", align: "right" },
    { key: "avg_price", label: "평균단가", align: "right" },
    { key: "current_price", label: "현재가", align: "right" },
    { key: "evaluated_amount", label: "평가금액", align: "right" },
    { key: "weight", label: "비중", align: "right" },
  ];

  if (holdings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm font-medium text-gray-400">보유 자산 없음</p>
        <p className="text-xs text-gray-300 mt-1">
          초기자료 탭에서 보유 종목을 업로드하세요
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col.key)}
                className={clsx(
                  "px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-gray-600 transition-colors",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {col.align === "right" && <SortIcon column={col.key} sort={sort} />}
                  {col.label}
                  {col.align === "left" && <SortIcon column={col.key} sort={sort} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((h) => (
            <tr key={h.id} className="hover:bg-gray-50/60 transition-colors">
              <td className="px-4 py-3.5">
                <span className="font-semibold text-gray-800">{h.name}</span>
              </td>
              <td className="px-4 py-3.5">
                <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                  {h.symbol || "-"}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <span
                  className={clsx(
                    "text-xs font-medium px-2 py-0.5 rounded-lg border",
                    MARKET_COLORS[h.market ?? ""] ?? "bg-gray-50 text-gray-500 border-gray-100"
                  )}
                >
                  {h.market || "-"}
                </span>
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-700 font-medium">
                {h.quantity.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-500">
                {fmtPrice(h, h.avg_price)}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-800 font-semibold">
                {fmtPrice(h, h.current_price)}
              </td>
              <td className="px-4 py-3.5 text-right tabular-nums text-gray-800 font-semibold">
                {fmtPrice(h, h.evaluated_amount)}
              </td>
              <td className="px-4 py-3.5 text-right">
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-semibold text-gray-700">
                    {(h.weight ?? 0).toFixed(1)}%
                  </span>
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5b6af4] rounded-full"
                      style={{ width: `${Math.min(h.weight ?? 0, 100)}%` }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
