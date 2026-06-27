import type { EndDayType, TimeZoneBreakdown, TimeZoneType } from "../../shared/types";

const DAY_MINUTES = 24 * 60;

type Range = {
  zone: Exclude<TimeZoneType, "mixed">;
  start: number;
  end: number;
};

const ZONE_RANGES: Range[] = [
  { zone: "midnight", start: 0, end: 360 },
  { zone: "early_morning", start: 360, end: 480 },
  { zone: "daytime", start: 480, end: 1080 },
  { zone: "night", start: 1080, end: 1320 },
  { zone: "midnight", start: 1320, end: 1440 }
];

export type ClassifiedVisitTime = {
  durationMinutes: number;
  timeZoneType: TimeZoneType;
  breakdown: TimeZoneBreakdown[];
};

export function parseTimeToMinutes(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("不正な時刻です。");
  }

  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error("不正な時刻です。");
  }

  return hour * 60 + minute;
}

export class TimeZoneClassifier {
  static calculateDuration(startTime: string, endTime: string, endDayType: EndDayType): number {
    const start = parseTimeToMinutes(startTime);
    let end = parseTimeToMinutes(endTime);

    if (endDayType === "next_day") {
      end += DAY_MINUTES;
    }

    const duration = end - start;
    if (duration <= 0) {
      throw new Error("訪問時間が0分、または終了時刻が開始時刻以前です。");
    }
    if (duration >= DAY_MINUTES) {
      throw new Error("訪問時間が24時間以上です。");
    }

    return duration;
  }

  static classify(startTime: string, endTime: string, endDayType: EndDayType): ClassifiedVisitTime {
    const start = parseTimeToMinutes(startTime);
    const durationMinutes = this.calculateDuration(startTime, endTime, endDayType);
    const end = start + durationMinutes;
    const breakdown = this.buildBreakdown(start, end);
    const zones = new Set(breakdown.map((item) => item.zone));

    return {
      durationMinutes,
      timeZoneType: zones.size === 1 ? breakdown[0].zone : "mixed",
      breakdown
    };
  }

  static zoneAt(time: string): Exclude<TimeZoneType, "mixed"> {
    const minutes = parseTimeToMinutes(time);
    const range = ZONE_RANGES.find((item) => minutes >= item.start && minutes < item.end);
    if (!range) {
      throw new Error("不正な時刻です。");
    }
    return range.zone;
  }

  private static buildBreakdown(start: number, end: number): TimeZoneBreakdown[] {
    const totals = new Map<Exclude<TimeZoneType, "mixed">, number>();
    let cursor = start;

    while (cursor < end) {
      const dayMinute = cursor % DAY_MINUTES;
      const range = ZONE_RANGES.find((item) => dayMinute >= item.start && dayMinute < item.end);
      if (!range) {
        throw new Error("不正な時刻です。");
      }
      const nextBoundary = cursor - dayMinute + range.end;
      const segmentEnd = Math.min(end, nextBoundary);
      totals.set(range.zone, (totals.get(range.zone) ?? 0) + segmentEnd - cursor);
      cursor = segmentEnd;
    }

    return Array.from(totals.entries()).map(([zone, minutes]) => ({ zone, minutes }));
  }
}
