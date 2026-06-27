import type { DailyVisit, MonthlyEstimate, Profession, ProfessionCategory } from "../../shared/types";

export function professionCategoryFor(profession: Profession): ProfessionCategory {
  if (profession === "assistant_nurse") return "assistant_nurse";
  if (profession === "physical_therapist" || profession === "occupational_therapist" || profession === "speech_therapist") return "rehab";
  return "nurse_group";
}

export class EligibilityEvaluator {
  static canCalculateBasic(estimate: MonthlyEstimate): { ok: boolean; message?: string } {
    if (estimate.sameBuildingCategory === "one") {
      return {
        ok: false,
        message: "1人区分は訪問看護基本療養費（Ⅰ）が必要ですが、今回は基本療養費（Ⅰ）を実装していないため合計に含めていません。"
      };
    }
    if (estimate.sameBuildingCategory === "one_or_two") {
      return {
        ok: false,
        message: "旧区分「1人または2人」は正式料金では判定できません。1人または2人を選び直してください。"
      };
    }
    return { ok: true };
  }

  static canCalculateTimeAddition(visit: DailyVisit): boolean {
    return visit.timeVisitRequestedByPatientOrFamily === "applicable";
  }

  static canCalculateMultipleVisit(visit: DailyVisit): boolean {
    return visit.visitCount >= 2 && visit.multipleVisitEligibilityType !== "none";
  }

  static canCalculateMultipleStaff(visit: DailyVisit): boolean {
    return (
      visit.multipleStaffCategory !== "none" &&
      visit.singlePersonVisitDifficult === "applicable" &&
      visit.multipleStaffConsent === "applicable" &&
      visit.simultaneousMultipleStaffVisit === "applicable"
    );
  }

  static canCalculateLongVisit(visit: DailyVisit): boolean {
    return visit.longVisitEligibilityType !== "none" && visit.timeSlots.some((slot) => slot.durationMinutes > 90);
  }

  static canCalculateEmergency(visit: DailyVisit): boolean {
    return (
      visit.emergencyUnplanned === "applicable" &&
      visit.emergencyRequestedByPatientOrFamily === "applicable" &&
      visit.emergencyPhysicianInstruction === "applicable"
    );
  }

  static canCalculateDischargeForProfession(visit: DailyVisit): { ok: boolean; message?: string } {
    if (visit.profession === "assistant_nurse") {
      return { ok: false, message: "准看護師は退院関連加算を算定できません。" };
    }
    return { ok: true };
  }
}
