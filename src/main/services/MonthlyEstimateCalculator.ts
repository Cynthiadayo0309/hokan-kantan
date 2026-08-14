import type {
  AdditionType,
  CalculationLine,
  CalculationTotals,
  DailyVisit,
  HighCostCareLimitRule,
  MonthlyCalculationPeriodResult,
  MonthlyCalculationResult,
  MonthlyEstimate,
  PricingCategory,
  PricingRule,
  UnitType
} from "../../shared/types";
import { labels } from "../../shared/types";
import { calculateCopayment } from "./CopaymentCalculator";
import { EligibilityEvaluator, professionCategoryFor } from "./EligibilityEvaluator";
import { HIGH_COST_CARE_SCOPE_NOTICE, calculateHighCostCareLimit, shouldShowAnnualLimitNotice } from "./HighCostCareLimitCalculator";
import { PricingRuleResolver } from "./PricingRuleResolver";
import { countEligibleBeforeOrOn, monthlyVisitDayOrdinal, weeklyEligibleOrdinal, weeklyVisitDayOrdinal } from "./VisitDayCounters";

export class MonthlyEstimateCalculator {
  constructor(
    private readonly rules: PricingRule[],
    private readonly highCostCareLimitRules: HighCostCareLimitRule[] = []
  ) {}

  calculate(estimate: MonthlyEstimate, period?: { startDate?: string; endDate?: string }): MonthlyCalculationResult {
    const defaultStart = `${estimate.targetMonth}-01`;
    const defaultEnd = endOfMonth(estimate.targetMonth);
    const periodStartDate = period?.startDate ?? defaultStart;
    const periodEndDate = period?.endDate ?? defaultEnd;
    const months = monthsBetween(periodStartDate, periodEndDate);

    if (months.length <= 1) {
      const targetMonth = months[0] ?? estimate.targetMonth;
      return this.calculateSingleMonth(cloneEstimateForMonth(estimate, targetMonth, periodStartDate, periodEndDate), periodStartDate, periodEndDate);
    }

    const monthlyResults = months.map((targetMonth) => {
      const monthStart = targetMonth === months[0] ? periodStartDate : `${targetMonth}-01`;
      const monthEnd = targetMonth === months[months.length - 1] ? periodEndDate : endOfMonth(targetMonth);
      return this.calculateSingleMonth(cloneEstimateForMonth(estimate, targetMonth, monthStart, monthEnd), monthStart, monthEnd);
    });
    const rangeTotal = sumTotals(monthlyResults.map((result) => result.totals));

    return {
      insuranceType: "medical",
      periodStartDate,
      periodEndDate,
      targetMonth: estimate.targetMonth,
      lines: monthlyResults.flatMap((result) => result.lines),
      totals: rangeTotal,
      warnings: Array.from(new Set(monthlyResults.flatMap((result) => result.warnings))),
      usesSamplePricing: monthlyResults.some((result) => result.usesSamplePricing),
      highCostCareLimitRuleLabel: Array.from(
        new Set(monthlyResults.map((result) => result.highCostCareLimitRuleLabel).filter((label): label is string => Boolean(label)))
      ).join(" / ") || undefined,
      monthlyResults,
      rangeTotal
    };
  }

  private calculateSingleMonth(estimate: MonthlyEstimate, periodStartDate: string, periodEndDate: string): MonthlyCalculationPeriodResult {
    const resolver = new PricingRuleResolver(this.rules);
    const lines: CalculationLine[] = [];
    const warnings: string[] = [];
    const formalRules = this.rules.filter((rule) => rule.enabled && !rule.samplePrice);
    const usesSamplePricing = formalRules.length === 0 && this.rules.some((rule) => rule.enabled && rule.samplePrice);
    const visits = [...estimate.dailyVisits]
      .filter((visit) => visit.visitDate >= periodStartDate && visit.visitDate <= periodEndDate && visit.visitDate.startsWith(`${estimate.targetMonth}-`))
      .sort((a, b) => a.visitDate.localeCompare(b.visitDate));

    for (const visit of visits) {
      if (visit.basicFeeApplicable === "applicable") {
        this.addBasicLine(lines, warnings, resolver, estimate, visits, visit);
      }
      if (visit.managementFeeApplicable === "applicable") {
        this.addManagementLine(lines, warnings, resolver, estimate, visits, visit);
      }
      this.addTimeAdditionLines(lines, warnings, resolver, estimate, visits, visit);
      this.addMultipleVisitLine(lines, warnings, resolver, estimate, visits, visit);
      this.addMultipleStaffLine(lines, warnings, resolver, estimate, visits, visit);
      this.addLongVisitLine(lines, warnings, resolver, estimate, visits, visit);
      this.addEmergencyLine(lines, warnings, resolver, estimate, visits, visit);
      this.addDischargeSupportLine(lines, warnings, resolver, visit);
      warnings.push(...visit.warnings);
    }

    this.addMonthlySpecialManagementLine(lines, warnings, resolver, estimate);
    this.addDischargeJointLine(lines, warnings, resolver, estimate, visits);

    const merged = this.mergeLines(lines);
    const included = merged.filter((line) => line.includedInTotal !== false);
    const basic = included.filter((line) => line.category === "basic").reduce((sum, line) => sum + line.subtotal, 0);
    const management = included.filter((line) => line.category === "management").reduce((sum, line) => sum + line.subtotal, 0);
    const additions = included.filter((line) => line.category === "addition").reduce((sum, line) => sum + line.subtotal, 0);
    const grandTotal = basic + management + additions;
    const copaymentAmountBeforeLimit = calculateCopayment(grandTotal, estimate.copaymentRate);
    const highCostLimit = calculateHighCostCareLimit(
      grandTotal,
      copaymentAmountBeforeLimit,
      estimate.highCostCareLimitCategory,
      estimate.targetMonth,
      this.highCostCareLimitRules
    );
    const copaymentAmount = highCostLimit.appliedAmount ?? copaymentAmountBeforeLimit;
    if (highCostLimit.warning) {
      warnings.push(highCostLimit.warning);
    }
    if (shouldShowAnnualLimitNotice(estimate.targetMonth, estimate.highCostCareLimitCategory)) {
      warnings.push(HIGH_COST_CARE_SCOPE_NOTICE);
    }

    return {
      insuranceType: "medical",
      periodStartDate,
      periodEndDate,
      targetMonth: estimate.targetMonth,
      lines: merged,
      totals: {
        basic,
        management,
        additions,
        grandTotal,
        copaymentAmountBeforeLimit: estimate.highCostCareLimitCategory === "unset" ? undefined : copaymentAmountBeforeLimit,
        copaymentAmount,
        highCostCareLimitAmount: highCostLimit.limitAmount,
        highCostCareLimitApplied: highCostLimit.applied
      },
      warnings: Array.from(new Set(warnings)),
      usesSamplePricing,
      highCostCareLimitRuleLabel: highCostLimit.ruleLabel
    };
  }

  private addBasicLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    const eligibility = EligibilityEvaluator.canCalculateBasic(estimate);
    if (!eligibility.ok) {
      this.addExcludedLine(lines, warnings, "basic", "訪問看護基本療養費（Ⅱ）", visit.visitDate, eligibility.message ?? "算定対象外です。");
      return;
    }
    const professionCategory = professionCategoryFor(visit.profession);
    const weeklyDay = weeklyVisitDayOrdinal(visits, visit.visitDate, (item) => item.basicFeeApplicable === "applicable");
    const monthlyDay = monthlyVisitDayOrdinal(visits, visit.visitDate, (item) => item.basicFeeApplicable === "applicable");
    const resolved = resolver.resolve({
      category: "basic",
      feeCode: "basic_2",
      targetDate: visit.visitDate,
      professionCategory,
      basicFeeType: estimate.basicFeeType,
      sameBuildingDailyCountCategory: normalizeSameBuildingForFormal(estimate.sameBuildingCategory),
      weeklyVisitDay: weeklyDay,
      monthlyVisitDay: monthlyDay
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "basic",
      serviceName: "訪問看護基本療養費（Ⅱ）",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: `${labels.profession[visit.profession]} / ${labels.sameBuildingCategory[estimate.sameBuildingCategory]}`,
      evidence: `週${weeklyDay}日目、月${monthlyDay}日目。同日複数回でも基本療養費は1日1回。`
    });
  }

  private addManagementLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    const managementDay = monthlyVisitDayOrdinal(visits, visit.visitDate, (item) => item.managementFeeApplicable === "applicable");
    const feeCode = managementDay === 1 ? "management_first" : "management_later";
    const resolved = resolver.resolve({
      category: "management",
      feeCode,
      targetDate: visit.visitDate,
      stationCategory: managementDay === 1 ? estimate.stationCategory : undefined,
      singleBuildingResidentCategory: managementDay === 1 ? undefined : estimate.singleBuildingResidentCategory,
      monthlyVisitDay: managementDay
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "management",
      serviceName: managementDay === 1 ? "訪問看護管理療養費（当月初回）" : "訪問看護管理療養費（月2日目以降）",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary:
        managementDay === 1
          ? labels.stationCategory[estimate.stationCategory]
          : labels.singleBuildingResidentCategory[estimate.singleBuildingResidentCategory],
      evidence: `管理療養費算定日 ${managementDay}日目。`
    });
  }

  private addTimeAdditionLines(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    const zones = new Set(visit.timeSlots.flatMap((slot) => slot.timeZoneBreakdown.map((part) => part.zone)));
    if (!zones.has("night") && !zones.has("early_morning") && !zones.has("midnight")) return;
    if (!EligibilityEvaluator.canCalculateTimeAddition(visit)) {
      this.addExcludedLine(lines, warnings, "addition", "夜間・早朝・深夜訪問看護加算", visit.visitDate, "利用者・家族等の求めによる訪問ではないため算定しません。");
      return;
    }
    const monthlyDay = monthlyVisitDayOrdinal(visits, visit.visitDate);
    if (zones.has("night") || zones.has("early_morning")) {
      this.addAdditionByRule(lines, warnings, resolver, estimate, visit, "night_early", "night_or_early_morning", monthlyDay, "夜間・早朝訪問看護加算", `月${monthlyDay}日目。利用者・家族等の求めあり。`);
    }
    if (zones.has("midnight")) {
      this.addAdditionByRule(lines, warnings, resolver, estimate, visit, "midnight", "midnight", monthlyDay, "深夜訪問看護加算", `月${monthlyDay}日目。利用者・家族等の求めあり。`);
    }
  }

  private addMultipleVisitLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    if (visit.visitCount < 2) return;
    if (!EligibilityEvaluator.canCalculateMultipleVisit(visit)) {
      this.addExcludedLine(lines, warnings, "addition", "難病等複数回訪問加算", visit.visitDate, "対象疾病等または特別訪問看護指示書の要件が未選択のため算定しません。");
      return;
    }
    const monthlyDay = monthlyVisitDayOrdinal(visits, visit.visitDate);
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "multiple_visits",
      targetDate: visit.visitDate,
      additionType: "multiple_visits",
      sameBuildingDailyCountCategory: normalizeSameBuildingForFormal(estimate.sameBuildingCategory),
      dailyVisitCount: visit.visitCount,
      monthlyVisitDay: monthlyDay
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "難病等複数回訪問加算",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: `${labels.sameBuildingCategory[estimate.sameBuildingCategory]} / ${visit.visitCount}回`,
      evidence: `月${monthlyDay}日目。基本療養費は訪問回数分ではなく1日1回。`
    });
  }

  private addMultipleStaffLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    if (visit.multipleStaffCategory === "none") return;
    if (!EligibilityEvaluator.canCalculateMultipleStaff(visit)) {
      this.addExcludedLine(lines, warnings, "addition", "複数名訪問看護加算", visit.visitDate, "困難性、同意、同時訪問の確認が不足しているため算定しません。");
      return;
    }
    const weeklyCount = weeklyEligibleOrdinal(
      visits,
      visit.visitDate,
      (item) => item.multipleStaffCategory === visit.multipleStaffCategory && EligibilityEvaluator.canCalculateMultipleStaff(item)
    );
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "multiple_staff",
      targetDate: visit.visitDate,
      additionType: "multiple_staff",
      companionCategory: visit.multipleStaffCategory,
      sameBuildingDailyCountCategory: normalizeSameBuildingForFormal(estimate.sameBuildingCategory),
      dailyVisitCount: visit.visitCount
    });
    if (resolved.ok && resolved.rule.maximumFrequencyType === "weekly" && resolved.rule.maximumFrequencyCount && weeklyCount > resolved.rule.maximumFrequencyCount) {
      this.addExcludedLine(lines, warnings, "addition", resolved.rule.itemName, visit.visitDate, `週上限${resolved.rule.maximumFrequencyCount}日を超えるため算定しません。`);
      return;
    }
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "複数名訪問看護加算",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: `${labels.multipleStaffCategory[visit.multipleStaffCategory]} / ${labels.sameBuildingCategory[estimate.sameBuildingCategory]}`,
      evidence: `1人による訪問困難、同意、同時訪問を確認。週内対象${weeklyCount}日目。`
    });
  }

  private addLongVisitLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    if (visit.longVisitEligibilityType === "none" && visit.longVisitType !== "applicable") return;
    if (!EligibilityEvaluator.canCalculateLongVisit(visit)) {
      this.addExcludedLine(lines, warnings, "addition", "長時間訪問看護加算", visit.visitDate, "90分超かつ対象者要件ありの場合のみ算定します。");
      return;
    }
    const weeklyCount = weeklyEligibleOrdinal(visits, visit.visitDate, (item) => EligibilityEvaluator.canCalculateLongVisit(item));
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "long_visit",
      targetDate: visit.visitDate,
      additionType: "long_visit"
    });
    const max = visit.longVisitEligibilityType === "under_15_severe_child" || visit.longVisitEligibilityType === "appendix_8" ? 3 : 1;
    if (weeklyCount > max) {
      this.addExcludedLine(lines, warnings, "addition", "長時間訪問看護加算", visit.visitDate, `週上限${max}日を超えるため算定しません。`);
      return;
    }
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "長時間訪問看護加算",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: labels.longVisitEligibilityType[visit.longVisitEligibilityType],
      evidence: `1回の訪問が90分超。週内対象${weeklyCount}日目。`
    });
  }

  private addEmergencyLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[],
    visit: DailyVisit
  ): void {
    if (visit.emergencyType !== "applicable" && visit.emergencyUnplanned !== "applicable") return;
    if (!EligibilityEvaluator.canCalculateEmergency(visit)) {
      this.addExcludedLine(lines, warnings, "addition", "緊急訪問看護加算", visit.visitDate, "定期予定外、利用者・家族等からの求め、主治医の指示が必要です。");
      return;
    }
    const emergencyDay = countEligibleBeforeOrOn(visits, visit.visitDate, (item) => EligibilityEvaluator.canCalculateEmergency(item));
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "emergency",
      targetDate: visit.visitDate,
      additionType: "emergency",
      monthlyVisitDay: emergencyDay
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "緊急訪問看護加算",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: "定期予定外 / 求めあり / 主治医指示あり",
      evidence: `緊急訪問加算算定日 ${emergencyDay}日目。`
    });
  }

  private addDischargeSupportLine(lines: CalculationLine[], warnings: string[], resolver: PricingRuleResolver, visit: DailyVisit): void {
    if (visit.dischargeSupportGuidanceCategory === "none" && visit.dischargeSupportGuidanceType !== "applicable") return;
    const profession = EligibilityEvaluator.canCalculateDischargeForProfession(visit);
    if (!profession.ok) {
      this.addExcludedLine(lines, warnings, "addition", "退院支援指導加算", visit.visitDate, profession.message ?? "算定対象外です。");
      return;
    }
    const category = visit.dischargeSupportGuidanceCategory === "none" ? "normal" : visit.dischargeSupportGuidanceCategory;
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "discharge_support_guidance",
      targetDate: visit.visitDate,
      additionType: "discharge_support_guidance",
      dailyVisitCountCategory: category
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "退院支援指導加算",
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: labels.dischargeSupportGuidanceCategory[category],
      evidence: category === "long" ? "1回または複数回合計90分超の長時間指導。" : "退院支援指導。"
    });
  }

  private addMonthlySpecialManagementLine(lines: CalculationLine[], warnings: string[], resolver: PricingRuleResolver, estimate: MonthlyEstimate): void {
    if (estimate.specialManagementCategory === "none") return;
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "special_management",
      targetDate: `${estimate.targetMonth}-01`,
      additionType: "special_management",
      dailyVisitCountCategory: estimate.specialManagementCategory
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "特別管理加算",
      targetDate: `${estimate.targetMonth}-01`,
      quantity: 1,
      conditionSummary: labels.specialManagementCategory[estimate.specialManagementCategory],
      evidence: "月1回。同一区分を複数日に選択しても月1回として算定。"
    });
  }

  private addDischargeJointLine(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visits: DailyVisit[]
  ): void {
    if (estimate.dischargeJointGuidanceCountCategory === "none") return;
    const firstVisit = visits.find((visit) => visit.firstVisitAfterDischarge === "applicable") ?? visits[0];
    if (!firstVisit) {
      this.addExcludedLine(lines, warnings, "addition", "退院時共同指導加算", `${estimate.targetMonth}-01`, "訪問日がないため算定できません。");
      return;
    }
    const profession = EligibilityEvaluator.canCalculateDischargeForProfession(firstVisit);
    if (!profession.ok) {
      this.addExcludedLine(lines, warnings, "addition", "退院時共同指導加算", firstVisit.visitDate, profession.message ?? "算定対象外です。");
      return;
    }
    const quantity = estimate.dischargeJointGuidanceCountCategory === "two_times" ? 2 : 1;
    const resolved = resolver.resolve({
      category: "addition",
      feeCode: "discharge_joint_guidance",
      targetDate: firstVisit.visitDate,
      additionType: "discharge_joint_guidance"
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName: "退院時共同指導加算",
      targetDate: firstVisit.visitDate,
      quantity,
      conditionSummary: labels.dischargeJointGuidanceCountCategory[estimate.dischargeJointGuidanceCountCategory],
      evidence: "退院後初回訪問時に算定。准看護師は対象外。"
    });
    if (estimate.specialManagementGuidanceApplicable === "applicable") {
      const guidance = resolver.resolve({
        category: "addition",
        feeCode: "special_management_guidance",
        targetDate: firstVisit.visitDate,
        additionType: "special_management_guidance"
      });
      this.addResolvedLine(lines, warnings, guidance, {
        category: "addition",
        serviceName: "特別管理指導加算",
        targetDate: firstVisit.visitDate,
        quantity: 1,
        conditionSummary: "特別管理対象等",
        evidence: "退院時共同指導加算に追加。"
      });
    }
  }

  private addAdditionByRule(
    lines: CalculationLine[],
    warnings: string[],
    resolver: PricingRuleResolver,
    estimate: MonthlyEstimate,
    visit: DailyVisit,
    feeCode: string,
    additionType: AdditionType,
    monthlyDay: number,
    serviceName: string,
    evidence: string
  ): void {
    const resolved = resolver.resolve({
      category: "addition",
      feeCode,
      targetDate: visit.visitDate,
      additionType,
      sameBuildingDailyCountCategory: normalizeSameBuildingForFormal(estimate.sameBuildingCategory),
      monthlyVisitDay: monthlyDay
    });
    this.addResolvedLine(lines, warnings, resolved, {
      category: "addition",
      serviceName,
      targetDate: visit.visitDate,
      quantity: 1,
      conditionSummary: labels.sameBuildingCategory[estimate.sameBuildingCategory],
      evidence
    });
  }

  private addResolvedLine(
    lines: CalculationLine[],
    warnings: string[],
    resolved: ReturnType<PricingRuleResolver["resolve"]>,
    input: {
      category: PricingCategory;
      serviceName: string;
      targetDate: string;
      quantity: number;
      conditionSummary: string;
      evidence: string;
    }
  ): void {
    if (!resolved.ok) {
      this.addExcludedLine(lines, warnings, input.category, input.serviceName, input.targetDate, resolved.message, input.conditionSummary, input.evidence);
      return;
    }
    const rule = resolved.rule;
    lines.push({
      category: input.category,
      serviceName: rule.itemName,
      conditionSummary: input.conditionSummary,
      targetDates: [input.targetDate],
      quantity: input.quantity,
      unitPrice: rule.unitPrice,
      unitType: rule.unitType as UnitType,
      subtotal: rule.unitPrice * input.quantity,
      evidence: input.evidence,
      includedInTotal: true,
      note: rule.sourceNote ?? rule.note ?? undefined
    });
  }

  private addExcludedLine(
    lines: CalculationLine[],
    warnings: string[],
    category: PricingCategory,
    serviceName: string,
    targetDate: string,
    warning: string,
    conditionSummary = "算定対象外または料金未一致",
    evidence = "算定条件に一致する正式料金が見つからないため、この項目は合計に含めていません。"
  ): void {
    warnings.push(`${targetDate} ${serviceName}: ${warning}`);
    lines.push({
      category,
      serviceName,
      conditionSummary,
      targetDates: [targetDate],
      quantity: 0,
      unitPrice: 0,
      subtotal: 0,
      evidence,
      warning,
      includedInTotal: false
    });
  }

  private mergeLines(lines: CalculationLine[]): CalculationLine[] {
    const map = new Map<string, CalculationLine>();
    for (const line of lines) {
      const key = [
        line.category,
        line.serviceName,
        line.conditionSummary,
        line.unitPrice,
        line.unitType ?? "",
        line.note ?? "",
        line.warning ?? "",
        line.includedInTotal === false ? "excluded" : "included"
      ].join("|");
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...line, targetDates: [...line.targetDates] });
      } else {
        existing.targetDates.push(...line.targetDates);
        existing.quantity += line.quantity;
        existing.subtotal += line.subtotal;
      }
    }
    return Array.from(map.values());
  }
}

function normalizeSameBuildingForFormal(value: MonthlyEstimate["sameBuildingCategory"]): MonthlyEstimate["sameBuildingCategory"] | "one_to_two" {
  return value;
}

function cloneEstimateForMonth(estimate: MonthlyEstimate, targetMonth: string, startDate: string, endDate: string): MonthlyEstimate {
  return {
    ...estimate,
    targetMonth,
    dailyVisits: estimate.dailyVisits.filter((visit) => visit.visitDate >= startDate && visit.visitDate <= endDate && visit.visitDate.startsWith(`${targetMonth}-`))
  };
}

function endOfMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${targetMonth}-${String(lastDay).padStart(2, "0")}`;
}

function monthKeyFromDate(date: string): string {
  return date.slice(0, 7);
}

function nextMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split("-").map(Number);
  const next = new Date(year, month, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function monthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  let cursor = monthKeyFromDate(startDate);
  const end = monthKeyFromDate(endDate);
  while (cursor <= end) {
    months.push(cursor);
    cursor = nextMonth(cursor);
  }
  return months;
}

function sumTotals(totals: CalculationTotals[]): CalculationTotals {
  const copaymentValues = totals.map((total) => total.copaymentAmount).filter((value): value is number => value !== undefined);
  const copaymentBeforeLimitValues = totals.map((total) => total.copaymentAmountBeforeLimit).filter((value): value is number => value !== undefined);
  const highCostLimitValues = totals.map((total) => total.highCostCareLimitAmount).filter((value): value is number => value !== undefined);
  return {
    basic: totals.reduce((sum, total) => sum + total.basic, 0),
    management: totals.reduce((sum, total) => sum + total.management, 0),
    additions: totals.reduce((sum, total) => sum + total.additions, 0),
    grandTotal: totals.reduce((sum, total) => sum + total.grandTotal, 0),
    copaymentAmountBeforeLimit:
      copaymentBeforeLimitValues.length > 0 ? copaymentBeforeLimitValues.reduce((sum, value) => sum + value, 0) : undefined,
    copaymentAmount: copaymentValues.length > 0 ? copaymentValues.reduce((sum, value) => sum + value, 0) : undefined,
    highCostCareLimitAmount: highCostLimitValues.length > 0 ? highCostLimitValues.reduce((sum, value) => sum + value, 0) : undefined,
    highCostCareLimitApplied: totals.some((total) => total.highCostCareLimitApplied)
  };
}
