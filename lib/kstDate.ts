/** KST(Asia/Seoul) 기준 날짜 유틸 */

const TZ = "Asia/Seoul";

export function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function addDaysKst(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function monthStartKst(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

export function yearStartKst(dateStr: string): string {
  return `${dateStr.slice(0, 4)}-01-01`;
}

export function toKstDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function toKstHour(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === "hour")?.value;
  return hour != null ? Number(hour) : -1;
}

export function kstDayStart(dateStr: string): string {
  return `${dateStr}T00:00:00+09:00`;
}

export function kstDayEnd(dateStr: string): string {
  return `${dateStr}T23:59:59.999+09:00`;
}

/** 월의 마지막 날 (YYYY-MM-DD) */
export function monthEndKst(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** 이번 주 월요일 (KST 기준) */
export function weekStartKst(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export const KST_WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function kstWeekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+09:00`);
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}
