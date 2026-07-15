import type {
  CareCalculationLine,
  CareCalculationResult,
  CareEstimate,
  CarePricingRule,
  CareProfession,
  CareServiceEntry,
  CopaymentRate
} from "../../shared/types";
import { isRehab } from "./CareDailyServiceCalculator";
import { CarePricingRuleResolver } from "./CarePricingRuleResolver";
import { TimeZoneClassifier } from "./TimeZoneClassifier";

const SOURCE = "厚生労働省 令和6年度介護報酬改定・令和8年度介護報酬改定";

export class CareMonthlyEstimateCalculator {
  private readonly resolver: CarePricingRuleResolver;

  constructor(rules: CarePricingRule[]) {
    this.resolver = new CarePricingRuleResolver(rules);
  }

  calculate(estimate: CareEstimate, regionalUnitPrice: number): CareCalculationResult {
    if (!estimate.patientName.trim()) throw new Error("利用者名を入力してください。");
    const targetDate = `${estimate.targetMonth}-01`;
    const lines: CareCalculationLine[] = [];
    const warnings: string[] = [
      "区分支給限度基準額、他の介護サービス、高額介護サービス費、公費・生活保護、医療介護合算は計算していません。",
      "特別訪問看護指示書や対象疾病等により医療保険が優先される場合があります。"
    ];
    const serviceDays = estimate.serviceDays.filter((day) => day.visitDate.startsWith(`${estimate.targetMonth}-`));

    for (const day of serviceDays) {
      const rehabCount = day.services.filter((service) => isRehab(service.profession)).reduce((sum, service) => sum + Math.floor(service.durationMinutes / 20), 0);
      for (const service of day.services) {
        this.addServiceLines(lines, warnings, estimate, day.visitDate, service, rehabCount, serviceDays, regionalUnitPrice);
        warnings.push(...service.warnings.map((warning) => `${formatDate(day.visitDate)} ${warning}`));
      }
    }

    this.addMonthlyAddition(lines, estimate.initialAddition === "type_1" ? "INITIAL_1" : estimate.initialAddition === "type_2" ? "INITIAL_2" : undefined, targetDate, regionalUnitPrice);
    this.addMonthlyAddition(lines, estimate.emergencyAddition === "type_1" ? "EMERGENCY_1" : estimate.emergencyAddition === "type_2" ? "EMERGENCY_2" : undefined, targetDate, regionalUnitPrice);
    this.addMonthlyAddition(
      lines,
      estimate.specialManagementAddition === "type_1" ? "SPECIAL_MANAGEMENT_1" : estimate.specialManagementAddition === "type_2" ? "SPECIAL_MANAGEMENT_2" : undefined,
      targetDate,
      regionalUnitPrice
    );
    if (estimate.dischargeJointGuidance) this.addMonthlyAddition(lines, "DISCHARGE_JOINT", targetDate, regionalUnitPrice);
    if (estimate.terminalCare) this.addMonthlyAddition(lines, "TERMINAL_CARE", targetDate, regionalUnitPrice);

    const basicUnits = sumCategory(lines, "basic");
    let additionUnits = sumCategory(lines, "addition");
    const deductionUnits = Math.abs(sumCategory(lines, "deduction"));
    let totalUnits = basicUnits + additionUnits - deductionUnits;

    if (estimate.treatmentImprovement) {
      const rule = this.resolver.resolveCode("TREATMENT_IMPROVEMENT", targetDate);
      if (!rule) {
        warnings.push("対象年月では介護職員等処遇改善加算を算定できません。2026年6月以降の届出事業所が対象です。");
      } else {
        const units = Math.round(totalUnits * ((rule.percentage ?? 0) / 100));
        lines.push(lineFromUnits(rule.name, "addition", "加減算後の総単位数×1.8%", [], 1, units, regionalUnitPrice, rule.sourceNote));
        additionUnits += units;
        totalUnits += units;
      }
    }

    const grandTotal = Math.floor(totalUnits * regionalUnitPrice);
    return {
      insuranceType: "care",
      targetMonth: estimate.targetMonth,
      lines,
      totals: {
        basicUnits,
        additionUnits,
        deductionUnits,
        totalUnits,
        regionalUnitPrice,
        grandTotal,
        copaymentAmount: calculateCopayment(grandTotal, estimate.copaymentRate)
      },
      warnings: Array.from(new Set(warnings)),
      usesSamplePricing: false
    };
  }

  private addServiceLines(
    lines: CareCalculationLine[],
    warnings: string[],
    estimate: CareEstimate,
    visitDate: string,
    service: CareServiceEntry,
    rehabCount: number,
    allDays: CareEstimate["serviceDays"],
    regionalUnitPrice: number
  ): void {
    const rehab = isRehab(service.profession);
    const quantity = rehab ? Math.floor(service.durationMinutes / 20) : 1;
    if (quantity < 1) return;

    if (!rehab && service.serviceCategory === "under_20" && !hasEligibleTwentyMinuteVisit(visitDate, allDays)) {
      const message = "同じ週に20分以上の日中の看護職訪問がないため、20分未満の訪問を合計に含めません。";
      warnings.push(`${formatDate(visitDate)} ${message}`);
      lines.push({
        category: "basic", serviceName: "訪問看護費（20分未満）", conditionSummary: professionLabel(service.profession),
        targetDates: [visitDate], quantity: 1, unitCount: 0, subtotalUnits: 0, regionalUnitPrice, amount: 0,
        includedInTotal: false, warning: message, evidence: SOURCE
      });
      return;
    }

    const rule = this.resolver.resolveBase({
      targetDate: visitDate,
      careClassification: estimate.careClassification,
      professionCategory: rehab ? "rehab" : "nurse",
      serviceCategory: service.serviceCategory
    });
    let currentUnits = rule.unitCount * quantity;
    lines.push(lineFromUnits(rule.name, "basic", `${professionLabel(service.profession)}・${service.durationMinutes}分`, [visitDate], quantity, currentUnits, regionalUnitPrice, rule.sourceNote, rule.unitCount));

    if (service.profession === "assistant_nurse") {
      currentUnits = this.addModifier(lines, "准看護師による訪問（90%算定）", currentUnits, Math.round(currentUnits * 0.9), visitDate, regionalUnitPrice, "准看護師は所定単位数の90%を算定");
    }
    if (rehab && rehabCount > 2) {
      currentUnits = this.addModifier(lines, "理学療法士等の1日3回以上訪問（90%算定）", currentUnits, Math.round(currentUnits * 0.9), visitDate, regionalUnitPrice, `当日${rehabCount}回`);
    }
    if (rehab && estimate.rehabFacilityReduction) {
      currentUnits = this.addFlatDeduction(lines, "理学療法士等の事業所要件減算", currentUnits, 8 * quantity, visitDate, regionalUnitPrice, "1回につき8単位減算");
    }
    if (rehab && estimate.careClassification === "support" && estimate.rehabOver12Months) {
      const perVisit = estimate.rehabFacilityReduction ? 15 : 5;
      currentUnits = this.addFlatDeduction(lines, "利用開始12か月超の介護予防訪問看護減算", currentUnits, perVisit * quantity, visitDate, regionalUnitPrice, `1回につき${perVisit}単位減算`);
    }

    const buildingRate = sameBuildingRate(estimate.sameBuildingCategory);
    if (buildingRate < 1) {
      currentUnits = this.addModifier(lines, `同一建物減算（${Math.round((1 - buildingRate) * 100)}%）`, currentUnits, Math.round(currentUnits * buildingRate), visitDate, regionalUnitPrice, "選択された同一建物区分を適用");
    }

    const startZone = TimeZoneClassifier.zoneAt(service.startTime);
    const emergencyOrdinal = countEmergencyBefore(allDays, visitDate, service.id);
    const timeAdditionAllowed = !service.unplannedEmergency || (estimate.specialManagementAddition !== "none" && emergencyOrdinal >= 2);
    if ((startZone === "early_morning" || startZone === "night") && timeAdditionAllowed) {
      this.addPercentageAddition(lines, "夜間・早朝訪問看護加算", currentUnits, 25, visitDate, regionalUnitPrice, `開始時刻${service.startTime}`);
    } else if (startZone === "midnight" && timeAdditionAllowed) {
      this.addPercentageAddition(lines, "深夜訪問看護加算", currentUnits, 50, visitDate, regionalUnitPrice, `開始時刻${service.startTime}`);
    } else if (!timeAdditionAllowed && startZone !== "daytime") {
      warnings.push(`${formatDate(visitDate)} 初回の計画外緊急訪問は夜間・早朝・深夜加算の対象外です。`);
    }

    if (!rehab && service.durationMinutes >= 90) {
      if (estimate.specialManagementAddition === "none") {
        warnings.push(`${formatDate(visitDate)} 90分以上の訪問ですが、特別管理加算が未選択のため長時間訪問看護加算を含めません。`);
      } else {
        const longRule = this.resolver.resolveCode("LONG_VISIT", visitDate);
        if (longRule) lines.push(lineFromUnits(longRule.name, "addition", "90分以上・特別管理加算対象", [visitDate], 1, longRule.unitCount, regionalUnitPrice, longRule.sourceNote));
      }
    }
  }

  private addModifier(lines: CareCalculationLine[], name: string, before: number, after: number, date: string, rate: number, note: string): number {
    const difference = after - before;
    if (difference !== 0) lines.push(lineFromUnits(name, difference < 0 ? "deduction" : "addition", note, [date], 1, difference, rate, SOURCE));
    return after;
  }

  private addFlatDeduction(lines: CareCalculationLine[], name: string, before: number, deduction: number, date: string, rate: number, note: string): number {
    lines.push(lineFromUnits(name, "deduction", note, [date], 1, -deduction, rate, SOURCE));
    return before - deduction;
  }

  private addPercentageAddition(lines: CareCalculationLine[], name: string, base: number, percent: number, date: string, rate: number, note: string): void {
    const units = Math.round(base * (percent / 100));
    lines.push(lineFromUnits(name, "addition", note, [date], 1, units, rate, SOURCE));
  }

  private addMonthlyAddition(lines: CareCalculationLine[], code: string | undefined, targetDate: string, rate: number): void {
    if (!code) return;
    const rule = this.resolver.resolveCode(code, targetDate);
    if (rule) lines.push(lineFromUnits(rule.name, "addition", "月1回", [], 1, rule.unitCount, rate, rule.sourceNote));
  }
}

function lineFromUnits(
  serviceName: string,
  category: CareCalculationLine["category"],
  conditionSummary: string,
  targetDates: string[],
  quantity: number,
  subtotalUnits: number,
  regionalUnitPrice: number,
  evidence: string,
  unitCount = Math.abs(subtotalUnits)
): CareCalculationLine {
  return {
    category, serviceName, conditionSummary, targetDates, quantity, unitCount, subtotalUnits, regionalUnitPrice,
    amount: signedFloor(subtotalUnits * regionalUnitPrice), includedInTotal: true, evidence
  };
}

function signedFloor(value: number): number {
  return value < 0 ? -Math.floor(Math.abs(value)) : Math.floor(value);
}

function sumCategory(lines: CareCalculationLine[], category: CareCalculationLine["category"]): number {
  return lines.filter((line) => line.category === category && line.includedInTotal).reduce((sum, line) => sum + line.subtotalUnits, 0);
}

function calculateCopayment(total: number, rate: CopaymentRate): number | undefined {
  if (rate === "unset") return undefined;
  const burden = Number(rate) / 100;
  return total - Math.floor(total * (1 - burden));
}

function sameBuildingRate(category: CareEstimate["sameBuildingCategory"]): number {
  if (category === "same_adjacent_50_plus") return 0.85;
  if (category === "same_adjacent_under_50" || category === "other_building_20_plus") return 0.9;
  return 1;
}

function hasEligibleTwentyMinuteVisit(date: string, days: CareEstimate["serviceDays"]): boolean {
  const start = weekStart(date);
  const end = addDays(start, 6);
  return days.some(
    (day) =>
      day.visitDate >= start && day.visitDate <= end &&
      day.services.some((service) => !isRehab(service.profession) && service.durationMinutes >= 20 && TimeZoneClassifier.zoneAt(service.startTime) === "daytime")
  );
}

function countEmergencyBefore(days: CareEstimate["serviceDays"], targetDate: string, serviceId: number): number {
  return days
    .flatMap((day) => day.services.map((service) => ({ date: day.visitDate, service })))
    .filter((item) => item.service.unplannedEmergency && (item.date < targetDate || (item.date === targetDate && item.service.id <= serviceId))).length;
}

function weekStart(date: string): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - value.getDay());
  return localDate(value);
}

function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + count);
  return localDate(value);
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function professionLabel(profession: CareProfession): string {
  const labels: Record<CareProfession, string> = {
    public_health_nurse: "保健師", nurse: "看護師", assistant_nurse: "准看護師",
    physical_therapist: "理学療法士", occupational_therapist: "作業療法士", speech_therapist: "言語聴覚士"
  };
  return labels[profession];
}

function formatDate(date: string): string {
  return `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;
}
