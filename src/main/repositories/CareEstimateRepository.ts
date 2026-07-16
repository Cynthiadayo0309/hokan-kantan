import type Database from "better-sqlite3";
import type {
  CareEstimate,
  CareEstimateInput,
  CarePricingRule,
  CareRegionalGrade,
  CareServiceDayInput,
  CareServiceDay,
  CareServiceEntry,
  CareServiceEntryInput
} from "../../shared/types";
import { CareDailyServiceCalculator } from "../services/CareDailyServiceCalculator";

export class CareEstimateRepository {
  constructor(private readonly db: Database.Database) {}

  getOrCreateCurrentEstimate(): CareEstimate {
    const existing = this.db.prepare("SELECT id FROM care_monthly_estimates ORDER BY updated_at DESC LIMIT 1").get() as { id: number } | undefined;
    if (existing) return this.getEstimate(existing.id);

    const now = new Date();
    const targetMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const timestamp = new Date().toISOString();
    const result = this.db
      .prepare(`INSERT INTO care_monthly_estimates (target_month, created_at, updated_at) VALUES (?, ?, ?)`) 
      .run(targetMonth, timestamp, timestamp);
    return this.getEstimate(Number(result.lastInsertRowid));
  }

  saveEstimate(input: CareEstimateInput): CareEstimate {
    this.validateEstimate(input);
    const timestamp = new Date().toISOString();
    if (input.id) {
      this.db.prepare(`
        UPDATE care_monthly_estimates SET
          patient_name = ?, facility_name = ?, target_month = ?, care_classification = ?, copayment_rate = ?,
          regional_grade = ?, same_building_category = ?, initial_addition = ?, emergency_addition = ?,
          special_management_addition = ?, discharge_joint_guidance = ?, terminal_care = ?, treatment_improvement = ?,
          rehab_over_12_months = ?, rehab_facility_reduction = ?, updated_at = ?
        WHERE id = ?
      `).run(
        input.patientName.trim(), input.facilityName.trim(), input.targetMonth, input.careClassification, input.copaymentRate,
        input.regionalGrade, input.sameBuildingCategory, input.initialAddition, input.emergencyAddition,
        input.specialManagementAddition, bool(input.dischargeJointGuidance), bool(input.terminalCare), bool(input.treatmentImprovement),
        bool(input.rehabOver12Months), bool(input.rehabFacilityReduction), timestamp, input.id
      );
      return this.getEstimate(input.id);
    }

    const result = this.db.prepare(`
      INSERT INTO care_monthly_estimates (
        patient_name, facility_name, target_month, care_classification, copayment_rate, regional_grade,
        same_building_category, initial_addition, emergency_addition, special_management_addition,
        discharge_joint_guidance, terminal_care, treatment_improvement, rehab_over_12_months,
        rehab_facility_reduction, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.patientName.trim(), input.facilityName.trim(), input.targetMonth, input.careClassification, input.copaymentRate,
      input.regionalGrade, input.sameBuildingCategory, input.initialAddition, input.emergencyAddition,
      input.specialManagementAddition, bool(input.dischargeJointGuidance), bool(input.terminalCare), bool(input.treatmentImprovement),
      bool(input.rehabOver12Months), bool(input.rehabFacilityReduction), timestamp, timestamp
    );
    return this.getEstimate(Number(result.lastInsertRowid));
  }

  saveDay(careEstimateId: number, visitDate: string, services: CareServiceEntryInput[]): CareEstimate {
    return this.saveDays(careEstimateId, [{ visitDate, services }]);
  }

  saveDays(careEstimateId: number, days: CareServiceDayInput[]): CareEstimate {
    const estimate = this.getEstimate(careEstimateId);
    if (!estimate.patientName.trim()) throw new Error("利用者名を入力してください。");
    const normalizedDays = normalizeCareServiceDays(estimate.targetMonth, days);
    const timestamp = new Date().toISOString();
    const transaction = this.db.transaction(() => {
      const remove = this.db.prepare("DELETE FROM care_service_entries WHERE care_monthly_estimate_id = ? AND visit_date = ?");
      const insert = this.db.prepare(`
        INSERT INTO care_service_entries (
          care_monthly_estimate_id, visit_date, sequence, profession, start_time, end_time, end_day_type,
          unplanned_emergency, duration_minutes, service_category, time_zone_type, time_zone_breakdown_json,
          warnings_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      normalizedDays.forEach((day) => {
        remove.run(careEstimateId, day.visitDate);
        day.services.forEach((service) => {
          insert.run(
            careEstimateId, day.visitDate, service.sequence, service.profession, service.startTime, service.endTime,
            service.endDayType, bool(service.unplannedEmergency), service.durationMinutes, service.serviceCategory,
            service.timeZoneType, JSON.stringify(service.timeZoneBreakdown), JSON.stringify(service.warnings), timestamp, timestamp
          );
        });
      });
      this.touch(careEstimateId);
    });
    transaction();
    return this.getEstimate(careEstimateId);
  }

  deleteDay(careEstimateId: number, visitDate: string): CareEstimate {
    this.db.prepare("DELETE FROM care_service_entries WHERE care_monthly_estimate_id = ? AND visit_date = ?").run(careEstimateId, visitDate);
    this.touch(careEstimateId);
    return this.getEstimate(careEstimateId);
  }

  resetEstimate(careEstimateId: number): CareEstimate {
    this.db.prepare("DELETE FROM care_service_entries WHERE care_monthly_estimate_id = ?").run(careEstimateId);
    this.touch(careEstimateId);
    return this.getEstimate(careEstimateId);
  }

  getEstimate(id: number): CareEstimate {
    const row = this.db.prepare("SELECT * FROM care_monthly_estimates WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) throw new Error("介護保険の入力データが見つかりません。");
    const serviceRows = this.db
      .prepare("SELECT * FROM care_service_entries WHERE care_monthly_estimate_id = ? ORDER BY visit_date, sequence")
      .all(id) as Array<Record<string, unknown>>;
    const dayMap = new Map<string, CareServiceEntry[]>();
    for (const serviceRow of serviceRows) {
      const service = this.mapService(serviceRow);
      const visitDate = String(serviceRow.visit_date);
      const list = dayMap.get(visitDate) ?? [];
      list.push(service);
      dayMap.set(visitDate, list);
    }
    const serviceDays: CareServiceDay[] = Array.from(dayMap, ([visitDate, services]) => ({ visitDate, services }));

    return {
      id: Number(row.id),
      patientName: String(row.patient_name),
      facilityName: String(row.facility_name),
      targetMonth: String(row.target_month),
      careClassification: row.care_classification as CareEstimate["careClassification"],
      copaymentRate: row.copayment_rate as CareEstimate["copaymentRate"],
      regionalGrade: row.regional_grade as CareEstimate["regionalGrade"],
      sameBuildingCategory: row.same_building_category as CareEstimate["sameBuildingCategory"],
      initialAddition: row.initial_addition as CareEstimate["initialAddition"],
      emergencyAddition: row.emergency_addition as CareEstimate["emergencyAddition"],
      specialManagementAddition: row.special_management_addition as CareEstimate["specialManagementAddition"],
      dischargeJointGuidance: Boolean(row.discharge_joint_guidance),
      terminalCare: Boolean(row.terminal_care),
      treatmentImprovement: Boolean(row.treatment_improvement),
      rehabOver12Months: Boolean(row.rehab_over_12_months),
      rehabFacilityReduction: Boolean(row.rehab_facility_reduction),
      serviceDays,
      updatedAt: String(row.updated_at)
    };
  }

  getPricingRules(): CarePricingRule[] {
    const rows = this.db.prepare("SELECT * FROM care_pricing_rules WHERE enabled = 1 ORDER BY id").all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: Number(row.id), code: String(row.code), name: String(row.name), category: row.category as CarePricingRule["category"],
      effectiveFrom: String(row.effective_from), effectiveTo: row.effective_to ? String(row.effective_to) : null,
      careClassification: row.care_classification as CarePricingRule["careClassification"],
      professionCategory: row.profession_category as CarePricingRule["professionCategory"],
      serviceCategory: row.service_category as CarePricingRule["serviceCategory"], unitCount: Number(row.unit_count),
      percentage: row.percentage === null ? null : Number(row.percentage), sourceNote: String(row.source_note)
    }));
  }

  getRegionalRate(grade: CareRegionalGrade, targetDate: string): number {
    const row = this.db.prepare(`
      SELECT unit_price FROM care_regional_rates
      WHERE grade = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC LIMIT 1
    `).get(grade, targetDate, targetDate) as { unit_price: number } | undefined;
    if (!row) throw new Error("地域区分に一致する単価が見つかりません。料金マスターを確認してください。");
    return Number(row.unit_price);
  }

  private mapService(row: Record<string, unknown>): CareServiceEntry {
    return {
      id: Number(row.id), sequence: Number(row.sequence), profession: row.profession as CareServiceEntry["profession"],
      startTime: String(row.start_time), endTime: String(row.end_time), endDayType: row.end_day_type as CareServiceEntry["endDayType"],
      unplannedEmergency: Boolean(row.unplanned_emergency), durationMinutes: Number(row.duration_minutes),
      serviceCategory: row.service_category as CareServiceEntry["serviceCategory"], timeZoneType: row.time_zone_type as CareServiceEntry["timeZoneType"],
      timeZoneBreakdown: JSON.parse(String(row.time_zone_breakdown_json)), warnings: JSON.parse(String(row.warnings_json))
    };
  }

  private validateEstimate(input: CareEstimateInput): void {
    validateCareEstimateInput(input);
  }

  private touch(id: number): void {
    this.db.prepare("UPDATE care_monthly_estimates SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  }
}

export function validateCareEstimateInput(input: CareEstimateInput): void {
  if (!input || !/^\d{4}-\d{2}$/.test(input.targetMonth)) throw new Error("対象年月を選択してください。");
  if (input.initialAddition !== "none" && input.dischargeJointGuidance) {
    throw new Error("初回加算と退院時共同指導加算は同時に選択できません。");
  }
}

export function normalizeCareServiceDays(targetMonth: string, days: CareServiceDayInput[]) {
  if (!Array.isArray(days) || days.length < 1 || days.length > 31) {
    throw new Error("一度に保存できる日数は1日から31日までです。");
  }
  const visitDates = days.map((day) => day.visitDate);
  if (new Set(visitDates).size !== visitDates.length) {
    throw new Error("同じ日付が複数含まれています。");
  }
  return days.map((day) => {
    if (!isValidDateKey(day.visitDate) || !day.visitDate.startsWith(`${targetMonth}-`)) {
      throw new Error("訪問日は対象年月の日付を選択してください。");
    }
    return { visitDate: day.visitDate, services: CareDailyServiceCalculator.normalize(day.services) };
  });
}

function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function bool(value: boolean): number {
  return value ? 1 : 0;
}
