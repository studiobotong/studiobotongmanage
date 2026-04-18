"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  AlertTriangle,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import { getCashflows } from "@/lib/storage";
import type { Cashflow } from "@/types/assets";

const TYPE_META: Record<string, { label: string; cls: string }> = {
  DEPOSIT:  { label: "입금", cls: "bg-emerald-100 text-emerald-700" },
  WITHDRAW: { label: "출금", cls: "bg-amber-100  text-amber-700"   },
  DIVIDEND: { label: "배당", cls: "bg-blue-100   text-blue-700"    },
};

function TypeBadge({ type }: { type: string }) {
  const meta = TYPE_META[type] ?? { label: type, cls: "bg-gray-100 text-gray-600" };
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold",
        meta.cls
      )}
    >
      {meta.label}
    </span>
  );
}

function formatAmount(cf: Cashflow): string {
  const currency = cf.currency ?? "KRW";
  if (currency === "USD") {
    return `$${cf.amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const abs = Math.abs(cf.amount);
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.floor((abs % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (abs >= 10_000) {
    return `${Math.floor(abs / 10_000).toLocaleString()}만원`;
  }
  return `${abs.toLocaleString()}원`;
}

export default function TransactionsPage() {
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCashflows();
      const sorted = [...data].sort((a, b) =>
        (b.flow_date ?? "").localeCompare(a.flow_date ?? "")
      );
      setCashflows(sorted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = cashflows.filter((cf) => {
    const q = search.toLowerCase();
    return (
      (cf.memo ?? "").toLowerCase().includes(q) ||
      (cf.account ?? "").toLowerCase().includes(q) ||
      cf.type.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Header title="Cashflow" subtitle="현금 흐름" />
      <div className="px-6 py-8 space-y-6">
        <PageHeader
          title="현금 흐름"
          description="입금·출금·배당 내역을 확인합니다"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                새로고침
              </button>
            </div>
          }
        />

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                type="text"
                placeholder="메모 또는 계좌 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4] transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {filtered.length.toLocaleString()}건
              </span>
              <button
                onClick={load}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
                title="새로고침"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-[#5b6af4] animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-sm text-gray-600">{error}</p>
              <button
                onClick={load}
                className="text-sm text-[#5b6af4] hover:underline"
              >
                다시 시도
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <ReceiptText className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {search ? "검색 결과 없음" : "현금 흐름 내역이 없습니다"}
              </p>
              {!search && (
                <p className="text-xs text-gray-400">
                  Assets 페이지의 초기자료 탭에서 데이터를 업로드하세요
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">날짜</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">계좌</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">통화</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">금액</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">메모</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((cf) => (
                    <tr
                      key={cf.id}
                      className="hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 tabular-nums">
                        {new Date(cf.flow_date).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3.5">
                        <TypeBadge type={cf.type} />
                      </td>
                      <td className="px-4 py-3.5 text-gray-600">
                        {cf.account || "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                          {cf.currency || "KRW"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-gray-800">
                        {formatAmount(cf)}
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 text-xs max-w-[160px] truncate">
                        {cf.memo || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
