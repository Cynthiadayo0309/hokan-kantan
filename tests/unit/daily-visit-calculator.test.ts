import { describe, expect, it } from "vitest";
import type { DailyVisitInput } from "../../src/shared/types";
import { DailyVisitCalculator } from "../../src/main/services/DailyVisitCalculator";

const baseVisit: DailyVisitInput = {
  visitDate: "2026-06-10",
  basicFeeApplicable: "applicable",
  managementFeeApplicable: "applicable",
  profession: "nurse",
  visitCount: 1,
  longVisitType: "not_applicable",
  multipleStaffType: "not_applicable",
  emergencyType: "not_applicable",
  specialManagementType: "none",
  dischargeJointGuidanceType: "not_applicable",
  dischargeSupportGuidanceType: "not_applicable",
  timeVisitRequestedByPatientOrFamily: "not_applicable",
  multipleVisitEligibilityType: "none",
  multipleStaffCategory: "none",
  singlePersonVisitDifficult: "not_applicable",
  multipleStaffConsent: "not_applicable",
  simultaneousMultipleStaffVisit: "not_applicable",
  longVisitEligibilityType: "none",
  emergencyUnplanned: "not_applicable",
  emergencyRequestedByPatientOrFamily: "not_applicable",
  emergencyPhysicianInstruction: "not_applicable",
  dischargeSupportGuidanceCategory: "none",
  dischargeSupportTotalMinutes: 0,
  firstVisitAfterDischarge: "not_applicable",
  timeSlots: [{ sequence: 1, startTime: "10:00", endTime: "10:30", endDayType: "same_day" }]
};

describe("DailyVisitCalculator", () => {
  it("calculates same-day visit duration", () => {
    const result = DailyVisitCalculator.normalize(baseVisit);
    expect(result.slots[0].durationMinutes).toBe(30);
    expect(result.slots[0].timeZoneType).toBe("daytime");
  });

  it("calculates next-day visit duration", () => {
    const result = DailyVisitCalculator.normalize({
      ...baseVisit,
      timeSlots: [{ sequence: 1, startTime: "23:30", endTime: "00:10", endDayType: "next_day" }]
    });
    expect(result.slots[0].durationMinutes).toBe(40);
  });

  it("rejects same-day end before start", () => {
    expect(() =>
      DailyVisitCalculator.normalize({
        ...baseVisit,
        timeSlots: [{ sequence: 1, startTime: "10:30", endTime: "10:00", endDayType: "same_day" }]
      })
    ).toThrow();
  });

  it("rejects overlapping multiple visits", () => {
    expect(() =>
      DailyVisitCalculator.normalize({
        ...baseVisit,
        visitCount: 2,
        timeSlots: [
          { sequence: 1, startTime: "10:00", endTime: "10:30", endDayType: "same_day" },
          { sequence: 2, startTime: "10:20", endTime: "10:50", endDayType: "same_day" }
        ]
      })
    ).toThrow("重複");
  });

  it("accepts non-overlapping multiple visits", () => {
    const result = DailyVisitCalculator.normalize({
      ...baseVisit,
      visitCount: 2,
      timeSlots: [
        { sequence: 1, startTime: "10:00", endTime: "10:30", endDayType: "same_day" },
        { sequence: 2, startTime: "19:00", endTime: "19:30", endDayType: "same_day" }
      ]
    });
    expect(result.slots).toHaveLength(2);
  });

  it("detects overlap when first visit ends next day", () => {
    expect(() =>
      DailyVisitCalculator.normalize({
        ...baseVisit,
        visitCount: 2,
        timeSlots: [
          { sequence: 1, startTime: "23:30", endTime: "00:30", endDayType: "next_day" },
          { sequence: 2, startTime: "23:50", endTime: "23:55", endDayType: "same_day" }
        ]
      })
    ).toThrow("重複");
  });
});
