import type Database from "better-sqlite3";
import type {
  DailyVisit,
  DailyVisitInput,
  EligibilityRule,
  HighCostCareLimitRule,
  MonthlyEstimate,
  MonthlyEstimateInput,
  PricingRule,
  VisitTimeSlot
} from "../../shared/types";
import { DailyVisitCalculator } from "../services/DailyVisitCalculator";

export class EstimateRepository {
  constructor(private readonly db: Database.Database) {}

  getOrCreateCurrentEstimate(): MonthlyEstimate {
    const existing = this.db.prepare("SELECT id FROM monthly_estimates ORDER BY updated_at DESC LIMIT 1").get() as { id: number } | undefined;
    if (existing) {
      return this.getEstimate(existing.id);
    }

    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const timestamp = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO monthly_estimates
        (
          patient_name, facility_name, target_month, same_building_category, copayment_rate,
          basic_fee_type, station_category, single_building_resident_category, special_management_category,
          discharge_joint_guidance_count_category, special_management_guidance_applicable, high_cost_care_limit_category,
          created_at, updated_at
        )
        VALUES ('', '', ?, 'three_to_nine', 'unset', 'type_2', 'standard', 'under_20', 'none', 'none', 'not_applicable', 'unset', ?, ?)`
      )
      .run(targetMonth, timestamp, timestamp);
    return this.getEstimate(Number(result.lastInsertRowid));
  }

  saveEstimate(input: MonthlyEstimateInput): MonthlyEstimate {
    if (!input.targetMonth || !/^\d{4}-\d{2}$/.test(input.targetMonth)) {
      throw new Error("対象年月を選択してください。");
    }

    const timestamp = new Date().toISOString();
    if (input.id) {
      this.db
        .prepare(
          `UPDATE monthly_estimates
           SET patient_name = ?, facility_name = ?, target_month = ?, same_building_category = ?, copayment_rate = ?,
               basic_fee_type = ?, station_category = ?, single_building_resident_category = ?, special_management_category = ?,
               discharge_joint_guidance_count_category = ?, special_management_guidance_applicable = ?, high_cost_care_limit_category = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          input.patientName.trim(),
          input.facilityName.trim(),
          input.targetMonth,
          input.sameBuildingCategory,
          input.copaymentRate,
          input.basicFeeType,
          input.stationCategory,
          input.singleBuildingResidentCategory,
          input.specialManagementCategory,
          input.dischargeJointGuidanceCountCategory,
          input.specialManagementGuidanceApplicable,
          input.highCostCareLimitCategory,
          timestamp,
          input.id
        );
      return this.getEstimate(input.id);
    }

    const result = this.db
      .prepare(
        `INSERT INTO monthly_estimates
        (
          patient_name, facility_name, target_month, same_building_category, copayment_rate,
          basic_fee_type, station_category, single_building_resident_category, special_management_category,
          discharge_joint_guidance_count_category, special_management_guidance_applicable, high_cost_care_limit_category,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.patientName.trim(),
        input.facilityName.trim(),
        input.targetMonth,
        input.sameBuildingCategory,
        input.copaymentRate,
        input.basicFeeType,
        input.stationCategory,
        input.singleBuildingResidentCategory,
        input.specialManagementCategory,
        input.dischargeJointGuidanceCountCategory,
        input.specialManagementGuidanceApplicable,
        input.highCostCareLimitCategory,
        timestamp,
        timestamp
      );
    return this.getEstimate(Number(result.lastInsertRowid));
  }

  saveDailyVisit(monthlyEstimateId: number, visit: DailyVisitInput): DailyVisit {
    this.assertEstimateCanAcceptVisits(monthlyEstimateId);
    const timestamp = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      const dailyVisitId = this.upsertDailyVisit(monthlyEstimateId, visit, timestamp);
      this.touchEstimate(monthlyEstimateId);
      return dailyVisitId;
    });

    const id = transaction();
    return this.getDailyVisit(id);
  }

  saveDailyVisits(monthlyEstimateId: number, visits: DailyVisitInput[]): MonthlyEstimate {
    this.assertEstimateCanAcceptVisits(monthlyEstimateId);
    const timestamp = new Date().toISOString();

    const transaction = this.db.transaction(() => {
      for (const visit of visits) {
        this.upsertDailyVisit(monthlyEstimateId, visit, timestamp);
      }
      this.touchEstimate(monthlyEstimateId);
    });

    transaction();
    return this.getEstimate(monthlyEstimateId);
  }

  deleteDailyVisit(monthlyEstimateId: number, visitDate: string): MonthlyEstimate {
    this.db.prepare("DELETE FROM daily_visits WHERE monthly_estimate_id = ? AND visit_date = ?").run(monthlyEstimateId, visitDate);
    this.touchEstimate(monthlyEstimateId);
    return this.getEstimate(monthlyEstimateId);
  }

  resetEstimate(monthlyEstimateId: number): MonthlyEstimate {
    this.db.prepare("DELETE FROM daily_visits WHERE monthly_estimate_id = ?").run(monthlyEstimateId);
    this.touchEstimate(monthlyEstimateId);
    return this.getEstimate(monthlyEstimateId);
  }

  getPricingRules(): PricingRule[] {
    const rows = this.db.prepare("SELECT * FROM pricing_rules WHERE enabled = 1 ORDER BY id").all() as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id,
      itemCode: row.item_code,
      itemName: row.item_name,
      category: row.category,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      profession: row.profession,
      sameBuildingCategory: row.same_building_category,
      weeklyVisitCountCategory: row.weekly_visit_count_category,
      dailyVisitCountCategory: row.daily_visit_count_category,
      timeZoneType: row.time_zone_type,
      additionType: row.addition_type,
      unitPrice: row.unit_price,
      unitType: row.unit_type,
      roundingType: row.rounding_type,
      note: row.note,
      enabled: row.enabled === 1,
      samplePrice: (row.is_sample ?? row.sample_price) === 1,
      feeFamily: row.fee_family,
      feeCode: row.fee_code,
      professionCategory: row.profession_category,
      basicFeeType: row.basic_fee_type,
      sameBuildingDailyCountCategory: row.same_building_daily_count_category,
      singleBuildingResidentCategory: row.single_building_resident_category,
      stationCategory: row.station_category,
      weeklyVisitDayRange: row.weekly_visit_day_range,
      monthlyVisitDayRange: row.monthly_visit_day_range,
      dailyVisitCountRange: row.daily_visit_count_range,
      timeZoneCategory: row.time_zone_category,
      companionCategory: row.companion_category,
      maximumFrequencyType: row.maximum_frequency_type,
      maximumFrequencyCount: row.maximum_frequency_count,
      sourceNote: row.source_note
    }));
  }

  getEligibilityRules(): EligibilityRule[] {
    const rows = this.db.prepare("SELECT * FROM eligibility_rules ORDER BY id").all() as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id,
      ruleCode: row.rule_code,
      feeCode: row.fee_code,
      professionAllowList: JSON.parse(row.profession_allow_list_json || "[]"),
      requiredConditions: JSON.parse(row.required_conditions_json || "[]"),
      frequencyLimitType: row.frequency_limit_type,
      frequencyLimitCount: row.frequency_limit_count,
      warningMessage: row.warning_message,
      errorMessage: row.error_message,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to
    }));
  }

  getHighCostCareLimitRules(): HighCostCareLimitRule[] {
    const rows = this.db.prepare("SELECT * FROM high_cost_care_limit_rules WHERE enabled = 1 ORDER BY effective_from, category").all() as Array<Record<string, any>>;
    return rows.map((row) => ({
      id: row.id,
      ruleCode: row.rule_code,
      category: row.category,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to ?? undefined,
      fixedAmount: row.fixed_amount,
      medicalCostThreshold: row.medical_cost_threshold ?? undefined,
      excessRate: row.excess_rate,
      annualLimitAmount: row.annual_limit_amount ?? undefined,
      outpatientAnnualLimitAmount: row.outpatient_annual_limit_amount ?? undefined,
      versionLabel: row.version_label,
      sourceNote: row.source_note,
      sourceUrl: row.source_url,
      enabled: row.enabled === 1
    }));
  }

  getEstimate(id: number): MonthlyEstimate {
    const row = this.db.prepare("SELECT * FROM monthly_estimates WHERE id = ?").get(id) as Record<string, any> | undefined;
    if (!row) {
      throw new Error("入力データが見つかりません。");
    }
    const dailyVisits = this.db
      .prepare("SELECT * FROM daily_visits WHERE monthly_estimate_id = ? ORDER BY visit_date")
      .all(id)
      .map((visitRow) => this.mapDailyVisit(visitRow as Record<string, any>));

    return {
      id: row.id,
      patientName: row.patient_name,
      facilityName: row.facility_name,
      targetMonth: row.target_month,
      sameBuildingCategory: row.same_building_category,
      copaymentRate: row.copayment_rate,
      basicFeeType: row.basic_fee_type ?? "type_2",
      stationCategory: row.station_category ?? "standard",
      singleBuildingResidentCategory: row.single_building_resident_category ?? "under_20",
      specialManagementCategory: row.special_management_category ?? "none",
      dischargeJointGuidanceCountCategory: row.discharge_joint_guidance_count_category ?? "none",
      specialManagementGuidanceApplicable: row.special_management_guidance_applicable ?? "not_applicable",
      highCostCareLimitCategory: row.high_cost_care_limit_category ?? "unset",
      dailyVisits,
      updatedAt: row.updated_at
    };
  }

  private getDailyVisit(id: number): DailyVisit {
    const row = this.db.prepare("SELECT * FROM daily_visits WHERE id = ?").get(id) as Record<string, any> | undefined;
    if (!row) {
      throw new Error("訪問内容が見つかりません。");
    }
    return this.mapDailyVisit(row);
  }

  private upsertDailyVisit(monthlyEstimateId: number, visit: DailyVisitInput, timestamp: string): number {
    const normalized = DailyVisitCalculator.normalize(visit);
    const existing = this.db
      .prepare("SELECT id FROM daily_visits WHERE monthly_estimate_id = ? AND visit_date = ?")
      .get(monthlyEstimateId, visit.visitDate) as { id: number } | undefined;

    let dailyVisitId: number;
    if (existing) {
      dailyVisitId = existing.id;
      this.db
        .prepare(
          `UPDATE daily_visits SET
            basic_fee_applicable = ?, management_fee_applicable = ?, profession = ?, visit_count = ?,
            long_visit_type = ?, multiple_staff_type = ?, emergency_type = ?, special_management_type = ?,
            discharge_joint_guidance_type = ?, discharge_support_guidance_type = ?,
            time_visit_requested_by_patient_or_family = ?, multiple_visit_eligibility_type = ?,
            multiple_staff_category = ?, single_person_visit_difficult = ?, multiple_staff_consent = ?,
            simultaneous_multiple_staff_visit = ?, long_visit_eligibility_type = ?, emergency_unplanned = ?,
            emergency_requested_by_patient_or_family = ?, emergency_physician_instruction = ?,
            discharge_support_guidance_category = ?, discharge_support_total_minutes = ?, first_visit_after_discharge = ?,
            warnings_json = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          visit.basicFeeApplicable,
          visit.managementFeeApplicable,
          visit.profession,
          visit.visitCount,
          visit.longVisitType,
          visit.multipleStaffType,
          visit.emergencyType,
          visit.specialManagementType,
          visit.dischargeJointGuidanceType,
          visit.dischargeSupportGuidanceType,
          visit.timeVisitRequestedByPatientOrFamily,
          visit.multipleVisitEligibilityType,
          visit.multipleStaffCategory,
          visit.singlePersonVisitDifficult,
          visit.multipleStaffConsent,
          visit.simultaneousMultipleStaffVisit,
          visit.longVisitEligibilityType,
          visit.emergencyUnplanned,
          visit.emergencyRequestedByPatientOrFamily,
          visit.emergencyPhysicianInstruction,
          visit.dischargeSupportGuidanceCategory,
          visit.dischargeSupportTotalMinutes,
          visit.firstVisitAfterDischarge,
          JSON.stringify(normalized.warnings),
          timestamp,
          dailyVisitId
        );
      this.db.prepare("DELETE FROM visit_time_slots WHERE daily_visit_id = ?").run(dailyVisitId);
    } else {
      const result = this.db
        .prepare(
          `INSERT INTO daily_visits (
            monthly_estimate_id, visit_date, basic_fee_applicable, management_fee_applicable, profession,
            visit_count, long_visit_type, multiple_staff_type, emergency_type, special_management_type,
            discharge_joint_guidance_type, discharge_support_guidance_type,
            time_visit_requested_by_patient_or_family, multiple_visit_eligibility_type,
            multiple_staff_category, single_person_visit_difficult, multiple_staff_consent,
            simultaneous_multiple_staff_visit, long_visit_eligibility_type, emergency_unplanned,
            emergency_requested_by_patient_or_family, emergency_physician_instruction,
            discharge_support_guidance_category, discharge_support_total_minutes, first_visit_after_discharge,
            warnings_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          monthlyEstimateId,
          visit.visitDate,
          visit.basicFeeApplicable,
          visit.managementFeeApplicable,
          visit.profession,
          visit.visitCount,
          visit.longVisitType,
          visit.multipleStaffType,
          visit.emergencyType,
          visit.specialManagementType,
          visit.dischargeJointGuidanceType,
          visit.dischargeSupportGuidanceType,
          visit.timeVisitRequestedByPatientOrFamily,
          visit.multipleVisitEligibilityType,
          visit.multipleStaffCategory,
          visit.singlePersonVisitDifficult,
          visit.multipleStaffConsent,
          visit.simultaneousMultipleStaffVisit,
          visit.longVisitEligibilityType,
          visit.emergencyUnplanned,
          visit.emergencyRequestedByPatientOrFamily,
          visit.emergencyPhysicianInstruction,
          visit.dischargeSupportGuidanceCategory,
          visit.dischargeSupportTotalMinutes,
          visit.firstVisitAfterDischarge,
          JSON.stringify(normalized.warnings),
          timestamp,
          timestamp
        );
      dailyVisitId = Number(result.lastInsertRowid);
    }

    const insertSlot = this.db.prepare(
      `INSERT INTO visit_time_slots
      (daily_visit_id, sequence, start_time, end_time, end_day_type, duration_minutes, time_zone_type, time_zone_breakdown_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const slot of normalized.slots) {
      insertSlot.run(
        dailyVisitId,
        slot.sequence,
        slot.startTime,
        slot.endTime,
        slot.endDayType,
        slot.durationMinutes,
        slot.timeZoneType,
        JSON.stringify(slot.timeZoneBreakdown)
      );
    }

    return dailyVisitId;
  }

  private mapDailyVisit(row: Record<string, any>): DailyVisit {
    const slots = this.db
      .prepare("SELECT * FROM visit_time_slots WHERE daily_visit_id = ? ORDER BY sequence")
      .all(row.id)
      .map((slotRow) => this.mapSlot(slotRow as Record<string, any>));

    return {
      id: row.id,
      visitDate: row.visit_date,
      basicFeeApplicable: row.basic_fee_applicable,
      managementFeeApplicable: row.management_fee_applicable,
      profession: row.profession,
      visitCount: row.visit_count,
      longVisitType: row.long_visit_type,
      multipleStaffType: row.multiple_staff_type,
      emergencyType: row.emergency_type,
      specialManagementType: row.special_management_type,
      dischargeJointGuidanceType: row.discharge_joint_guidance_type,
      dischargeSupportGuidanceType: row.discharge_support_guidance_type,
      timeVisitRequestedByPatientOrFamily: row.time_visit_requested_by_patient_or_family ?? "not_applicable",
      multipleVisitEligibilityType: row.multiple_visit_eligibility_type ?? "none",
      multipleStaffCategory: row.multiple_staff_category ?? "none",
      singlePersonVisitDifficult: row.single_person_visit_difficult ?? "not_applicable",
      multipleStaffConsent: row.multiple_staff_consent ?? "not_applicable",
      simultaneousMultipleStaffVisit: row.simultaneous_multiple_staff_visit ?? "not_applicable",
      longVisitEligibilityType: row.long_visit_eligibility_type ?? "none",
      emergencyUnplanned: row.emergency_unplanned ?? "not_applicable",
      emergencyRequestedByPatientOrFamily: row.emergency_requested_by_patient_or_family ?? "not_applicable",
      emergencyPhysicianInstruction: row.emergency_physician_instruction ?? "not_applicable",
      dischargeSupportGuidanceCategory: row.discharge_support_guidance_category ?? "none",
      dischargeSupportTotalMinutes: row.discharge_support_total_minutes ?? 0,
      firstVisitAfterDischarge: row.first_visit_after_discharge ?? "not_applicable",
      timeSlots: slots,
      warnings: JSON.parse(row.warnings_json || "[]")
    };
  }

  private mapSlot(row: Record<string, any>): VisitTimeSlot {
    return {
      id: row.id,
      sequence: row.sequence,
      startTime: row.start_time,
      endTime: row.end_time,
      endDayType: row.end_day_type,
      durationMinutes: row.duration_minutes,
      timeZoneType: row.time_zone_type,
      timeZoneBreakdown: JSON.parse(row.time_zone_breakdown_json)
    };
  }

  private assertEstimateCanAcceptVisits(monthlyEstimateId: number): void {
    const row = this.db.prepare("SELECT patient_name, target_month FROM monthly_estimates WHERE id = ?").get(monthlyEstimateId) as
      | { patient_name: string; target_month: string }
      | undefined;
    if (!row) {
      throw new Error("入力データが見つかりません。");
    }
    if (!row.patient_name.trim()) {
      throw new Error("利用者名を入力してください。");
    }
    if (!row.target_month) {
      throw new Error("対象年月を選択してください。");
    }
  }

  private touchEstimate(id: number): void {
    this.db.prepare("UPDATE monthly_estimates SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  }
}
