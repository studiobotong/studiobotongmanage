import {
  addDaysKst,
  monthEndKst,
  monthStartKst,
  todayKst,
  yearStartKst,
} from "./kstDate";
import type { HomePeriodFilter, HomePeriodPreset } from "@/types/dashboard";

export function defaultHomePeriodFilter(): HomePeriodFilter {
  const today = todayKst();
  return {
    preset: "last30",
    startDate: addDaysKst(today, -29),
    endDate: today,
  };
}

export function resolveHomePeriodRange(filter: HomePeriodFilter): {
  start: string;
  end: string;
} {
  const today = todayKst();

  switch (filter.preset) {
    case "last30":
      return { start: addDaysKst(today, -29), end: today };
    case "thisMonth":
      return { start: monthStartKst(today), end: today };
    case "lastMonth": {
      const [y, m] = today.split("-").map(Number);
      const prevMonth = m === 1 ? 12 : m! - 1;
      const prevYear = m === 1 ? y! - 1 : y!;
      const start = monthStartKst(
        `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`
      );
      const end = monthEndKst(prevYear, prevMonth);
      return { start, end };
    }
    case "thisYear":
      return { start: yearStartKst(today), end: today };
    case "custom": {
      const start = filter.startDate <= filter.endDate ? filter.startDate : filter.endDate;
      const end = filter.startDate <= filter.endDate ? filter.endDate : filter.startDate;
      return { start, end };
    }
  }
}

export function daysBetweenKst(start: string, end: string): number {
  const a = new Date(`${start}T12:00:00+09:00`);
  const b = new Date(`${end}T12:00:00+09:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function previousPeriodRange(
  start: string,
  end: string
): { start: string; end: string } {
  const length = daysBetweenKst(start, end) + 1;
  const prevEnd = addDaysKst(start, -1);
  const prevStart = addDaysKst(prevEnd, -(length - 1));
  return { start: prevStart, end: prevEnd };
}

const PRESET_LABELS: Record<Exclude<HomePeriodPreset, "custom">, string> = {
  last30: "최근 30일",
  thisMonth: "이번 달",
  lastMonth: "지난 달",
  thisYear: "올해",
};

export function formatHomePeriodLabel(filter: HomePeriodFilter): string {
  if (filter.preset !== "custom") {
    return PRESET_LABELS[filter.preset];
  }
  const { start, end } = resolveHomePeriodRange(filter);
  const fmt = (d: string) => d.replace(/-/g, ".");
  if (start === end) return fmt(start);
  return `${fmt(start)} ~ ${fmt(end)}`;
}
