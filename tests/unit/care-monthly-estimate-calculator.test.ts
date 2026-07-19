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

  it("新形式の30分未満は29分として要介護471単位・要支援451単位を使用する", () => {
    const entry = service({ endTime: undefined, endDayType: undefined, billingCategory: "under_30" });
    expect(entry).toMatchObject({ durationMinutes: 29, endTime: "10:29", serviceCategory: "under_30" });
    expect(calculate(estimateWith([day("2026-07-10", entry)])).totals.totalUnits).toBe(471);

    const support = estimateWith([day("2026-07-10", entry)]);
    support.careClassification = "support";
    expect(calculate(support).totals.totalUnits).toBe(451);
  });

  it("旧形式の30分ちょうどは保存済み区分にかかわらず1時間未満として計算する", () => {
    const care = estimateWith([day("2026-07-10", service({ startTime: "10:00", endTime: "10:30", billingCategory: "under_30" }))]);
    const careResult = calculate(care);
    expect(careResult.totals.totalUnits).toBe(823);
    expect(careResult.warnings).not.toContain(expect.stringContaining("実績時間と算定区分"));

    const support = estimateWith(care.serviceDays);
    support.careClassification = "support";
    expect(calculate(support).totals.totalUnits).toBe(794);
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
    expect(entry.durationMinutes).toBe(40);
    expect(entry.endTime).toBe("10:40");
    expect(entry.warnings).toEqual([]);
  });

  it.each(["physical_therapist", "occupational_therapist", "speech_therapist"] as const)("新形式の%sは20分／40分だけを受け付ける", (profession) => {
    const twenty = service({ profession, endTime: undefined, endDayType: undefined, billingCategory: undefined, rehabDurationMinutes: 20 });
    const forty = service({ profession, endTime: undefined, endDayType: undefined, billingCategory: undefined, rehabDurationMinutes: 40 });
    expect(twenty).toMatchObject({ durationMinutes: 20, endTime: "10:20" });
    expect(forty).toMatchObject({ durationMinutes: 40, endTime: "10:40" });
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

  it("20分未満を選択したサービス自身は週内の20分以上訪問として数えない", () => {
    const result = calculate(estimateWith([
      day("2026-07-06", service({ startTime: "10:00", endTime: undefined, endDayType: undefined, billingCategory: "under_20" }))
    ]));
    expect(result.totals.totalUnits).toBe(0);
    expect(result.lines[0].includedInTotal).toBe(false);
  });

  it("准看護師90%と同一建物15%減算を順に適用する", () => {
    const estimate = estimateWith([day("2026-07-10", service({ profession: "assistant_nurse", startTime: "10:00", endTime: "10:25" }))]);
    estimate.sameBuildingCategory = "same_adjacent_50_plus";
    const result = calculate(estimate);
    expect(result.totals.totalUnits).toBe(Math.round(Math.round(471 * 0.9) * 0.85));
    expect(result.totals.deductionUnits).toBe(471 - result.totals.totalUnits);
  });

  it("リハビリ40分と20分を同日3回として90%算定し、事業所・12か月超減算を適用する", () => {
    const estimate = estimateWith([day(
      "2026-07-10",
      service({ profession: "physical_therapist", startTime: "10:00", endTime: undefined, endDayType: undefined, billingCategory: undefined, rehabDurationMinutes: 40 }),
      service({ profession: "physical_therapist", startTime: "10:40", endTime: undefined, endDayType: undefined, billingCategory: undefined, rehabDurationMinutes: 20 })
    )]);
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
  it.each([
    ["10:00", "10:19", "under_20"],
    ["10:00", "10:20", "under_30"],
    ["10:00", "10:30", "under_60"],
    ["10:00", "11:00", "under_90"],
    ["10:00", "11:30", "long"]
  ] as const)("算定区分未指定の%s～%sは公式境界で%sに分類する", (startTime, endTime, expected) => {
    const [entry] = CareDailyServiceCalculator.normalize([input({ startTime, endTime })]);
    expect(entry.serviceCategory).toBe(expected);
  });

  it("旧形式では明示した算定区分より実時間の公式境界を優先する", () => {
    const [entry] = CareDailyServiceCalculator.normalize([input({ billingCategory: "under_30" })]);
    expect(entry.serviceCategory).toBe("under_60");
    expect(entry.warnings).toEqual([]);
  });

  it.each([
    ["under_20", 19, "10:19", "same_day"],
    ["under_30", 29, "10:29", "same_day"],
    ["under_60", 59, "10:59", "same_day"],
    ["under_90", 89, "11:29", "same_day"],
    ["long", 90, "11:30", "same_day"]
  ] as const)("新形式の%sは代表時間%d分と終了時刻%sを生成する", (billingCategory, durationMinutes, endTime, endDayType) => {
    const [entry] = CareDailyServiceCalculator.normalize([input({ endTime: undefined, endDayType: undefined, billingCategory })]);
    expect(entry).toMatchObject({ billingCategory, serviceCategory: billingCategory, durationMinutes, endTime, endDayType });
  });

  it("新形式の23時台開始は終了時刻を翌日として生成する", () => {
    const [entry] = CareDailyServiceCalculator.normalize([input({ startTime: "23:50", endTime: undefined, endDayType: undefined, billingCategory: "under_30" })]);
    expect(entry).toMatchObject({ durationMinutes: 29, endTime: "00:19", endDayType: "next_day" });
    expect(entry.timeZoneBreakdown).toEqual([{ zone: "midnight", minutes: 29 }]);
  });

  it("旧形式のリハビリは20～39分を20分、40分以上を40分へ補正する", () => {
    const [shortEntry] = CareDailyServiceCalculator.normalize([input({ profession: "physical_therapist", endTime: "10:35", billingCategory: undefined })]);
    const [longEntry] = CareDailyServiceCalculator.normalize([input({ profession: "physical_therapist", endTime: "11:20", billingCategory: undefined })]);
    expect(shortEntry).toMatchObject({ durationMinutes: 20, endTime: "10:20", rehabDurationMinutes: 20 });
    expect(longEntry).toMatchObject({ durationMinutes: 40, endTime: "10:40", rehabDurationMinutes: 40 });
  });

  it("同日のサービス時間が重複する場合は保存できない", () => {
    expect(() => CareDailyServiceCalculator.normalize([
      input({ sequence: 1, startTime: "10:00", endTime: undefined, endDayType: undefined, billingCategory: "under_30" }),
      input({ sequence: 2, profession: "physical_therapist", startTime: "10:20", endTime: undefined, endDayType: undefined, billingCategory: undefined, rehabDurationMinutes: 20 })
    ])).toThrow("重複");
  });

  it("終了と次の開始が同時刻なら重複しない", () => {
    const entries = CareDailyServiceCalculator.normalize([
      input({ sequence: 1, startTime: "10:00", endTime: undefined, endDayType: undefined, billingCategory: "under_30" }),
      input({ sequence: 2, profession: "physical_therapist", startTime: "10:29", endTime: undefined, endDayType: undefined, billingCategory: undefined, rehabDurationMinutes: 20 })
    ]);
    expect(entries).toHaveLength(2);
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
