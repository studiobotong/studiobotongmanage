"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Loader2,
  AlertTriangle,
  PencilLine,
  Gauge,
  Camera,
} from "lucide-react";
import AssetTrendChart from "@/components/AssetTrendChart";
import DashboardAllocationChart from "@/components/DashboardAllocationChart";
import { groupRegularHoldings, type GroupedHolding } from "@/lib/holdingsGroup";
import {
  computeAllocationSignal,
  formatDiffLabel,
  formatTargetRange,
  hasValidTargetBand,
} from "@/lib/targetWeightBand";
import { fetchAssetSnapshots } from "@/lib/assetSnapshots";
import {
  getLatestAssetSnapshot,
  getLatestSnapshotHoldings,
  getCashflows,
} from "@/lib/storage";
import {
  netInvestmentKrwFromCashflowsUpTo,
  profitAndReturnRateFromTotalAndNet,
  todayDateStringKst,
} from "@/lib/netInvestment";
import {
  readStoredUsdKrwRate,
  refreshUsdKrwRateFromApi,
  saveManualUsdKrwRate,
  FX_REFRESH_FAILED_USER_MESSAGE,
  labelForFxRefreshFailure,
  type UsdKrwRateState,
} from "@/lib/priceService";
import {
  readStoredFearGreed,
  refreshFearGreedFromApi,
  FNG_REFRESH_FAILED_CACHED_MESSAGE,
  FNG_REFRESH_FAILED_FALLBACK_MESSAGE,
  type FearGreedState,
} from "@/lib/fearGreedStorage";
import type { AssetSnapshot, AssetSnapshotHolding, Cashflow } from "@/types/assets";
import {
  bandFromIndex,
  suggestDefensiveAssetStrategy,
} from "@/lib/fearGreedStrategy";

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

/** 리밸런싱 BUY/SELL 제안 문구용: 원화 금액 → 만원 정수 (표시만, 계산은 amountKrw 그대로) */
function formatRebalanceProposalManwon(amountKrw: number): string {
  return `${Math.round(amountKrw / 10_000)}만원`;
}

interface SummaryCardProps {
  title: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badge?: { label: string; positive: boolean };
  valueColor?: string;
}

interface RebalanceSellRow {
  key: string;
  name: string;
  currentPct: number;
  targetMax: number;
  excessPct: number;
  amountKrw: number;
}

interface RebalanceBuyRow {
  key: string;
  name: string;
  currentPct: number;
  targetMin: number;
  shortagePct: number;
  amountKrw: number;
}

function rateSourceLabel(status: UsdKrwRateState["status"]): string {
  switch (status) {
    case "live":
      return "실시간 환율 사용";
    case "manual":
      return "수동 저장값 사용";
    case "cached":
      return "마지막 저장값 사용";
    default:
      return "저장된 환율 없음 · 기본값 사용";
  }
}

/** 헤더 뱃지용 짧은 라벨 */
function fxStatusBadgeLabel(status: UsdKrwRateState["status"]): string {
  switch (status) {
    case "live":
      return "실시간";
    case "manual":
      return "수동 저장값";
    case "cached":
      return "마지막값";
    default:
      return "기본값";
  }
}

function fxStatusBadgeClass(status: UsdKrwRateState["status"]): string {
  switch (status) {
    case "live":
      return "bg-emerald-50 text-emerald-700 border-emerald-200/80";
    case "manual":
      return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
    case "cached":
      return "bg-amber-50 text-amber-800 border-amber-200/80";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200/80";
  }
}

function SummaryCard({
  title,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  badge,
  valueColor = "text-gray-900",
}: SummaryCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {title}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBg}`}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>
          {value}
        </p>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
      {badge && (
        <div
          className={`self-start flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg ${
            badge.positive
              ? "bg-emerald-50 text-emerald-600"
              : "bg-rose-50 text-rose-500"
          }`}
        >
          {badge.positive ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          {badge.label}
        </div>
      )}
    </div>
  );
}

export default function AssetPortfolioDashboard() {
  const [holdings, setHoldings] = useState<AssetSnapshotHolding[]>([]);
  const [snapshots, setSnapshots] = useState<AssetSnapshot[]>([]);
  /** 차트용 목록과 별도로, DB `asset_snapshots` 최신 1행(목업 없음) */
  const [latestSnapshotRow, setLatestSnapshotRow] =
    useState<AssetSnapshot | null>(null);
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [usdKrw, setUsdKrw] = useState<UsdKrwRateState>(() =>
    readStoredUsdKrwRate()
  );
  const [fxRefreshing, setFxRefreshing] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxModalOpen, setFxModalOpen] = useState(false);
  const [fxManualInput, setFxManualInput] = useState("");
  const [fxManualSaving, setFxManualSaving] = useState(false);
  const [fxManualError, setFxManualError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [fng, setFng] = useState<FearGreedState>(() => readStoredFearGreed());
  const [fngRefreshing, setFngRefreshing] = useState(false);
  const [fngRefreshError, setFngRefreshError] = useState<string | null>(null);

  const applyStoredRate = useCallback(() => {
    setUsdKrw(readStoredUsdKrwRate());
  }, []);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
      setFxError(null);
      setFngRefreshError(null);
    }
    applyStoredRate();
    setFng(readStoredFearGreed());
    try {
      const [snaps, latestHoldings, flows, latestSnap] = await Promise.all([
        fetchAssetSnapshots(),
        getLatestSnapshotHoldings(),
        getCashflows(),
        getLatestAssetSnapshot(),
      ]);
      setSnapshots(snaps);
      setLatestSnapshotRow(latestSnap);
      setHoldings(latestHoldings);
      setCashflows(flows);
      setLastUpdated(new Date());
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "데이터 로딩 실패");
      } else {
        throw e;
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [applyStoredRate]);

  const [snapshotRefreshLoading, setSnapshotRefreshLoading] = useState(false);
  const [snapshotRefreshBanner, setSnapshotRefreshBanner] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const handleSnapshotRefresh = useCallback(async () => {
    setSnapshotRefreshBanner(null);
    setSnapshotRefreshLoading(true);
    try {
      const res = await fetch("/api/snapshot?repair=1&recalc_summary=1");
      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const ok = res.ok && data.success === true;
      if (!ok) {
        const errMsg =
          typeof data.error === "string" && data.error
            ? data.error
            : typeof data.reason === "string" && data.reason
              ? data.reason
              : `요청 실패 (${res.status})`;
        setSnapshotRefreshBanner({ kind: "error", message: errMsg });
        return;
      }
      try {
        await load({ silent: true });
      } catch {
        setSnapshotRefreshBanner({
          kind: "error",
          message:
            "스냅샷은 반영되었을 수 있으나 화면 데이터를 다시 불러오지 못했습니다.",
        });
        return;
      }
      const dateStr =
        typeof data.snapshot_date === "string" ? data.snapshot_date : "";
      setSnapshotRefreshBanner({
        kind: "success",
        message: dateStr
          ? `${dateStr} 기준 스냅샷을 다시 맞췄습니다.`
          : "스냅샷을 다시 맞췄습니다.",
      });
    } catch (e) {
      setSnapshotRefreshBanner({
        kind: "error",
        message: e instanceof Error ? e.message : "네트워크 오류",
      });
    } finally {
      setSnapshotRefreshLoading(false);
    }
  }, [load]);

  const openFxModal = useCallback(() => {
    setFxManualError(null);
    setFxManualInput(String(usdKrw.rate));
    setFxModalOpen(true);
  }, [usdKrw.rate]);

  const closeFxModal = useCallback(() => {
    setFxModalOpen(false);
    setFxManualError(null);
    setFxManualSaving(false);
  }, []);

  const handleManualFxSave = useCallback(() => {
    setFxManualError(null);
    setFxManualSaving(true);
    try {
      const res = saveManualUsdKrwRate(fxManualInput.trim());
      if (res.ok) {
        setUsdKrw({
          rate: res.rate,
          lastUpdatedAt: res.lastUpdatedAt,
          status: "manual",
        });
        setFxError(null);
        closeFxModal();
      } else {
        setFxManualError(res.error);
      }
    } finally {
      setFxManualSaving(false);
    }
  }, [fxManualInput, closeFxModal]);

  useEffect(() => {
    if (!fxModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFxModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fxModalOpen, closeFxModal]);

  const handleUsdRefresh = useCallback(async () => {
    console.log("[FX_TRACE][1] 달러 새로고침 버튼 클릭됨");
    setFxError(null);
    setFxRefreshing(true);
    try {
      const res = await refreshUsdKrwRateFromApi();
      if (res.ok) {
        setUsdKrw({
          rate: res.rate,
          lastUpdatedAt: res.lastUpdatedAt,
          status: "live",
        });
      } else {
        // 실시간 조회 실패: localStorage 마지막 성공값·상태로 되돌림 (환율 숫자는 유지)
        applyStoredRate();
        setFxError(
          res.error ??
            (res.reason
              ? labelForFxRefreshFailure(res.reason)
              : FX_REFRESH_FAILED_USER_MESSAGE)
        );
      }
    } finally {
      setFxRefreshing(false);
    }
  }, [applyStoredRate]);

  const handleFearGreedRefresh = useCallback(async () => {
    const previousScreenValue = fng.value;
    setFngRefreshError(null);
    setFngRefreshing(true);
    try {
      const res = await refreshFearGreedFromApi(previousScreenValue);
      if (res.ok) {
        console.log("[FNG_REFRESH]", {
          clientRequestUrl: "/api/fear-greed",
          upstreamRequestUrl: res.requestUrl,
          source: res.sourceName,
          rawPayload: res.rawPayload,
          parsedLatestValue: res.parsedLatestValue,
          latestIndexDateIso: res.indexDateIso,
          previousScreenValue: res.previousDisplayedValue,
          appliedScreenValue: res.value,
        });
        setFng({
          value: res.value,
          lastUpdatedAt: res.lastUpdatedAt,
          indexAsOf: res.indexAsOf,
          status: "live",
        });
      } else {
        console.log("[FNG_REFRESH_FAILED]", {
          clientRequestUrl: "/api/fear-greed",
          upstreamRequestUrl: res.requestUrl,
          error: res.error,
          rawPayload: res.rawPayload,
          previousScreenValue: res.previousDisplayedValue,
        });
        const next = readStoredFearGreed();
        setFng(next);
        setFngRefreshError(
          next.status === "fallback"
            ? FNG_REFRESH_FAILED_FALLBACK_MESSAGE
            : FNG_REFRESH_FAILED_CACHED_MESSAGE
        );
      }
    } finally {
      setFngRefreshing(false);
    }
  }, [fng.value]);

  useEffect(() => {
    applyStoredRate();
  }, [applyStoredRate]);

  useEffect(() => {
    load();
  }, [load]);

  const { krwAsset, usdAsset, totalAssetKRW } = useMemo(() => {
    const krw = holdings
      .filter((h) => h.currency === "KRW")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usd = holdings
      .filter((h) => h.currency === "USD")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    return {
      krwAsset: krw,
      usdAsset: usd,
      totalAssetKRW: krw + usd * usdKrw.rate,
    };
  }, [holdings, usdKrw.rate]);

  /** 원화예수금 + (달러예수금×환율) */
  const { totalCashKrw } = useMemo(() => {
    const krwCash = holdings
      .filter((h) => h.asset_type === "KRW_CASH")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usdCashUsd = holdings
      .filter((h) => h.asset_type === "USD_CASH")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usdInKrw = usdCashUsd * usdKrw.rate;
    return {
      totalCashKrw: krwCash + usdInKrw,
    };
  }, [holdings, usdKrw.rate]);

  /** 원화채권 + (달러채권×환율) */
  const { totalBondKrw } = useMemo(() => {
    const krwBond = holdings
      .filter((h) => h.asset_type === "BOND" && h.currency === "KRW")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usdBondUsd = holdings
      .filter((h) => h.asset_type === "BOND" && h.currency === "USD")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usdInKrw = usdBondUsd * usdKrw.rate;
    return {
      totalBondKrw: krwBond + usdInKrw,
    };
  }, [holdings, usdKrw.rate]);

  /** 방어자산 = 예수금 + 채권 (원화 + 달러 환산) */
  const { totalDefensiveKrw, currentDefensiveWeightPct } = useMemo(() => {
    const total = totalCashKrw + totalBondKrw;
    const pct =
      totalAssetKRW > 0 ? (total / totalAssetKRW) * 100 : 0;
    return { totalDefensiveKrw: total, currentDefensiveWeightPct: pct };
  }, [totalCashKrw, totalBondKrw, totalAssetKRW]);

  const fngBand = useMemo(() => bandFromIndex(fng.value), [fng.value]);

  const defensiveStrategy = useMemo(() => {
    if (totalAssetKRW <= 0) return null;
    return suggestDefensiveAssetStrategy(
      currentDefensiveWeightPct,
      fngBand.recommendedCashMidPct
    );
  }, [fngBand, currentDefensiveWeightPct, totalAssetKRW]);

  /** 차이(권장−현재) 표시용: gapPct·totalAssetKRW만 사용, 자산 집계 로직은 변경하지 않음 */
  const defensiveGapDiffDisplay = useMemo(() => {
    if (totalAssetKRW <= 0 || !defensiveStrategy) return null;
    const gapPct = defensiveStrategy.gapPct;
    const gapAmountKrw = Math.round((gapPct / 100) * totalAssetKRW);
    const manwon = Math.round(Math.abs(gapAmountKrw) / 10000);
    const absPctStr = Math.abs(gapPct).toFixed(1);
    if (gapPct > 0) {
      return {
        label: `${absPctStr}% 부족 (약 ${manwon.toLocaleString()}만원)`,
        textColor: "text-red-600" as const,
      };
    }
    if (gapPct < 0) {
      return {
        label: `${absPctStr}% 과다 (약 ${manwon.toLocaleString()}만원)`,
        textColor: "text-blue-600" as const,
      };
    }
    return {
      label: "적정 비중 유지 중",
      textColor: "text-green-600" as const,
    };
  }, [totalAssetKRW, defensiveStrategy]);

  /**
   * 상단 요약 카드(총자산·순투자금·수익·수익률): DB에 `asset_snapshots` 행이 있으면 그 값 우선,
   * 없을 때만 보유+환율·cashflow로 계산. DIVIDEND는 순투자금에 포함하지 않음(netInvestment 모듈과 동일).
   */
  const summaryMetrics = useMemo(() => {
    const snap = latestSnapshotRow;

    if (!snap) {
      const net = netInvestmentKrwFromCashflowsUpTo(
        cashflows,
        todayDateStringKst()
      );
      const { profit, return_rate } = profitAndReturnRateFromTotalAndNet(
        totalAssetKRW,
        net
      );
      return {
        totalAsset: totalAssetKRW,
        netInvestment: net,
        profit,
        returnRate: return_rate,
      };
    }

    const netFallback = netInvestmentKrwFromCashflowsUpTo(
      cashflows,
      snap.snapshot_date
    );
    const totalAsset =
      snap.total_asset != null ? snap.total_asset : totalAssetKRW;
    const netInvestment =
      snap.net_investment != null ? snap.net_investment : netFallback;
    const { profit: profitComputed, return_rate: rateComputed } =
      profitAndReturnRateFromTotalAndNet(totalAsset, netInvestment);
    const profit =
      snap.profit != null ? snap.profit : profitComputed;
    const returnRate =
      snap.return_rate != null ? snap.return_rate : rateComputed;

    return {
      totalAsset,
      netInvestment,
      profit,
      returnRate,
    };
  }, [latestSnapshotRow, totalAssetKRW, cashflows]);

  /** 통합 총자산(KRW 환산) 대비 주식 비중으로 목표·BUY/HOLD/SELL 계산 (Holdings 구간 비중과 별개) */
  const dashboardStockTableRows = useMemo(() => {
    const CASH_TYPES = new Set(["KRW_CASH", "USD_CASH"]);
    const regular = holdings.filter(
      (h) => !CASH_TYPES.has(h.asset_type ?? "") && h.asset_type !== "BOND"
    );
    const grouped = groupRegularHoldings(regular);
    const rows: {
      g: GroupedHolding;
      sectionLabel: string;
      evalKrw: number;
      weight: number;
      bandOk: boolean;
      tMin: number | undefined | null;
      tMax: number | undefined | null;
      signal: ReturnType<typeof computeAllocationSignal> | null;
    }[] = [];

    for (const sec of [
      { currency: "KRW" as const, label: "원화" },
      { currency: "USD" as const, label: "달러" },
    ]) {
      const sectionGroups = grouped.filter((x) => x.currency === sec.currency);
      for (const g of sectionGroups) {
        if (g.asset_type !== "STOCK") continue;
        const evalKrw =
          g.currency === "USD"
            ? g.evaluatedAmount * usdKrw.rate
            : g.evaluatedAmount;
        const weight =
          totalAssetKRW > 0 ? (evalKrw / totalAssetKRW) * 100 : 0;
        const tMin = g.rows[0]?.target_min_weight;
        const tMax = g.rows[0]?.target_max_weight;
        const bandOk = hasValidTargetBand(tMin, tMax);
        const signal =
          bandOk && tMin != null && tMax != null
            ? computeAllocationSignal(weight, tMin, tMax)
            : null;
        rows.push({
          g,
          sectionLabel: sec.label,
          evalKrw,
          weight,
          bandOk,
          tMin,
          tMax,
          signal,
        });
      }
    }
    return rows;
  }, [holdings, totalAssetKRW, usdKrw.rate]);

  /** 권장 대비 부족한 방어자산 금액(원화) — gap이 양수일 때만 */
  const defensiveNeededKrw = useMemo(() => {
    if (totalAssetKRW <= 0 || !defensiveStrategy || defensiveStrategy.gapPct <= 1) {
      return 0;
    }
    return Math.round((defensiveStrategy.gapPct / 100) * totalAssetKRW);
  }, [totalAssetKRW, defensiveStrategy]);

  /** 통합 총자산(KRW) 기준 목표 밴드 대비 매도·매수 상위 제안 (초과/부족 비중 큰 순, 각 최대 5개) */
  const rebalanceSellBuyTop = useMemo(() => {
    if (totalAssetKRW <= 0) {
      return { sell: [] as RebalanceSellRow[], buy: [] as RebalanceBuyRow[] };
    }
    const sell: RebalanceSellRow[] = [];
    const buy: RebalanceBuyRow[] = [];
    for (const row of dashboardStockTableRows) {
      if (!row.signal || !row.bandOk || row.tMin == null || row.tMax == null) {
        continue;
      }
      if (row.signal.status === "SELL") {
        const excessPct = row.weight - row.tMax;
        sell.push({
          key: `${row.g.groupKey}-sell`,
          name: row.g.name,
          currentPct: row.weight,
          targetMax: row.tMax,
          excessPct,
          amountKrw: Math.round(totalAssetKRW * (excessPct / 100)),
        });
      } else if (row.signal.status === "BUY") {
        const shortagePct = row.tMin - row.weight;
        buy.push({
          key: `${row.g.groupKey}-buy`,
          name: row.g.name,
          currentPct: row.weight,
          targetMin: row.tMin,
          shortagePct,
          amountKrw: Math.round(totalAssetKRW * (shortagePct / 100)),
        });
      }
    }
    sell.sort((a, b) => b.excessPct - a.excessPct);
    buy.sort((a, b) => b.shortagePct - a.shortagePct);
    const TOP_N = 5;
    return { sell: sell.slice(0, TOP_N), buy: buy.slice(0, TOP_N) };
  }, [dashboardStockTableRows, totalAssetKRW]);

  useEffect(() => {
    if (loading) return;
    console.log("[AssetPortfolioDashboard] 자산 계산:", {
      krwAsset,
      usdAsset,
      exchangeRate: usdKrw.rate,
      rateStatus: usdKrw.status,
      lastUpdatedAt: usdKrw.lastUpdatedAt?.toISOString(),
      totalAssetKRW,
      summaryMetrics,
      latestSnapshotDate: latestSnapshotRow?.snapshot_date ?? null,
    });
  }, [
    krwAsset,
    usdAsset,
    usdKrw.rate,
    usdKrw.status,
    usdKrw.lastUpdatedAt,
    totalAssetKRW,
    summaryMetrics,
    latestSnapshotRow?.snapshot_date,
    loading,
  ]);

  const fxTimeStr = usdKrw.lastUpdatedAt
    ? usdKrw.lastUpdatedAt.toLocaleTimeString("ko-KR", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="min-w-0 shrink-0">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              자산 관리 대시보드
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              현재 보유 자산 및 자산 변화 추이
              {lastUpdated && (
                <>
                  {" "}
                  · 자산 데이터{" "}
                  {lastUpdated.toLocaleTimeString("ko-KR", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}{" "}
                  기준
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4 min-w-0 flex-1 xl:flex-initial xl:justify-end">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm min-w-0">
              <span className="text-gray-700 whitespace-nowrap">
                적용 환율{" "}
                <span className="font-semibold tabular-nums text-gray-900">
                  {usdKrw.rate.toLocaleString()}
                </span>
                원/USD
              </span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                마지막 갱신 {fxTimeStr ?? "—"}
              </span>
              <span
                className={clsx(
                  "inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0",
                  fxStatusBadgeClass(usdKrw.status)
                )}
                title={rateSourceLabel(usdKrw.status)}
              >
                {fxStatusBadgeLabel(usdKrw.status)}
              </span>

              <span className="hidden sm:inline text-gray-200 select-none" aria-hidden>
                |
              </span>

              <span className="text-gray-700 whitespace-nowrap">
                Fear &amp; Greed{" "}
                <span className="font-semibold tabular-nums text-gray-900">
                  {fng.value}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleUsdRefresh}
                disabled={fxRefreshing || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 disabled:opacity-50 transition-all shadow-sm"
              >
                {fxRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DollarSign className="w-4 h-4" />
                )}
                달러 새로고침
              </button>
              <button
                type="button"
                onClick={handleFearGreedRefresh}
                disabled={fngRefreshing || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-violet-700 bg-white border border-violet-200 hover:bg-violet-50 disabled:opacity-50 transition-all shadow-sm"
              >
                {fngRefreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gauge className="w-4 h-4" />
                )}
                피어앤그리드 새로고침
              </button>
              <button
                type="button"
                onClick={openFxModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
              >
                <PencilLine className="w-4 h-4" />
                환율 직접 입력
              </button>
              <button
                type="button"
                onClick={handleSnapshotRefresh}
                disabled={snapshotRefreshLoading || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-sky-700 bg-white border border-sky-200 hover:bg-sky-50 disabled:opacity-50 transition-all shadow-sm"
              >
                {snapshotRefreshLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                스냅샷 새로고침
              </button>
              <button
                type="button"
                onClick={() => {
                  void load();
                }}
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
          </div>
        </div>

        {fxError && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 max-w-3xl flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {fxError}
          </p>
        )}
        {fngRefreshError && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 max-w-3xl flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {fngRefreshError}
          </p>
        )}
        {snapshotRefreshBanner && (
          <p
            className={clsx(
              "text-xs rounded-lg px-3 py-2 max-w-3xl flex items-start gap-2 border",
              snapshotRefreshBanner.kind === "success"
                ? "text-emerald-900 bg-emerald-50 border-emerald-100"
                : "text-amber-800 bg-amber-50 border-amber-100"
            )}
          >
            {snapshotRefreshBanner.kind === "success" ? (
              <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            {snapshotRefreshBanner.message}
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-40">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#5b6af4] animate-spin" />
            <p className="text-sm text-gray-400">자산 데이터 로딩 중...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
          <p className="text-sm font-medium text-gray-700">{error}</p>
          <button
            onClick={() => {
              void load();
            }}
            className="text-sm text-[#5b6af4] hover:underline"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="총 자산"
              value={
                summaryMetrics.totalAsset > 0
                  ? formatKRW(summaryMetrics.totalAsset)
                  : "-"
              }
              sub={
                latestSnapshotRow
                  ? `${latestSnapshotRow.snapshot_date} 스냅샷 기준 · 원화+미국자산 환산과 다를 수 있음`
                  : "원화 자산 + 미국 자산 환산 합계"
              }
              icon={Wallet}
              iconBg="bg-[#eef0fe]"
              iconColor="text-[#5b6af4]"
              badge={
                summaryMetrics.returnRate !== null
                  ? {
                      label: `${summaryMetrics.returnRate >= 0 ? "+" : ""}${summaryMetrics.returnRate.toFixed(2)}%`,
                      positive: summaryMetrics.returnRate >= 0,
                    }
                  : undefined
              }
            />

            <SummaryCard
              title="순투자금"
              value={
                summaryMetrics.netInvestment !== null &&
                summaryMetrics.netInvestment > 0
                  ? formatKRW(summaryMetrics.netInvestment)
                  : "-"
              }
              sub="누적 입금 − 누적 출금 (배당 제외)"
              icon={TrendingUp}
              iconBg="bg-violet-50"
              iconColor="text-violet-500"
              badge={
                summaryMetrics.profit !== null
                  ? {
                      label: `${summaryMetrics.profit >= 0 ? "+" : ""}${formatKRW(summaryMetrics.profit)}`,
                      positive: summaryMetrics.profit >= 0,
                    }
                  : undefined
              }
            />

            <SummaryCard
              title="원화 자산"
              value={krwAsset > 0 ? formatKRW(krwAsset) : "-"}
              sub="국내주식 + 원화예수금 + 원화채권"
              icon={TrendingUp}
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
            />

            <SummaryCard
              title="미국 자산"
              value={usdAsset > 0 ? formatKRW(usdAsset * usdKrw.rate) : "-"}
              sub={
                usdAsset > 0 ? (
                  <span className="block text-emerald-600 font-medium">
                    (${usdAsset.toLocaleString("en-US", { maximumFractionDigits: 0 })})
                  </span>
                ) : (
                  "미국 주식·예수금·채권 (원화 환산)"
                )
              }
              icon={DollarSign}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-500"
              badge={
                usdKrw.status === "live"
                  ? { label: "실시간", positive: true }
                  : usdKrw.status === "manual"
                  ? { label: "수동", positive: true }
                  : usdKrw.status === "cached"
                  ? { label: "마지막값", positive: true }
                  : { label: "기본 환율", positive: false }
              }
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-slate-50/90 via-white to-violet-50/40 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5 text-violet-600" aria-hidden />
                </div>
                <h2 className="text-sm font-bold text-gray-900 pt-2 sm:pt-1.5">
                  시장 심리 &amp; 방어자산 가이드
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
                <div className="flex-1 min-w-0 rounded-xl bg-white/80 border border-gray-100/80 px-4 py-3 text-sm text-gray-800 leading-relaxed">
                  <span className="font-semibold tabular-nums text-gray-900">
                    Fear &amp; Greed {fng.value}
                  </span>
                  <span className="text-gray-600"> ({fngBand.labelKo})</span>
                  <span
                    className="hidden sm:inline text-gray-300 mx-2 select-none"
                    aria-hidden
                  >
                    |
                  </span>
                  <span className="block sm:inline mt-1 sm:mt-0 text-gray-800">
                    현금성 자산 권장비중 : {fngBand.cashRange.min}~{fngBand.cashRange.max}%
                  </span>
                </div>

                <div className="rounded-xl bg-white/80 border border-gray-100/80 px-4 py-3 shrink-0 sm:min-w-[13.5rem] sm:max-w-[20rem]">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    차이 (권장 − 현재)
                  </p>
                  {defensiveGapDiffDisplay ? (
                    <div
                      className={`font-semibold text-lg mt-0.5 leading-snug ${defensiveGapDiffDisplay.textColor}`}
                    >
                      {defensiveGapDiffDisplay.label}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 mt-1">—</p>
                  )}
                </div>
              </div>

              {defensiveStrategy && totalAssetKRW > 0 && (
                <div className="rounded-xl border border-violet-200/60 bg-violet-50/50 px-4 py-3 space-y-3">
                  <p className="text-xs font-bold text-violet-900">행동 제안</p>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {defensiveStrategy.headline}
                    </p>
                    {defensiveStrategy.gapPct > 1 && defensiveNeededKrw > 0 && (
                      <p className="text-sm text-gray-800 tabular-nums">
                        약 {formatKRW(defensiveNeededKrw)} 추가 확보 필요
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 space-y-1.5 pt-2 border-t border-violet-200/50">
                    <p className="font-semibold text-gray-900">현재 방어자산</p>
                    <ul className="space-y-0.5 text-gray-700 pl-0 list-none">
                      <li className="flex flex-wrap gap-x-1">
                        <span className="text-gray-500 shrink-0">- 예수금:</span>
                        <span className="tabular-nums font-medium text-gray-900">
                          {formatKRW(totalCashKrw)}
                        </span>
                      </li>
                      <li className="flex flex-wrap gap-x-1">
                        <span className="text-gray-500 shrink-0">- 채권:</span>
                        <span className="tabular-nums font-medium text-gray-900">
                          {formatKRW(totalBondKrw)}
                        </span>
                      </li>
                    </ul>
                    <p className="text-gray-800 pt-0.5 tabular-nums">
                      → 합계:{" "}
                      <span className="font-semibold text-gray-900">
                        {formatKRW(totalDefensiveKrw)}
                      </span>{" "}
                      <span className="text-gray-600">
                        ({currentDefensiveWeightPct.toFixed(1)}%)
                      </span>
                    </p>
                  </div>

                  {(rebalanceSellBuyTop.sell.length > 0 ||
                    rebalanceSellBuyTop.buy.length > 0) && (
                    <div className="space-y-4 pt-2 border-t border-violet-200/50">
                      {rebalanceSellBuyTop.sell.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-rose-900 mb-2">
                            SELL 제안
                          </p>
                          <ul className="space-y-2">
                            {rebalanceSellBuyTop.sell.map((r) => (
                              <li
                                key={r.key}
                                className="text-xs sm:text-sm text-gray-800 leading-relaxed border-b border-violet-100/80 pb-2 last:border-0 last:pb-0"
                              >
                                <span className="text-gray-800">
                                  <span className="font-semibold text-gray-900">
                                    {r.name}({r.excessPct.toFixed(1)}% 초과)
                                  </span>
                                  {" : "}
                                  <span className="tabular-nums font-medium text-rose-700">
                                    {formatRebalanceProposalManwon(r.amountKrw)}
                                  </span>
                                  {" 매도 "}
                                  <span className="tabular-nums text-gray-700">
                                    (현재 비중 : {r.currentPct.toFixed(1)}%, 목표 최대{" "}
                                    {r.targetMax.toFixed(1)}%)
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rebalanceSellBuyTop.buy.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-blue-900 mb-2">
                            BUY 제안
                          </p>
                          <ul className="space-y-2">
                            {rebalanceSellBuyTop.buy.map((r) => (
                              <li
                                key={r.key}
                                className="text-xs sm:text-sm text-gray-800 leading-relaxed border-b border-violet-100/80 pb-2 last:border-0 last:pb-0"
                              >
                                <span className="text-gray-800">
                                  <span className="font-semibold text-gray-900">
                                    {r.name}({r.shortagePct.toFixed(1)}% 부족)
                                  </span>
                                  {" : "}
                                  <span className="tabular-nums font-medium text-blue-700">
                                    {formatRebalanceProposalManwon(r.amountKrw)}
                                  </span>
                                  {" 추가 구매 "}
                                  <span className="tabular-nums text-gray-700">
                                    (현재 비중 : {r.currentPct.toFixed(1)}%, 목표 최소{" "}
                                    {r.targetMin.toFixed(1)}%)
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <AssetTrendChart snapshots={snapshots} />
            </div>

            <div className="lg:col-span-2">
              <DashboardAllocationChart
                holdings={holdings}
                usdKrwRate={usdKrw.rate}
              />
            </div>
          </div>

          {dashboardStockTableRows.length > 0 && (
            <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">보유 종목</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    통합 총자산(원화+달러 환산) 기준 비중 · 목표 구간 대비 BUY / HOLD / SELL
                  </p>
                </div>
                <Link
                  href="/assets?tab=holdings"
                  className="text-xs font-semibold text-[#5b6af4] hover:underline shrink-0"
                >
                  전체 편집 → 현재 Holdings
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        구간
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        종목명
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        티커
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        평가금액(원화)
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        현재 비중
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        목표 비중
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        상태
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dashboardStockTableRows.map(
                      ({ g, sectionLabel, evalKrw, weight, bandOk, tMin, tMax, signal }) => {
                        const rowTint = !signal
                          ? "hover:bg-gray-50/60 transition-colors"
                          : signal.status === "BUY"
                            ? "bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100 transition-colors"
                            : signal.status === "HOLD"
                              ? "bg-gray-50 border-l-4 border-gray-400 hover:bg-gray-100 transition-colors"
                              : "bg-red-50 border-l-4 border-red-500 hover:bg-red-100 transition-colors";

                        return (
                          <tr key={`${g.groupKey}-${sectionLabel}`} className={rowTint}>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {sectionLabel}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800">{g.name}</td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                {g.symbol || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                              {formatKRW(evalKrw)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                              {weight.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              {bandOk && tMin != null && tMax != null ? (
                                <span className="text-xs text-gray-600 tabular-nums">
                                  {formatTargetRange(tMin, tMax)}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {signal ? (
                                <div className="flex flex-col gap-0.5 items-start">
                                  <span
                                    className={clsx(
                                      "text-xs font-bold",
                                      signal.status === "BUY" && "text-blue-600",
                                      signal.status === "HOLD" && "text-emerald-600",
                                      signal.status === "SELL" && "text-red-600"
                                    )}
                                  >
                                    {signal.status}
                                  </span>
                                  {signal.status !== "HOLD" && signal.diffPercent != null && (
                                    <span
                                      className={clsx(
                                        "text-[11px] tabular-nums font-medium",
                                        signal.status === "BUY" && "text-blue-500",
                                        signal.status === "SELL" && "text-red-500"
                                      )}
                                    >
                                      {formatDiffLabel(signal.diffPercent)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {holdings.length === 0 && snapshots.length === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  자산 데이터가 없습니다
                </p>
                <p className="text-xs text-amber-600 mt-0.5">
                  <Link
                    href="/assets/upload"
                    className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                  >
                    초기자료 업로드
                  </Link>
                  를 하거나, 상단 탭의{" "}
                  <strong>현재 Holdings</strong>에서 보유 종목을 등록해주세요.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {fxModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="presentation"
          onClick={closeFxModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fx-manual-title"
            className="w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="fx-manual-title"
              className="text-base font-bold text-gray-900"
            >
              USD/KRW 환율 직접 입력
            </h2>
            <p className="text-xs text-gray-500">
              외부 조회가 되지 않을 때 적용할 환율을 저장합니다. 저장 즉시 대시보드에
              반영됩니다.
            </p>
            <div className="space-y-1.5">
              <label
                htmlFor="fx-manual-rate"
                className="text-xs font-semibold text-gray-600"
              >
                환율 (원/USD)
              </label>
              <input
                id="fx-manual-rate"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="예: 1418"
                value={fxManualInput}
                onChange={(e) => setFxManualInput(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
              />
            </div>
            {fxManualError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1.5">
                {fxManualError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeFxModal}
                disabled={fxManualSaving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleManualFxSave}
                disabled={fxManualSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {fxManualSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
