"use client";

import type { DateFilterGranularity, DateFilterValue } from "@/types/dashboardSales";

interface DashboardDateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
}

const GRANULARITY_OPTIONS: { value: DateFilterGranularity; label: string }[] = [
  { value: "year", label: "연" },
  { value: "month", label: "월" },
  { value: "day", label: "일" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default function DashboardDateFilter({
  value,
  onChange,
}: DashboardDateFilterProps) {
  const maxDay = daysInMonth(value.year, value.month);
  const safeDay = Math.min(value.day, maxDay);

  const update = (patch: Partial<DateFilterValue>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
        {GRANULARITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => update({ granularity: opt.value })}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              value.granularity === opt.value
                ? "bg-[#2563EB] text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <select
        value={value.year}
        onChange={(e) => update({ year: Number(e.target.value) })}
        className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-gray-700 bg-white"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>

      {value.granularity !== "year" && (
        <select
          value={value.month}
          onChange={(e) => update({ month: Number(e.target.value) })}
          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-gray-700 bg-white"
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>
              {m}월
            </option>
          ))}
        </select>
      )}

      {value.granularity === "day" && (
        <select
          value={safeDay}
          onChange={(e) => update({ day: Number(e.target.value) })}
          className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm text-gray-700 bg-white"
        >
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}일
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
