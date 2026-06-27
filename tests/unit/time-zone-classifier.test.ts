import { describe, expect, it } from "vitest";
import { TimeZoneClassifier } from "../../src/main/services/TimeZoneClassifier";

describe("TimeZoneClassifier", () => {
  it.each([
    ["05:59", "midnight"],
    ["06:00", "early_morning"],
    ["07:59", "early_morning"],
    ["08:00", "daytime"],
    ["17:59", "daytime"],
    ["18:00", "night"],
    ["21:59", "night"],
    ["22:00", "midnight"]
  ] as const)("classifies boundary time %s", (time, expected) => {
    expect(TimeZoneClassifier.zoneAt(time)).toBe(expected);
  });

  it("classifies midnight visit across next day", () => {
    const result = TimeZoneClassifier.classify("23:30", "00:30", "next_day");
    expect(result.durationMinutes).toBe(60);
    expect(result.timeZoneType).toBe("midnight");
  });

  it.each([
    ["17:45", "18:15"],
    ["07:45", "08:15"],
    ["21:45", "22:15"]
  ] as const)("detects mixed time zone %s-%s", (start, end) => {
    const result = TimeZoneClassifier.classify(start, end, "same_day");
    expect(result.timeZoneType).toBe("mixed");
    expect(result.breakdown.reduce((sum, item) => sum + item.minutes, 0)).toBe(30);
  });
});
