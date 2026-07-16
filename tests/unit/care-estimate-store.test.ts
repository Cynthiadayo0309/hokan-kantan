import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCareEstimateStore } from "../../src/renderer/stores/careEstimateStore";
import type { CareCalculationResult, CareEstimate, SaveCareDaysPayload } from "../../src/shared/types";

describe("careEstimateStore saveDays", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("updates the estimate and clears the previous calculation after a copy", async () => {
    const estimate = createEstimate();
    const saveCareDays = vi.fn().mockResolvedValue(estimate);
    Object.defineProperty(window, "hokanApi", {
      configurable: true,
      value: { saveCareDays }
    });
    const store = useCareEstimateStore();
    store.calculation = { insuranceType: "care" } as CareCalculationResult;
    const payload: SaveCareDaysPayload = {
      careEstimateId: 1,
      days: [{
        visitDate: "2026-07-15",
        services: [{ sequence: 1, profession: "nurse", startTime: "09:00", endTime: "09:30", endDayType: "same_day", unplannedEmergency: false }]
      }]
    };

    await store.saveDays(payload);

    expect(saveCareDays).toHaveBeenCalledWith(payload);
    expect(store.estimate).toEqual(estimate);
    expect(store.calculation).toBeNull();
  });
});

function createEstimate(): CareEstimate {
  return {
    id: 1,
    patientName: "テスト利用者",
    facilityName: "",
    targetMonth: "2026-07",
    careClassification: "care",
    copaymentRate: "unset",
    regionalGrade: "other",
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
    updatedAt: "2026-07-16T00:00:00.000Z"
  };
}
