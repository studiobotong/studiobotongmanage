"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import Button from "@/components/Button";
import DashboardTabBar from "@/components/dashboard/DashboardTabBar";
import DashboardHomeTab from "@/components/dashboard/DashboardHomeTab";
import DashboardSalesTab from "@/components/dashboard/DashboardSalesTab";
import DashboardMarketingTab from "@/components/dashboard/DashboardMarketingTab";
import type { DashboardTabId } from "@/types/dashboardSales";

const VALID_TABS: DashboardTabId[] = ["home", "sales", "marketing"];

function parseTab(param: string | null): DashboardTabId {
  if (param && VALID_TABS.includes(param as DashboardTabId)) {
    return param as DashboardTabId;
  }
  return "home";
}

export default function DashboardPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (tab: DashboardTabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "home") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/");
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const subtitle =
    activeTab === "home"
      ? "오늘 상황과 해야 할 일"
      : activeTab === "sales"
        ? "매출 분석 및 추이"
        : "광고 효율 분석";

  return (
    <>
      <Header title="Dashboard" subtitle={subtitle} />
      <DashboardTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab !== "home" && (
          <div className="flex items-center justify-end mb-6">
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="ml-1.5">새로고침</span>
            </Button>
          </div>
        )}

        {activeTab === "home" && <DashboardHomeTab refreshKey={refreshKey} />}
        {activeTab === "sales" && (
          <DashboardSalesTab refreshKey={refreshKey} />
        )}
        {activeTab === "marketing" && (
          <DashboardMarketingTab refreshKey={refreshKey} />
        )}
      </div>
    </>
  );
}
