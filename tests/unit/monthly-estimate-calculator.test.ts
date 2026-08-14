import { describe, expect, it } from "vitest";
import formalPricing from "../../resources/pricing/formal-pricing.json";
import highCostCarePricing from "../../resources/pricing/high-cost-care-limit-rules.json";
import { roundCopaymentToTenYen } from "../../src/main/services/CopaymentCalculator";
import { MonthlyEstimateCalculator } from "../../src/main/services/MonthlyEstimateCalculator";
import type {
  DailyVisit,
  HighCostCareLimitRule,
  MonthlyEstimate,
  PricingCategory,
  PricingRule,
  TimeZoneType,
  UnitType
} from "../../src/shared/types";

const rules = formalPricing.map((item, index) => toPricingRule(item, index + 1));
const highCostCareLimitRules = highCostCarePricing.map((item, index) => toHighCostCareLimitRule(item, index + 1));

describe("MonthlyEstimateCalculator formal pricing", () => {
  it("calculates basic fee II for nurse, 2 people, third and fourth weekly visit days", () => {
    const result = calculate(
      estimate({
        sameBuildingCategory: "two",
        dailyVisits: ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04"].map((date) => visit({ visitDate: date, profession: "nurse" }))
      })
    );

    expect(result.totals.basic).toBe(5550 * 3 + 6550);
    expect(lineSubtotal(result, "訪問看護基本療養費（Ⅱ）", 5550)).toBe(5550 * 3);
    expect(lineSubtotal(result, "訪問看護基本療養費（Ⅱ）", 6550)).toBe(6550);
    expect(result.usesSamplePricing).toBe(false);
  });

  it("calculates basic fee II for assistant nurse, 3 to 9 people, third weekly visit day", () => {
    const result = calculate(
      estimate({
        sameBuildingCategory: "three_to_nine",
        dailyVisits: ["2026-06-01", "2026-06-02", "2026-06-03"].map((date) => visit({ visitDate: date, profession: "assistant_nurse" }))
      })
    );

    expect(result.totals.basic).toBe(2530 * 3);
  });

  it("calculates basic fee II for nurse, 10 to 19 people, twentieth and twenty-first monthly visit days", () => {
    const dates = Array.from({ length: 21 }, (_, index) => `2026-06-${String(index + 1).padStart(2, "0")}`);
    const result = calculate(estimate({ sameBuildingCategory: "ten_to_nineteen", dailyVisits: dates.map((date) => visit({ visitDate: date, profession: "nurse" })) }));

    expect(lineSubtotal(result, "訪問看護基本療養費（Ⅱ）", 2760)).toBe(2760 * 20);
    expect(lineSubtotal(result, "訪問看護基本療養費（Ⅱ）", 2660)).toBe(2660);
  });

  it("calculates basic fee II for rehabilitation professions, 3 to 9 people", () => {
    const result = calculate(estimate({ dailyVisits: [visit({ profession: "physical_therapist" })] }));

    expect(result.totals.basic).toBe(2780);
  });

  it("excludes 1 person category because basic fee I is out of scope", () => {
    const result = calculate(estimate({ sameBuildingCategory: "one", dailyVisits: [visit({ profession: "nurse" })] }));

    expect(result.totals.basic).toBe(0);
    expect(result.lines.some((line) => line.includedInTotal === false && line.warning?.includes("基本療養費（Ⅰ）"))).toBe(true);
  });

  it("calculates management fee first day and later days", () => {
    const result = calculate(
      estimate({
        dailyVisits: [
          visit({ visitDate: "2026-06-01", basicFeeApplicable: "not_applicable", managementFeeApplicable: "applicable" }),
          visit({ visitDate: "2026-06-02", basicFeeApplicable: "not_applicable", managementFeeApplicable: "applicable" })
        ]
      })
    );

    expect(result.totals.management).toBe(7710 + 3010);
  });

  it("does not calculate night or midnight addition without patient or family request", () => {
    const result = calculate(
      estimate({
        dailyVisits: [
          visit({
            basicFeeApplicable: "not_applicable",
            managementFeeApplicable: "not_applicable",
            timeZoneType: "midnight",
            timeVisitRequestedByPatientOrFamily: "not_applicable"
          })
        ]
      })
    );

    expect(result.totals.additions).toBe(0);
    expect(result.lines.some((line) => line.serviceName.includes("夜間") && line.includedInTotal === false)).toBe(true);
  });

  it("does not calculate multiple visit addition without eligibility", () => {
    const result = calculate(
      estimate({
        dailyVisits: [
          visit({
            basicFeeApplicable: "not_applicable",
            managementFeeApplicable: "not_applicable",
            visitCount: 2,
            multipleVisitEligibilityType: "none"
          })
        ]
      })
    );

    expect(result.totals.additions).toBe(0);
    expect(result.lines.some((line) => line.serviceName.includes("複数回") && line.includedInTotal === false)).toBe(true);
  });

  it("calculates long visit only when over 90 minutes and eligible", () => {
    const ninety = calculate(
      estimate({
        dailyVisits: [
          visit({
            basicFeeApplicable: "not_applicable",
            managementFeeApplicable: "not_applicable",
            durationMinutes: 90,
            longVisitEligibilityType: "appendix_8"
          })
        ]
      })
    );
    const ninetyOne = calculate(
      estimate({
        dailyVisits: [
          visit({
            basicFeeApplicable: "not_applicable",
            managementFeeApplicable: "not_applicable",
            durationMinutes: 91,
            longVisitEligibilityType: "appendix_8"
          })
        ]
      })
    );

    expect(ninety.totals.additions).toBe(0);
    expect(ninetyOne.totals.additions).toBeGreaterThan(0);
  });

  it("calculates emergency addition only when all conditions are confirmed", () => {
    const result = calculate(
      estimate({
        dailyVisits: [
          visit({
            basicFeeApplicable: "not_applicable",
            managementFeeApplicable: "not_applicable",
            emergencyUnplanned: "applicable",
            emergencyRequestedByPatientOrFamily: "applicable",
            emergencyPhysicianInstruction: "applicable"
          })
        ]
      })
    );

    expect(result.totals.additions).toBeGreaterThan(0);
  });

  it("calculates special management once per month", () => {
    const result = calculate(
      estimate({
        specialManagementCategory: "yen_5000",
        dailyVisits: [visit({ basicFeeApplicable: "not_applicable", managementFeeApplicable: "not_applicable" })]
      })
    );

    expect(result.totals.additions).toBe(5000);
  });

  it("excludes discharge support guidance for assistant nurse", () => {
    const result = calculate(
      estimate({
        dailyVisits: [
          visit({
            basicFeeApplicable: "not_applicable",
            managementFeeApplicable: "not_applicable",
            profession: "assistant_nurse",
            dischargeSupportGuidanceCategory: "normal",
            firstVisitAfterDischarge: "applicable"
          })
        ]
      })
    );

    expect(result.totals.additions).toBe(0);
    expect(result.lines.some((line) => line.serviceName.includes("退院支援") && line.includedInTotal === false)).toBe(true);
  });

  it("rounds copayment to nearest 10 yen", () => {
    expect(roundCopaymentToTenYen(1234)).toBe(1230);
    expect(roundCopaymentToTenYen(1235)).toBe(1240);
    expect(roundCopaymentToTenYen(1239)).toBe(1240);
  });

  it("keeps copayment unchanged when high cost care limit is unset", () => {
    const result = calculate(
      estimate({
        copaymentRate: "10",
        highCostCareLimitCategory: "unset",
        dailyVisits: Array.from({ length: 4 }, (_, index) => visit({ visitDate: `2026-06-${String(index + 1).padStart(2, "0")}` }))
      })
    );

    expect(result.totals.copaymentAmountBeforeLimit).toBeUndefined();
    expect(result.totals.highCostCareLimitAmount).toBeUndefined();
    expect(result.totals.copaymentAmount).toBe(1160);
  });

  it("applies general high cost care outpatient personal limit for age 70 or older", () => {
    const result = calculate(
      estimate({
        copaymentRate: "30",
        highCostCareLimitCategory: "general",
        dailyVisits: Array.from({ length: 21 }, (_, index) => `2026-06-${String(index + 1).padStart(2, "0")}`).map((date) =>
          visit({ visitDate: date, profession: "nurse" })
        )
      })
    );

    expect(result.totals.copaymentAmountBeforeLimit).toBeGreaterThan(18000);
    expect(result.totals.highCostCareLimitAmount).toBe(18000);
    expect(result.totals.copaymentAmount).toBe(18000);
    expect(result.totals.highCostCareLimitApplied).toBe(true);
  });

  it("does not apply general high cost care limit when copayment is below limit", () => {
    const result = calculate(
      estimate({
        copaymentRate: "10",
        highCostCareLimitCategory: "general",
        dailyVisits: [visit({ visitDate: "2026-06-10" })]
      })
    );

    expect(result.totals.copaymentAmountBeforeLimit).toBe(280);
    expect(result.totals.highCostCareLimitAmount).toBe(18000);
    expect(result.totals.copaymentAmount).toBe(280);
    expect(result.totals.highCostCareLimitApplied).toBe(false);
  });

  it("calculates active income high cost care limit from total medical cost", () => {
    const result = calculate(
      estimate({
        copaymentRate: "30",
        highCostCareLimitCategory: "active_income_1",
        sameBuildingCategory: "two",
        dailyVisits: Array.from({ length: 31 }, (_, index) => `2026-06-${String(index + 1).padStart(2, "0")}`).map((date) =>
          visit({ visitDate: date, profession: "nurse" })
        )
      })
    );

    expect(result.totals.highCostCareLimitAmount).toBe(Math.round(80100 + Math.max(0, result.totals.grandTotal - 267000) * 0.01));
  });

  it("does not show copayment even when high cost care limit is selected if copayment rate is unset", () => {
    const result = calculate(estimate({ copaymentRate: "unset", highCostCareLimitCategory: "general" }));

    expect(result.totals.copaymentAmountBeforeLimit).toBeUndefined();
    expect(result.totals.highCostCareLimitAmount).toBeUndefined();
    expect(result.totals.copaymentAmount).toBeUndefined();
  });

  it("uses the August 2026 revised high cost care limit and shows its scope", () => {
    const result = calculate(
      estimate({
        targetMonth: "2026-08",
        copaymentRate: "30",
        highCostCareLimitCategory: "general",
        dailyVisits: Array.from({ length: 25 }, (_, index) => visit({ visitDate: `2026-08-${String(index + 1).padStart(2, "0")}` }))
      })
    );

    expect(result.totals.highCostCareLimitAmount).toBe(22000);
    expect(result.highCostCareLimitRuleLabel).toBe("2026年8月改定");
    expect(result.warnings.some((warning) => warning.includes("年間上限"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("見直し予定"))).toBe(false);
  });

  it("does not apply an unknown high cost care rule after July 2027", () => {
    const result = calculate(
      estimate({
        targetMonth: "2027-08",
        copaymentRate: "30",
        highCostCareLimitCategory: "general",
        dailyVisits: [visit({ visitDate: "2027-08-10" })]
      })
    );

    expect(result.totals.highCostCareLimitAmount).toBeUndefined();
    expect(result.warnings.some((warning) => warning.includes("制度ルールが見つからない"))).toBe(true);
  });

  it("calculates cross-month periods by month and totals the selected range", () => {
    const result = new MonthlyEstimateCalculator(rules, highCostCareLimitRules).calculate(
      estimate({
        dailyVisits: [
          visit({ visitDate: "2026-06-14", managementFeeApplicable: "applicable" }),
          visit({ visitDate: "2026-06-15", managementFeeApplicable: "applicable" }),
          visit({ visitDate: "2026-07-01", managementFeeApplicable: "applicable" }),
          visit({ visitDate: "2026-07-16", managementFeeApplicable: "applicable" })
        ]
      }),
      { startDate: "2026-06-15", endDate: "2026-07-15" }
    );

    expect(result.monthlyResults).toHaveLength(2);
    expect(result.monthlyResults?.[0].targetMonth).toBe("2026-06");
    expect(result.monthlyResults?.[1].targetMonth).toBe("2026-07");
    expect(result.monthlyResults?.[0].lines.flatMap((line) => line.targetDates)).toContain("2026-06-15");
    expect(result.monthlyResults?.[0].lines.flatMap((line) => line.targetDates)).not.toContain("2026-06-14");
    expect(result.monthlyResults?.[1].lines.flatMap((line) => line.targetDates)).toContain("2026-07-01");
    expect(result.monthlyResults?.[1].lines.flatMap((line) => line.targetDates)).not.toContain("2026-07-16");
    expect(result.totals.grandTotal).toBe(result.monthlyResults!.reduce((sum, month) => sum + month.totals.grandTotal, 0));
  });
});

function calculate(estimateValue: MonthlyEstimate) {
  return new MonthlyEstimateCalculator(rules, highCostCareLimitRules).calculate(estimateValue);
}

function estimate(overrides: Partial<MonthlyEstimate> = {}): MonthlyEstimate {
  return {
    id: 1,
    patientName: "山田 太郎",
    facilityName: "青葉ホーム",
    targetMonth: "2026-06",
    sameBuildingCategory: "three_to_nine",
    copaymentRate: "unset",
    basicFeeType: "type_2",
    stationCategory: "standard",
    singleBuildingResidentCategory: "under_20",
    specialManagementCategory: "none",
    dischargeJointGuidanceCountCategory: "none",
    specialManagementGuidanceApplicable: "not_applicable",
    highCostCareLimitCategory: "unset",
    updatedAt: "2026-06-10T00:00:00.000Z",
    dailyVisits: [visit()],
    ...overrides
  };
}

type VisitOverrides = Partial<DailyVisit> & {
  durationMinutes?: number;
  timeZoneType?: TimeZoneType;
};

function visit(overrides: VisitOverrides = {}): DailyVisit {
  const { durationMinutes = 30, timeZoneType = "daytime", ...dailyVisitOverrides } = overrides;
  return {
    id: 1,
    visitDate: "2026-06-10",
    basicFeeApplicable: "applicable",
    managementFeeApplicable: "not_applicable",
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
    warnings: [],
    timeSlots: [
      {
        sequence: 1,
        startTime: "10:00",
        endTime: "10:30",
        endDayType: "same_day",
        durationMinutes,
        timeZoneType,
        timeZoneBreakdown: [{ zone: timeZoneType === "mixed" ? "daytime" : timeZoneType, minutes: durationMinutes }]
      }
    ],
    ...dailyVisitOverrides
  };
}

function lineSubtotal(result: ReturnType<MonthlyEstimateCalculator["calculate"]>, serviceName: string, unitPrice: number): number {
  return result.lines
    .filter((line) => line.serviceName === serviceName && line.unitPrice === unitPrice)
    .reduce((sum, line) => sum + line.subtotal, 0);
}

function toPricingRule(item: Record<string, unknown>, id: number): PricingRule {
  return {
    id,
    itemCode: String(item.itemCode),
    itemName: String(item.itemName),
    category: item.category as PricingCategory,
    effectiveFrom: "2026-06-01",
    effectiveTo: null,
    profession: "any",
    sameBuildingCategory: "any",
    weeklyVisitCountCategory: "any",
    dailyVisitCountCategory: (item.dailyVisitCountCategory as string | undefined) ?? "any",
    timeZoneType: "any",
    additionType: (item.additionType as PricingRule["additionType"]) ?? "none",
    unitPrice: Number(item.unitPrice),
    unitType: item.unitType as UnitType,
    roundingType: "round",
    note: (item.sourceNote as string | undefined) ?? null,
    enabled: true,
    samplePrice: false,
    feeFamily: (item.feeFamily as string | undefined) ?? null,
    feeCode: (item.feeCode as string | undefined) ?? null,
    professionCategory: (item.professionCategory as PricingRule["professionCategory"]) ?? null,
    basicFeeType: (item.basicFeeType as PricingRule["basicFeeType"]) ?? null,
    sameBuildingDailyCountCategory: (item.sameBuildingDailyCountCategory as PricingRule["sameBuildingDailyCountCategory"]) ?? "any",
    singleBuildingResidentCategory: (item.singleBuildingResidentCategory as PricingRule["singleBuildingResidentCategory"]) ?? "any",
    stationCategory: (item.stationCategory as PricingRule["stationCategory"]) ?? "any",
    weeklyVisitDayRange: (item.weeklyVisitDayRange as string | undefined) ?? null,
    monthlyVisitDayRange: (item.monthlyVisitDayRange as string | undefined) ?? null,
    dailyVisitCountRange: (item.dailyVisitCountRange as string | undefined) ?? null,
    timeZoneCategory: (item.timeZoneCategory as PricingRule["timeZoneCategory"]) ?? "any",
    companionCategory: (item.companionCategory as PricingRule["companionCategory"]) ?? "any",
    maximumFrequencyType: (item.maximumFrequencyType as string | undefined) ?? null,
    maximumFrequencyCount: item.maximumFrequencyCount ? Number(item.maximumFrequencyCount) : null,
    sourceNote: (item.sourceNote as string | undefined) ?? null
  };
}

function toHighCostCareLimitRule(item: Record<string, unknown>, id: number): HighCostCareLimitRule {
  return {
    id,
    ruleCode: String(item.ruleCode),
    category: item.category as HighCostCareLimitRule["category"],
    effectiveFrom: String(item.effectiveFrom),
    effectiveTo: item.effectiveTo ? String(item.effectiveTo) : undefined,
    fixedAmount: Number(item.fixedAmount),
    medicalCostThreshold: item.medicalCostThreshold === undefined ? undefined : Number(item.medicalCostThreshold),
    excessRate: Number(item.excessRate),
    annualLimitAmount: item.annualLimitAmount === undefined ? undefined : Number(item.annualLimitAmount),
    outpatientAnnualLimitAmount: item.outpatientAnnualLimitAmount === undefined ? undefined : Number(item.outpatientAnnualLimitAmount),
    versionLabel: String(item.versionLabel),
    sourceNote: String(item.sourceNote),
    sourceUrl: String(item.sourceUrl),
    enabled: true
  };
}
