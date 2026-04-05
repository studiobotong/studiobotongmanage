"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  BarChart3,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  Landmark,
  Receipt,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import SummaryCard from "@/components/SummaryCard";
import AssetTable from "@/components/AssetTable";
import { getTransactions } from "@/lib/transactions";
import {
  aggregateTransactions,
  enrichWithPrices,
  computeHoldingsSummary,
  formatCurrency,
} from "@/lib/transactionCalculator";
import type { Holding } from "@/types/transactions";

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

export default function AssetsPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const txs = await getTransactions();
      const base = aggregateTransactions(txs);
      const enriched = await enrichWithPrices(base);
      setHoldings(enriched);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => computeHoldingsSummary(holdings), [holdings]);

  const isProfit = summary.totalProfit >= 0;
  const isLoss = summary.totalProfit < 0;

  return (
    <>
      <Header title="Assets" subtitle="자산 대시보드" />
      <div className="px-6 py-8 space-y-6">
        <PageHeader
          title="자산 대시보드"
          description="거래원장 기반 실시간 포트폴리오 현황"
          actions={
            <div className="flex items-center gap-2">
              {lastUpdated && (
                <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl">
                  <Info className="w-3 h-3" />
                  현재가: Mock 데이터
                </span>
              )}
              <button
                onClick={() => router.push("/transactions")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
              >
                <Receipt className="w-4 h-4" />
                거래원장
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-all shadow-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                새로고침
              </button>
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-[#5b6af4] animate-spin" />
              <p className="text-sm text-gray-400">자산 계산 중...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <p className="text-sm font-medium text-gray-700">{error}</p>
            <button
              onClick={load}
              className="text-sm text-[#5b6af4] hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#eef0fe] flex items-center justify-center">
              <Landmark className="w-7 h-7 text-[#5b6af4]" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-700">
                보유 자산 없음
              </p>
              <p className="text-sm text-gray-400 mt-1.5 max-w-xs">
                거래 내역을 업로드하거나 직접 입력하면 자동으로 계산됩니다
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => router.push("/transactions/upload")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] transition-all shadow-sm shadow-indigo-200"
              >
                <ArrowUpRight className="w-4 h-4" />
                엑셀 업로드
              </button>
              <button
                onClick={() => router.push("/transactions/new")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
              >
                직접 입력
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard
                title="총 매입금액"
                value={formatKRW(summary.totalBuyAmount)}
                icon={Wallet}
                accentColor="border-l-gray-300"
                iconBg="bg-gray-50"
                iconColor="text-gray-500"
                valueColor="text-gray-900"
                sub={`${holdings.length}종목`}
              />
              <SummaryCard
                title="총 평가금액"
                value={formatKRW(summary.totalEvaluationAmount)}
                icon={BarChart3}
                accentColor="border-l-[#5b6af4]"
                iconBg="bg-[#eef0fe]"
                iconColor="text-[#5b6af4]"
                valueColor="text-gray-900"
              />
              <SummaryCard
                title="총 평가손익"
                value={
                  (isProfit ? "+" : "") +
                  formatKRW(summary.totalProfit)
                }
                icon={isProfit ? TrendingUp : TrendingDown}
                accentColor={
                  isProfit
                    ? "border-l-emerald-400"
                    : isLoss
                    ? "border-l-red-400"
                    : "border-l-gray-200"
                }
                iconBg={
                  isProfit ? "bg-emerald-50" : isLoss ? "bg-red-50" : "bg-gray-50"
                }
                iconColor={
                  isProfit
                    ? "text-emerald-600"
                    : isLoss
                    ? "text-red-500"
                    : "text-gray-400"
                }
                valueColor={
                  isProfit
                    ? "text-emerald-600"
                    : isLoss
                    ? "text-red-500"
                    : "text-gray-800"
                }
              />
              <SummaryCard
                title="총 수익률"
                value={`${summary.totalReturnRate >= 0 ? "+" : ""}${summary.totalReturnRate.toFixed(2)}%`}
                icon={isProfit ? TrendingUp : TrendingDown}
                accentColor={
                  isProfit
                    ? "border-l-emerald-400"
                    : isLoss
                    ? "border-l-red-400"
                    : "border-l-gray-200"
                }
                iconBg={
                  isProfit ? "bg-emerald-50" : isLoss ? "bg-red-50" : "bg-gray-50"
                }
                iconColor={
                  isProfit
                    ? "text-emerald-600"
                    : isLoss
                    ? "text-red-500"
                    : "text-gray-400"
                }
                valueColor={
                  isProfit
                    ? "text-emerald-600"
                    : isLoss
                    ? "text-red-500"
                    : "text-gray-800"
                }
                change={summary.totalReturnRate}
              />
            </div>

            {/* Holdings table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">
                    현재 보유 종목
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    거래원장 기반 자동 계산 · 헤더 클릭으로 정렬
                  </p>
                </div>
                <span className="text-xs text-[#5b6af4] bg-[#eef0fe] font-semibold px-2.5 py-1 rounded-lg">
                  {holdings.length}종목
                </span>
              </div>
              <AssetTable holdings={holdings} />
            </div>

            {/* Chart placeholder (future Recharts) */}
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-8 text-center">
              <BarChart3 className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-400">
                그래프 영역 (Recharts 연결 예정)
              </p>
              <p className="text-xs text-gray-300 mt-1">
                일별 · 월별 · 연도별 자산 변화 차트
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
