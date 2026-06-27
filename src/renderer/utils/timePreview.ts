import type { EndDayType, TimeZoneBreakdown, TimeZoneType } from "../../shared/types";

const ranges: Array<{ zone: Exclude<TimeZoneType, "mixed">; start: number; end: number }> = [
  { zone: "midnight", start: 0, end: 360 },
  { zone: "early_morning", start: 360, end: 480 },
  { zone: "daytime", start: 480, end: 1080 },
  { zone: "night", start: 1080, end: 1320 },
  { zone: "midnight", start: 1320, end: 1440 }
];

export function previewTime(startTime: string, endTime: string, endDayType: EndDayType): {
  durationMinutes: number;
  timeZoneType: TimeZoneType;
  breakdown: TimeZoneBreakdown[];
  error: string;
} {
  try {
    const start = parse(startTime);
    let end = parse(endTime);
    if (endDayType === "next_day") end += 1440;
    const durationMinutes = end - start;
    if (durationMinutes <= 0) throw new Error("終了時刻を開始時刻より後にしてください。");
    if (durationMinutes >= 1440) throw new Error("訪問時間は24時間未満にしてください。");

    const totals = new Map<Exclude<TimeZoneType, "mixed">, number>();
    let cursor = start;
    while (cursor < end) {
      const dayMinute = cursor % 1440;
      const range = ranges.find((item) => dayMinute >= item.start && dayMinute < item.end);
      if (!range) throw new Error("時刻が不正です。");
      const segmentEnd = Math.min(end, cursor - dayMinute + range.end);
      totals.set(range.zone, (totals.get(range.zone) ?? 0) + segmentEnd - cursor);
      cursor = segmentEnd;
    }
    const breakdown = Array.from(totals.entries()).map(([zone, minutes]) => ({ zone, minutes }));
    return {
      durationMinutes,
      timeZoneType: breakdown.length === 1 ? breakdown[0].zone : "mixed",
      breakdown,
      error: ""
    };
  } catch (error) {
    return {
      durationMinutes: 0,
      timeZoneType: "mixed",
      breakdown: [],
      error: error instanceof Error ? error.message : "時刻を確認してください。"
    };
  }
}

function parse(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) throw new Error("時刻を選択してください。");
  return hour * 60 + minute;
}
