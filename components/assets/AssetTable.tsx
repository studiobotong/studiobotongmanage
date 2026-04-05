"use client";

import { useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { Asset, AssetAction, AssetMarket } from "@/types/assets";
import { formatPrice, formatKRWCompact } from "@/lib/assets";

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function ActionBadge({ action }: { action: AssetAction }) {
  const styles: Record<AssetAction, string> = {
    BUY: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    SELL: "bg-red-50 text-red-600 border border-red-100",
    HOLD: "bg-blue-50 text-blue-600 border border-blue-100",
  };
  const labels: Record<AssetAction, string> = {
    BUY: "매수",
    SELL: "매도",
    HOLD: "보유",
  };
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md leading-tight tracking-wider ${styles[action]}`}
    >
      {labels[action]}
    </span>
  );
}

function MarketBadge({ market }: { market: AssetMarket }) {
  const styles: Record<AssetMarket, string> = {
    KRX: "bg-blue-50 text-blue-600",
    NASDAQ: "bg-purple-50 text-purple-600",
    NYSE: "bg-indigo-50 text-indigo-600",
    ETC: "bg-gray-100 text-gray-500",
    CASH: "bg-amber-50 text-amber-600",
  };
  return (
    <span
      className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md leading-tight ${styles[market]}`}
    >
      {market}
    </span>
  );
}

function WeightBar({
  current,
  min,
  max,
}: {
  current: number;
  min: number;
  max: number;
}) {
  if (max <= 0) return <span className="text-xs text-gray-300">—</span>;
  const pct = Math.min((current / max) * 100, 100);
  const isUnder = current < min;
  const isOver = current > max;
  const barColor = isOver
    ? "bg-red-400"
    : isUnder
    ? "bg-amber-400"
    : "bg-emerald-400";

  return (
    <div className="flex flex-col gap-1 min-w-[56px]">
      <div className="flex items-center justify-between gap-1">
        <span
          className={`text-[10px] font-semibold tabular-nums ${
            isOver ? "text-red-500" : isUnder ? "text-amber-500" : "text-emerald-600"
          }`}
        >
          {current.toFixed(1)}%
        </span>
      </div>
      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type SortKey =
  | "name"
  | "market"
  | "symbol"
  | "currentPrice"
  | "quantity"
  | "buyAmount"
  | "evaluationAmount"
  | "profit"
  | "returnRate"
  | "currentWeight";

type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronDown className="w-3 h-3 opacity-20 flex-shrink-0" />;
  return dir === "asc" ? (
    <ChevronUp className="w-3 h-3 text-[#5b6af4] flex-shrink-0" />
  ) : (
    <ChevronDown className="w-3 h-3 text-[#5b6af4] flex-shrink-0" />
  );
}

// ---------------------------------------------------------------------------
// Asset row
// ---------------------------------------------------------------------------

interface AssetRowProps {
  asset: Asset;
  idx: number;
  onDelete: (id: string) => void;
  onEdit: (asset: Asset) => void;
}

function AssetRow({ asset, idx, onDelete, onEdit }: AssetRowProps) {
  const isProfit = asset.profit >= 0;
  const profitColor = isProfit ? "text-emerald-600" : "text-red-500";
  const isNeutral = asset.profit === 0;

  return (
    <tr
      className={`border-b border-gray-50 last:border-0 hover:bg-[#f8f9ff] group transition-colors ${
        idx % 2 === 0 ? "" : "bg-gray-50/30"
      }`}
    >
      {/* 종목명 */}
      <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
        <div>
          <p className="text-sm font-semibold text-gray-800 leading-tight whitespace-nowrap">
            {asset.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-gray-400 uppercase">
              {asset.symbol}
            </span>
          </div>
        </div>
      </td>

      {/* 리밸런싱 액션 */}
      <td className="px-3 py-3 text-center">
        <ActionBadge action={asset.action} />
      </td>

      {/* 국가 */}
      <td className="px-3 py-3 text-center">
        <MarketBadge market={asset.market} />
      </td>

      {/* 통화 */}
      <td className="px-3 py-3 text-center">
        <span className="text-[10px] font-mono font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
          {asset.currency}
        </span>
      </td>

      {/* 현재가 */}
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="text-sm text-gray-700">
          {formatPrice(asset.currentPrice, asset.currency)}
        </span>
      </td>

      {/* 수량 */}
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="text-sm text-gray-600">
          {asset.quantity.toLocaleString()}
        </span>
      </td>

      {/* 매입금액 */}
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="text-sm text-gray-600">
          {formatKRWCompact(asset.buyAmount)}
        </span>
      </td>

      {/* 평가금액 */}
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="text-sm font-semibold text-gray-800">
          {formatKRWCompact(asset.evaluationAmount)}
        </span>
      </td>

      {/* 평가손익 */}
      <td className="px-4 py-3 text-right tabular-nums">
        <span
          className={`inline-flex items-center justify-end gap-0.5 text-sm font-semibold ${
            isNeutral ? "text-gray-400" : profitColor
          }`}
        >
          {!isNeutral &&
            (isProfit ? (
              <TrendingUp className="w-3 h-3 flex-shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 flex-shrink-0" />
            ))}
          {isProfit && !isNeutral ? "+" : ""}
          {formatKRWCompact(asset.profit)}
        </span>
      </td>

      {/* 수익률 */}
      <td className="px-4 py-3 text-right tabular-nums">
        <span
          className={`text-sm font-semibold ${
            isNeutral ? "text-gray-400" : profitColor
          }`}
        >
          {isProfit && !isNeutral ? "+" : ""}
          {asset.returnRate.toFixed(1)}%
        </span>
      </td>

      {/* 현재비중 */}
      <td className="px-4 py-3">
        <WeightBar
          current={asset.currentWeight}
          min={asset.minWeight}
          max={asset.maxWeight}
        />
      </td>

      {/* 최소 */}
      <td className="px-3 py-3 text-right tabular-nums">
        <span className="text-xs text-gray-400">
          {asset.minWeight > 0 ? `${asset.minWeight}%` : "—"}
        </span>
      </td>

      {/* 최대 */}
      <td className="px-3 py-3 text-right tabular-nums">
        <span className="text-xs text-gray-400">
          {asset.maxWeight > 0 ? `${asset.maxWeight}%` : "—"}
        </span>
      </td>

      {/* 액션 버튼 */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(asset)}
            className="w-7 h-7 rounded-lg bg-[#eef0fe] flex items-center justify-center hover:bg-[#dde0fe] transition-colors"
            title="수정"
          >
            <Pencil className="w-3 h-3 text-[#5b6af4]" />
          </button>
          <button
            onClick={() => onDelete(asset.id)}
            className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
            title="삭제"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

const COLS: { key: SortKey | null; label: string; align: "left" | "right" | "center" }[] = [
  { key: "name", label: "종목명", align: "left" },
  { key: null, label: "액션", align: "center" },
  { key: "market", label: "국가", align: "center" },
  { key: null, label: "통화", align: "center" },
  { key: "currentPrice", label: "현재가", align: "right" },
  { key: "quantity", label: "수량", align: "right" },
  { key: "buyAmount", label: "매입금액", align: "right" },
  { key: "evaluationAmount", label: "평가금액", align: "right" },
  { key: "profit", label: "평가손익", align: "right" },
  { key: "returnRate", label: "수익률", align: "right" },
  { key: "currentWeight", label: "현재비중", align: "left" },
  { key: null, label: "최소", align: "right" },
  { key: null, label: "최대", align: "right" },
];

// ---------------------------------------------------------------------------
// AssetTable
// ---------------------------------------------------------------------------

interface AssetTableProps {
  assets: Asset[];
  onDelete: (id: string) => void;
  onEdit: (asset: Asset) => void;
}

export default function AssetTable({ assets, onDelete, onEdit }: AssetTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("evaluationAmount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...assets].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv), "ko")
      : String(bv).localeCompare(String(av), "ko");
  });

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Minus className="w-6 h-6 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500">자산이 없습니다</p>
        <p className="text-xs text-gray-400 mt-1.5">
          상단의 &ldquo;자산 추가&rdquo; 버튼으로 첫 자산을 등록하세요
        </p>
      </div>
    );
  }

  const totalBuy = sorted.reduce((s, a) => s + a.buyAmount, 0);
  const totalEval = sorted.reduce((s, a) => s + a.evaluationAmount, 0);
  const totalProfit = sorted.reduce((s, a) => s + a.profit, 0);
  const totalRate = totalBuy > 0 ? (totalProfit / totalBuy) * 100 : 0;
  const totalIsProfit = totalProfit >= 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1280px]">
        <thead>
          <tr className="border-b border-gray-100">
            {COLS.map((col, i) => (
              <th
                key={i}
                onClick={() => handleSort(col.key)}
                className={`px-3 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap select-none transition-colors ${
                  col.key ? "cursor-pointer hover:text-gray-600" : ""
                } ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                } ${i === 0 ? "sticky left-0 bg-white z-10 pl-4" : ""}`}
              >
                <span
                  className={`inline-flex items-center gap-1 ${
                    col.align === "right" ? "flex-row-reverse" : ""
                  }`}
                >
                  {col.label}
                  {col.key && (
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  )}
                </span>
              </th>
            ))}
            <th className="px-3 py-3 w-20" />
          </tr>
        </thead>

        <tbody>
          {sorted.map((asset, idx) => (
            <AssetRow
              key={asset.id}
              asset={asset}
              idx={idx}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </tbody>

        {/* Footer totals */}
        <tfoot>
          <tr className="border-t-2 border-gray-100 bg-gray-50/60">
            <td className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50/60">
              합계
            </td>
            <td colSpan={5} />
            <td className="px-4 py-3 text-right">
              <span className="text-xs font-bold text-gray-600 tabular-nums">
                {formatKRWCompact(totalBuy)}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <span className="text-sm font-bold text-gray-800 tabular-nums">
                {formatKRWCompact(totalEval)}
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              <span
                className={`text-sm font-bold ${
                  totalIsProfit ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {totalIsProfit ? "+" : ""}
                {formatKRWCompact(totalProfit)}
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              <span
                className={`text-sm font-bold ${
                  totalIsProfit ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {totalIsProfit ? "+" : ""}
                {totalRate.toFixed(2)}%
              </span>
            </td>
            <td colSpan={4} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
