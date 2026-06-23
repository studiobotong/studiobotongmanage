"use client";

import { todayKst } from "@/lib/kstDate";
import { defaultHomePeriodFilter } from "@/lib/homePeriod";
import type { HomePeriodFilter, HomePeriodPreset } from "@/types/dashboard";

const PRESETS: { value: HomePeriodPreset; label: string }[] = [
  { value: "last30", label: "최근 30일" },
  { value: "thisMonth", label: "이번 달" },
  { value: "lastMonth", label: "지난 달" },
  { value: "thisYear", label: "올해" },
  { value: "custom", label: "직접 설정" },
];

interface DashboardHomePeriodFilterProps {
  value: HomePeriodFilter;
  onChange: (value: HomePeriodFilter) => void;
}

export default function DashboardHomePeriodFilter({
  value,
  onChange,
}: DashboardHomePeriodFilterProps) {
  const today = todayKst();

  const selectPreset = (preset: HomePeriodPreset) => {
    if (preset === "custom") {
      onChange({ ...value, preset: "custom" });
      return;
    }
    onChange({ ...defaultHomePeriodFilter(), preset });
  };

  const updateCustom = (patch: Partial<Pick<HomePeriodFilter, "startDate" | "endDate">>) => {
    onChange({
      ...value,
      preset: "custom",
      ...patch,
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap rounded-lg border border-[#E5E7EB] overflow-hidden">
        {PRESETS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => selectPreset(opt.value)}
            className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              value.preset === opt.value
                ? "bg-[#2563EB] text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={value.startDate}
            max={value.endDate || today}
            onChange={(e) => updateCustom({ startDate: e.target.value })}
            className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-xs text-gray-700 bg-white"
            aria-label="시작일"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="date"
            value={value.endDate}
            min={value.startDate}
            max={today}
            onChange={(e) => updateCustom({ endDate: e.target.value })}
            className="rounded-lg border border-[#E5E7EB] px-2 py-1.5 text-xs text-gray-700 bg-white"
            aria-label="종료일"
          />
        </div>
      )}
    </div>
  );
}
