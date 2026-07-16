import { describe, expect, it } from "vitest";
import { normalizeCareServiceDays } from "../../src/main/repositories/CareEstimateRepository";
import type { CareServiceEntryInput } from "../../src/shared/types";

describe("normalizeCareServiceDays", () => {
  it("normalizes every service on every copy target before persistence", () => {
    const days = normalizeCareServiceDays("2026-07", [
      { visitDate: "2026-07-08", services: copiedServices() },
      { visitDate: "2026-07-15", services: copiedServices() },
      { visitDate: "2026-07-22", services: copiedServices() }
    ]);

    expect(days.map((day) => day.visitDate)).toEqual(["2026-07-08", "2026-07-15", "2026-07-22"]);
    expect(days.every((day) => day.services.length === 2)).toBe(true);
    expect(days[0].services[0]).toMatchObject({ durationMinutes: 30, serviceCategory: "under_60" });
    expect(days[0].services[1]).toMatchObject({ profession: "physical_therapist", durationMinutes: 40, serviceCategory: "rehab", unplannedEmergency: true });
  });

  it("rejects duplicate, cross-month, empty, and more than 31 days", () => {
    expect(() => normalizeCareServiceDays("2026-07", [])).toThrow("1日から31日");
    expect(() => normalizeCareServiceDays("2026-07", [
      { visitDate: "2026-07-01", services: [service()] },
      { visitDate: "2026-07-01", services: [service()] }
    ])).toThrow("同じ日付");
    expect(() => normalizeCareServiceDays("2026-07", [{ visitDate: "2026-08-01", services: [service()] }])).toThrow("対象年月");
    expect(() => normalizeCareServiceDays("2026-07", [{ visitDate: "2026-07-32", services: [service()] }])).toThrow("対象年月");
    expect(() => normalizeCareServiceDays("2026-07", Array.from({ length: 32 }, (_, index) => ({
      visitDate: `2026-07-${String((index % 31) + 1).padStart(2, "0")}`,
      services: [service()]
    })))).toThrow("1日から31日");
  });

  it("rejects the whole batch when a later day has an invalid service", () => {
    const days = [
      { visitDate: "2026-07-01", services: [service()] },
      { visitDate: "2026-07-02", services: [service({ startTime: "10:00", endTime: "10:00" })] }
    ];

    expect(() => normalizeCareServiceDays("2026-07", days)).toThrow();
  });
});

function copiedServices(): CareServiceEntryInput[] {
  return [
    service(),
    service({ sequence: 2, profession: "physical_therapist", startTime: "10:00", endTime: "10:40", unplannedEmergency: true })
  ];
}

function service(overrides: Partial<CareServiceEntryInput> = {}): CareServiceEntryInput {
  return {
    sequence: 1,
    profession: "nurse",
    startTime: "09:00",
    endTime: "09:30",
    endDayType: "same_day",
    unplannedEmergency: false,
    ...overrides
  };
}
