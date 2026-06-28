import type { MonthlyCalculationResult, MonthlyEstimate, PricingVersion } from "../../src/shared/types";
import type { MonthlyReportData } from "../../src/main/services/MonthlyReportHtmlRenderer";

export function createMonthlyReportData(): MonthlyReportData {
  return {
    estimate: createEstimate(),
    calculation: createCalculation(),
    pricingVersion: createPricingVersion()
  };
}

export function createEstimate(): MonthlyEstimate {
  return {
    id: 1,
    patientName: "山田 太郎",
    facilityName: "青空ホーム",
    targetMonth: "2026-06",
    sameBuildingCategory: "three_to_nine",
    copaymentRate: "10",
    basicFeeType: "type_2",
    stationCategory: "standard",
    singleBuildingResidentCategory: "under_20",
    specialManagementCategory: "none",
    dischargeJointGuidanceCountCategory: "none",
    specialManagementGuidanceApplicable: "not_applicable",
    highCostCareLimitCategory: "unset",
    dailyVisits: [],
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
}

export function createCalculation(): MonthlyCalculationResult {
  return {
    lines: [
      {
        category: "basic",
        serviceName: "訪問看護基本療養費",
        conditionSummary: "看護師、3人以上9人以下",
        targetDates: ["2026-06-10"],
        quantity: 1,
        unitPrice: 5550,
        unitType: "per_visit",
        subtotal: 5550,
        evidence: "サンプル料金",
        note: "テスト明細"
      },
      {
        category: "addition",
        serviceName: "夜間・早朝訪問に関する加算",
        conditionSummary: "夜間",
        targetDates: ["2026-06-10"],
        quantity: 1,
        unitPrice: 2100,
        unitType: "per_visit",
        subtotal: 2100,
        warning: "確認が必要です。"
      }
    ],
    totals: {
      basic: 5550,
      management: 3000,
      additions: 2100,
      grandTotal: 10650,
      copaymentAmount: 1065
    },
    warnings: ["料金マスターに確認事項があります。"],
    usesSamplePricing: true
  };
}

export function createPricingVersion(): PricingVersion {
  return {
    label: "サンプル料金",
    usesSamplePricing: true,
    ruleCount: 2
  };
}
