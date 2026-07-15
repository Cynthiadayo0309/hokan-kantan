import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CareEstimate, CarePricingRule, CareServiceEntry, CareServiceEntryInput } from "../../src/shared/types";
import { CareDailyServiceCalculator } from "../../src/main/services/CareDailyServiceCalculator";
import { CareMonthlyEstimateCalculator } from "../../src/main/services/CareMonthlyEstimateCalculator";
import { carePricingVersion } from "../../src/main/services/CarePricingRuleResolver";

const pricing = JSON.parse(readFileSync(path.resolve("resources/pricing/care-pricing.json"), "utf-8")) as { rules: Array<Record<string, unknown>> };
const rules: CarePricingRule[] = pricing.rules.map((rule, index) => ({
  id: index + 1,
  code: String(rule.code),
  name: String(rule.name),
  category: rule.category as CarePricingRule["category"],
  effectiveFrom: String(rule.effectiveFrom),
  effectiveTo: null,
  careClassification: (rule.careClassification ?? "any") as CarePricingRule["careClassification"],
  professionCategory: (rule.professionCategory ?? "any") as CarePricingRule["professionCategory"],
  serviceCategory: (rule.serviceCategory ?? "any") as CarePricingRule["serviceCategory"],
  unitCount: Number(rule.unitCount),
  percentage: rule.percentage === undefined ? null : Number(rule.percentage),
  sourceNote: "厚生労働省"
}));

describe("CareMonthlyEstimateCalculator", () => {
  it("471単位を1級地で5,369円、1割負担537円として計算する", () => {
    const result = calculate(estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "10:25" }))]));
    expect(result.totals.totalUnits).toBe(471);
    expect(result.totals.grandTotal).toBe(5369);
    expect(result.totals.copaymentAmount).toBe(537);
  });

  it("要支援の30分未満は451単位を使用する", () => {
    const estimate = estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "10:25" }))]);
    estimate.careClassification = "support";
    expect(calculate(estimate).totals.totalUnits).toBe(451);
  });

  it.each([
    ["10:00", "10:15", 314, 303],
    ["10:00", "10:25", 471, 451],
    ["10:00", "10:30", 823, 794],
    ["10:00", "11:00", 1128, 1090]
  ])("看護職の時間区分%s～%sを要介護・要支援別に計算する", (startTime, endTime, careUnits, supportUnits) => {
    const qualifyingDay = day("2026-07-08", service({ startTime: "13:00", endTime: "13:20" }));
    const care = estimateWith([day("2026-07-06", service({ startTime, endTime })), qualifyingDay]);
    const careResult = calculate(care);
    expect(careResult.totals.basicUnits).toBe(careUnits + 471);

    const support = estimateWith(care.serviceDays);
    support.careClassification = "support";
    const supportResult = calculate(support);
    expect(supportResult.totals.basicUnits).toBe(supportUnits + 451);
  });

  it.each(["public_health_nurse", "nurse"] as const)("%sは看護職単位を使用する", (profession) => {
    const result = calculate(estimateWith([day("2026-07-10", service({ profession, startTime: "10:00", endTime: "10:25" }))]));
    expect(result.totals.basicUnits).toBe(471);
  });

  it.each(["physical_therapist", "occupational_therapist", "speech_therapist"] as const)("%sは20分単位で算定する", (profession) => {
    const entry = service({ profession, startTime: "10:00", endTime: "10:45" });
    const result = calculate(estimateWith([day("2026-07-10", entry)]));
    expect(result.totals.basicUnits).toBe(294 * 2);
    expect(entry.warnings).toContain("20分に満たない端数時間は算定回数に含めません。");
  });

  it.each([
    ["05:55", "06:20", 707],
    ["06:00", "06:25", 589],
    ["08:00", "08:25", 471],
    ["18:00", "18:25", 589],
    ["22:00", "22:25", 707]
  ])("開始時刻%sの時間帯加算を判定する", (startTime, endTime, expectedUnits) => {
    const result = calculate(estimateWith([day("2026-07-10", service({ startTime, endTime }))]));
    expect(result.totals.totalUnits).toBe(expectedUnits);
  });

  it("20分未満は同じ週に20分以上の日中訪問がなければ除外する", () => {
    const result = calculate(estimateWith([day("2026-07-06", service({ startTime: "10:00", endTime: "10:15" }))]));
    expect(result.totals.totalUnits).toBe(0);
    expect(result.lines[0].includedInTotal).toBe(false);
  });

  it("20分未満は同じ週の日中20分以上訪問があれば算定する", () => {
    const result = calculate(estimateWith([
      day("2026-07-06", service({ startTime: "10:00", endTime: "10:15" })),
      day("2026-07-08", service({ startTime: "10:00", endTime: "10:20" }))
    ]));
    expect(result.totals.totalUnits).toBe(314 + 471);
  });

  it("准看護師90%と同一建物15%減算を順に適用する", () => {
    const estimate = estimateWith([day("2026-07-10", service({ profession: "assistant_nurse", startTime: "10:00", endTime: "10:25" }))]);
    estimate.sameBuildingCategory = "same_adjacent_50_plus";
    const result = calculate(estimate);
    expect(result.totals.totalUnits).toBe(Math.round(Math.round(471 * 0.9) * 0.85));
    expect(result.totals.deductionUnits).toBe(471 - result.totals.totalUnits);
  });

  it("リハビリ60分を3回として90%算定し、事業所・12か月超減算を適用する", () => {
    const estimate = estimateWith([day("2026-07-10", service({ profession: "physical_therapist", startTime: "10:00", endTime: "11:00" }))]);
    estimate.careClassification = "support";
    estimate.rehabFacilityReduction = true;
    estimate.rehabOver12Months = true;
    const result = calculate(estimate);
    const expected = Math.round(284 * 3 * 0.9) - 8 * 3 - 15 * 3;
    expect(result.totals.totalUnits).toBe(expected);
  });

  it("処遇改善加算は2026年6月以降だけ1.8%を加算する", () => {
    const july = estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "10:25" }))]);
    july.treatmentImprovement = true;
    expect(calculate(july).totals.totalUnits).toBe(471 + Math.round(471 * 0.018));

    const may = estimateWith([day("2026-05-10", service({ startTime: "10:00", endTime: "10:25" }))]);
    may.targetMonth = "2026-05";
    may.treatmentImprovement = true;
    expect(calculate(may).totals.totalUnits).toBe(471);
  });

  it("初回・緊急時・特別管理・ターミナルの月額加算を合算する", () => {
    const estimate = estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "10:25" }))]);
    estimate.initialAddition = "type_1";
    estimate.emergencyAddition = "type_2";
    estimate.specialManagementAddition = "type_1";
    estimate.terminalCare = true;
    expect(calculate(estimate).totals.totalUnits).toBe(471 + 350 + 574 + 500 + 2500);
  });

  it("90分以上は1時間以上1時間30分未満の基本報酬と長時間加算を使用する", () => {
    const estimate = estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "11:30" }))]);
    estimate.specialManagementAddition = "type_1";
    const result = calculate(estimate);
    expect(result.totals.totalUnits).toBe(1128 + 300 + 500);
    expect(result.lines.some((line) => line.serviceName === "長時間訪問看護加算")).toBe(true);
  });

  it.each([
    ["same_adjacent_under_50", 0.9],
    ["other_building_20_plus", 0.9],
    ["same_adjacent_50_plus", 0.85]
  ] as const)("同一建物区分%sの減算を適用する", (sameBuildingCategory, rate) => {
    const estimate = estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "10:25" }))]);
    estimate.sameBuildingCategory = sameBuildingCategory;
    expect(calculate(estimate).totals.totalUnits).toBe(Math.round(471 * rate));
  });
});

describe("carePricingVersion", () => {
  it("2026年5月以前と6月以降で料金版を切り替える", () => {
    expect(carePricingVersion("2026-05", rules.length).label).toBe("令和6年度介護報酬改定");
    expect(carePricingVersion("2026-06", rules.length).label).toBe("令和8年6月期中改定対応");
  });
});

describe("CareDailyServiceCalculator", () => {
  it("同日のサービス時間が重複する場合は保存できない", () => {
    expect(() => CareDailyServiceCalculator.normalize([
      input({ sequence: 1, startTime: "10:00", endTime: "10:30" }),
      input({ sequence: 2, profession: "physical_therapist", startTime: "10:20", endTime: "10:40" })
    ])).toThrow("重複");
  });

  it("翌日終了を含めて時間帯内訳を作成する", () => {
    const [entry] = CareDailyServiceCalculator.normalize([input({ startTime: "23:30", endTime: "00:10", endDayType: "next_day" })]);
    expect(entry.durationMinutes).toBe(40);
    expect(entry.timeZoneBreakdown).toEqual([{ zone: "midnight", minutes: 40 }]);
  });
});

function calculate(estimate: CareEstimate) {
  return new CareMonthlyEstimateCalculator(rules).calculate(estimate, 11.4);
}

function estimateWith(serviceDays: CareEstimate["serviceDays"]): CareEstimate {
  return {
    id: 1, patientName: "テスト利用者", facilityName: "テスト施設", targetMonth: "2026-07", careClassification: "care",
    copaymentRate: "10", regionalGrade: "grade_1", sameBuildingCategory: "none", initialAddition: "none",
    emergencyAddition: "none", specialManagementAddition: "none", dischargeJointGuidance: false, terminalCare: false,
    treatmentImprovement: false, rehabOver12Months: false, rehabFacilityReduction: false, serviceDays, updatedAt: "2026-07-01T00:00:00Z"
  };
}

function day(visitDate: string, ...services: CareServiceEntry[]): CareEstimate["serviceDays"][number] {
  return { visitDate, services };
}

let nextId = 1;
function service(overrides: Partial<CareServiceEntryInput> = {}): CareServiceEntry {
  const [normalized] = CareDailyServiceCalculator.normalize([input(overrides)]);
  return { ...normalized, id: nextId++ };
}

function input(overrides: Partial<CareServiceEntryInput> = {}): CareServiceEntryInput {
  return { sequence: 1, profession: "nurse", startTime: "10:00", endTime: "10:30", endDayType: "same_day", unplannedEmergency: false, ...overrides };
}
