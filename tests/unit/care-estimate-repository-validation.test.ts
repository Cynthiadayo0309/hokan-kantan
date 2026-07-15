import { describe, expect, it } from "vitest";
import { validateCareEstimateInput } from "../../src/main/repositories/CareEstimateRepository";
import type { CareEstimateInput } from "../../src/shared/types";

describe("CareEstimateRepository validation", () => {
  it("初回加算と退院時共同指導加算の併用を保存不可にする", () => {
    const input: CareEstimateInput = {
      patientName: "テスト利用者",
      facilityName: "",
      targetMonth: "2026-07",
      careClassification: "care",
      copaymentRate: "unset",
      regionalGrade: "other",
      sameBuildingCategory: "none",
      initialAddition: "type_1",
      emergencyAddition: "none",
      specialManagementAddition: "none",
      dischargeJointGuidance: true,
      terminalCare: false,
      treatmentImprovement: false,
      rehabOver12Months: false,
      rehabFacilityReduction: false
    };

    expect(() => validateCareEstimateInput(input)).toThrow("初回加算と退院時共同指導加算は同時に選択できません");
  });
});
