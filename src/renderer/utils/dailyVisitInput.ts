import type { DailyVisitInput } from "../../shared/types";

export function toSavableDailyVisitInput(source: DailyVisitInput, visitDate: string = source.visitDate): DailyVisitInput {
  return {
    visitDate,
    basicFeeApplicable: source.basicFeeApplicable,
    managementFeeApplicable: source.managementFeeApplicable,
    profession: source.profession,
    visitCount: source.visitCount,
    longVisitType: source.longVisitType,
    multipleStaffType: source.multipleStaffType,
    emergencyType: source.emergencyType,
    specialManagementType: source.specialManagementType,
    dischargeJointGuidanceType: source.dischargeJointGuidanceType,
    dischargeSupportGuidanceType: source.dischargeSupportGuidanceType,
    timeVisitRequestedByPatientOrFamily: source.timeVisitRequestedByPatientOrFamily,
    multipleVisitEligibilityType: source.multipleVisitEligibilityType,
    multipleStaffCategory: source.multipleStaffCategory,
    singlePersonVisitDifficult: source.singlePersonVisitDifficult,
    multipleStaffConsent: source.multipleStaffConsent,
    simultaneousMultipleStaffVisit: source.simultaneousMultipleStaffVisit,
    longVisitEligibilityType: source.longVisitEligibilityType,
    emergencyUnplanned: source.emergencyUnplanned,
    emergencyRequestedByPatientOrFamily: source.emergencyRequestedByPatientOrFamily,
    emergencyPhysicianInstruction: source.emergencyPhysicianInstruction,
    dischargeSupportGuidanceCategory: source.dischargeSupportGuidanceCategory,
    dischargeSupportTotalMinutes: Number(source.dischargeSupportTotalMinutes) || 0,
    firstVisitAfterDischarge: source.firstVisitAfterDischarge,
    timeSlots: source.timeSlots.map((slot, index) => ({
      sequence: index + 1,
      startTime: slot.startTime,
      endTime: slot.endTime,
      endDayType: slot.endDayType
    }))
  };
}
