import type { CareCalculationResult, CareEstimate, PricingVersion } from "../../src/shared/types";
import type { CareMonthlyReportData } from "../../src/main/services/CareMonthlyReportHtmlRenderer";

export function createCareMonthlyReportData(): CareMonthlyReportData {
  const estimate: CareEstimate = {
    id: 2,
    patientName: "介護 花子",
    facilityName: "みどりホーム",
    targetMonth: "2026-06",
    careClassification: "care",
    copaymentRate: "10",
    regionalGrade: "grade_1",
    sameBuildingCategory: "none",
    initialAddition: "none",
    emergencyAddition: "none",
    specialManagementAddition: "none",
    dischargeJointGuidance: false,
    terminalCare: false,
    treatmentImprovement: false,
    rehabOver12Months: false,
    rehabFacilityReduction: false,
    serviceDays: [],
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
  const calculation: CareCalculationResult = {
    insuranceType: "care",
    targetMonth: "2026-06",
    lines: [{
      category: "basic",
      serviceName: "訪問看護費（30分未満）",
      conditionSummary: "看護師・25分",
      targetDates: ["2026-06-10"],
      quantity: 1,
      unitCount: 471,
      subtotalUnits: 471,
      regionalUnitPrice: 11.4,
      amount: 5369,
      includedInTotal: true,
      evidence: "厚生労働省"
    }],
    totals: {
      basicUnits: 471,
      additionUnits: 0,
      deductionUnits: 0,
      totalUnits: 471,
      regionalUnitPrice: 11.4,
      grandTotal: 5369,
      copaymentAmount: 537
    },
    warnings: ["医療保険が優先される場合があります。"],
    usesSamplePricing: false
  };
  const pricingVersion: PricingVersion = {
    label: "令和8年6月期中改定対応",
    usesSamplePricing: false,
    ruleCount: 20
  };
  return { estimate, calculation, pricingVersion };
}
