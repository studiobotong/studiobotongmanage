"use client";

import clsx from "clsx";
import type { DashboardTabId } from "@/types/dashboardSales";

const TABS: { id: DashboardTabId; label: string }[] = [
  { id: "home", label: "기본홈" },
  { id: "sales", label: "매출종합" },
  { id: "marketing", label: "마케팅" },
];

const ACCENT = "#2563EB";

interface DashboardTabBarProps {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
}

export default function DashboardTabBar({
  activeTab,
  onTabChange,
}: DashboardTabBarProps) {
  return (
    <div className="border-b border-[#E5E7EB] bg-white">
      <div className="flex gap-1 px-4 sm:px-6 lg:px-8">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                "relative h-11 px-4 text-sm font-medium transition-colors",
                active ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
            >
              {tab.label}
              {active && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { TABS };
