"use client";

import { useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, ListChecks, Upload } from "lucide-react";
import { clsx } from "clsx";
import Header from "@/components/Header";
import AssetPortfolioDashboard from "@/components/AssetPortfolioDashboard";
import HoldingsManager from "@/components/HoldingsManager";

export type AssetTab = "dashboard" | "holdings";

function tabFromSearch(tabParam: string | null): AssetTab {
  return tabParam === "holdings" ? "holdings" : "dashboard";
}

export default function AssetPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(
    () => tabFromSearch(searchParams.get("tab")),
    [searchParams]
  );

  const setTab = useCallback(
    (next: AssetTab) => {
      const qs = next === "holdings" ? "?tab=holdings" : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
    },
    [router, pathname]
  );

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw && raw !== "holdings" && raw !== "dashboard") {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  return (
    <>
      <Header
        title="Asset"
        subtitle={
          tab === "holdings"
            ? "보유 종목 · 원화/달러 자산"
            : "자산 요약 · 변동 추이 · 비율"
        }
      />

      <div className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="px-6 pt-4 pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <nav
            className="flex gap-1 p-1 bg-gray-50 rounded-xl border border-gray-100 w-fit"
            aria-label="자산 영역 탭"
          >
            <button
              type="button"
              onClick={() => setTab("dashboard")}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === "dashboard"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-100"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <LayoutDashboard className="w-4 h-4 opacity-70" />
              대시보드
            </button>
            <button
              type="button"
              onClick={() => setTab("holdings")}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === "holdings"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-100"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <ListChecks className="w-4 h-4 opacity-70" />
              현재 Holdings
            </button>
          </nav>

          <Link
            href="/assets/upload"
            className="text-xs font-medium text-gray-400 hover:text-[#5b6af4] transition-colors flex items-center gap-1.5 sm:pb-2"
          >
            <Upload className="w-3.5 h-3.5" />
            초기자료 업로드
          </Link>
        </div>
      </div>

      {tab === "dashboard" ? <AssetPortfolioDashboard /> : <HoldingsManager />}
    </>
  );
}
