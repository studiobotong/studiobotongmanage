"use client";

import { useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  Calendar,
  Save,
  ChevronDown,
  History,
} from "lucide-react";
import type { AssetHistory, AssetSummary, HistoryPeriod } from "@/types/assets";
import { generateHistoryId } from "@/lib/assets";
import AssetHistoryTable from "@/components/assets/AssetHistoryTable";

interface Props {
  summary: AssetSummary;
  history: AssetHistory[];
  onSave: (entry: AssetHistory) => void;
}

const PERIOD_TABS: {
  value: HistoryPeriod;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "daily", label: "일별", icon: CalendarDays },
  { value: "monthly", label: "월별", icon: CalendarRange },
  { value: "yearly", label: "연도별", icon: Calendar },
];

function formatDateForPeriod(period: HistoryPeriod): string {
  const now = new Date();
  if (period === "daily") {
    return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (period === "monthly") {
    return now.toISOString().slice(0, 7); // YYYY-MM
  }
  return now.getFullYear().toString(); // YYYY
}

export default function AssetHistorySection({ summary, history, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<HistoryPeriod>("daily");
  const [saving, setSaving] = useState<HistoryPeriod | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleSave = (period: HistoryPeriod) => {
    setSaving(period);
    setTimeout(() => {
      const entry: AssetHistory = {
        id: generateHistoryId(),
        period,
        date: formatDateForPeriod(period),
        totalBuyAmount: summary.totalBuyAmount,
        totalEvaluationAmount: summary.totalEvaluationAmount,
        totalProfit: summary.totalProfit,
        totalReturnRate: summary.totalReturnRate,
        psyAmount: summary.psyAmount,
        domesticProfit: summary.domesticProfit,
      };
      onSave(entry);
      setSaving(null);
    }, 400);
  };

  const filteredHistory = history.filter((h) => h.period === activeTab);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#eef0fe] flex items-center justify-center">
            <History className="w-4 h-4 text-[#5b6af4]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              자산 스냅샷 히스토리
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              현재 자산 상태를 기간별로 저장하고 추세를 추적하세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#5b6af4] bg-[#eef0fe] font-semibold px-2.5 py-1 rounded-lg">
            {history.length}개 저장됨
          </span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                expanded ? "" : "-rotate-90"
              }`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-6 space-y-5">
          {/* Save buttons */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              현재 자산 상태 저장
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PERIOD_TABS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleSave(value)}
                  disabled={saving === value}
                  className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                    saving === value
                      ? "bg-[#5b6af4] text-white border-[#5b6af4] opacity-75 cursor-not-allowed"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#5b6af4] hover:text-[#5b6af4] hover:bg-[#f8f9ff] hover:shadow-sm"
                  }`}
                >
                  {saving === value ? (
                    <Save className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                  <span>
                    {saving === value
                      ? "저장 중..."
                      : `오늘 ${label} 저장`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-50" />

          {/* History view */}
          <div>
            {/* Period tabs */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
                {PERIOD_TABS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTab(value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === value
                        ? "bg-white text-[#5b6af4] shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    {history.filter((h) => h.period === value).length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          activeTab === value
                            ? "bg-[#eef0fe] text-[#5b6af4]"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {history.filter((h) => h.period === value).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {filteredHistory.length}개 기록
              </p>
            </div>

            {/* Table */}
            <AssetHistoryTable history={filteredHistory} />
          </div>
        </div>
      )}
    </div>
  );
}
