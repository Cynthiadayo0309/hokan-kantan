import { reactive } from "vue";
import { describe, expect, it } from "vitest";
import type { DailyVisit, DailyVisitInput } from "../../src/shared/types";
import { toSavableDailyVisitInput } from "../../src/renderer/utils/dailyVisitInput";

describe("toSavableDailyVisitInput", () => {
  it("removes reactive warning and calculated fields from an existing visit", () => {
    const source = reactive<DailyVisit>({
      ...baseVisit("2026-06-10"),
      id: 1,
      warnings: ["1回目の訪問が翌日にまたがっています。"],
      timeSlots: [
        {
          sequence: 1,
          startTime: "23:30",
          endTime: "00:10",
          endDayType: "next_day",
          durationMinutes: 40,
          timeZoneType: "midnight",
          timeZoneBreakdown: [{ zone: "midnight", minutes: 40 }]
        }
      ]
    });

    const payload = toSavableDailyVisitInput(source, "2026-06-12");

    expect(() => structuredClone(payload)).not.toThrow();
    expect(payload.visitDate).toBe("2026-06-12");
    expect("warnings" in payload).toBe(false);
    expect("durationMinutes" in payload.timeSlots[0]).toBe(false);
    expect(payload.timeSlots[0]).toEqual({
      sequence: 1,
      startTime: "23:30",
      endTime: "00:10",
      endDayType: "next_day"
    });
  });
});

function baseVisit(visitDate: string): DailyVisitInput {
  return {
    visitDate,
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
}
