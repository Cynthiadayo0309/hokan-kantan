export function daysInMonth(targetMonth: string): Date[] {
  const [year, month] = targetMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => new Date(year, month - 1, index + 1));
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split("-");
  return `${year}年${Number(month)}月`;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return toDateKey(today) === toDateKey(date);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

const holidays = new Set([
  "2026-01-01",
  "2026-01-12",
  "2026-02-11",
  "2026-02-23",
  "2026-03-20",
  "2026-04-29",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-05-06",
  "2026-07-20",
  "2026-08-11",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-10-12",
  "2026-11-03",
  "2026-11-23"
]);

export function isHoliday(date: Date): boolean {
  return holidays.has(toDateKey(date));
}

export function weekdayLabel(date: Date): string {
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}
