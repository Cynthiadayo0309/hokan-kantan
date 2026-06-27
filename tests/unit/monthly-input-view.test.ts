import { shallowMount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import MonthlyInputView from "../../src/renderer/views/MonthlyInputView.vue";

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("MonthlyInputView", () => {
  it("renders monthly input screen", async () => {
    vi.stubGlobal("window", {
      ...window,
      hokanApi: {
        getEstimate: vi.fn().mockResolvedValue({
          id: 1,
          patientName: "",
          facilityName: "",
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
          dailyVisits: [],
          updatedAt: "2026-06-01T00:00:00.000Z"
        }),
        getPricingVersion: vi.fn().mockResolvedValue({ label: "サンプル料金", usesSamplePricing: true, ruleCount: 1 }),
        saveEstimate: vi.fn(),
        calculateMonthlyEstimate: vi.fn(),
        resetEstimate: vi.fn(),
        saveDailyVisit: vi.fn(),
        saveDailyVisits: vi.fn(),
        deleteDailyVisit: vi.fn()
      }
    });

    const wrapper = shallowMount(MonthlyInputView, {
      global: {
        plugins: [createPinia()],
        stubs: {
          DailyVisitDialog: true
        }
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("月間予定");
    expect(wrapper.text()).toContain("月額費用を計算");
  });
});
