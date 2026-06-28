import { shallowMount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import MonthlyInputView from "../../src/renderer/views/MonthlyInputView.vue";
import type { MonthlyEstimate } from "../../src/shared/types";

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("MonthlyInputView", () => {
  function createEstimate(): MonthlyEstimate {
    return {
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
      dailyVisits: [
        {
          id: 10,
          visitDate: "2026-06-10",
          basicFeeApplicable: "applicable",
          managementFeeApplicable: "applicable",
          profession: "nurse",
          visitCount: 2,
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
              durationMinutes: 30,
              timeZoneType: "daytime",
              timeZoneBreakdown: [{ zone: "daytime", minutes: 30 }]
            },
            {
              sequence: 2,
              startTime: "19:00",
              endTime: "19:30",
              endDayType: "same_day",
              durationMinutes: 30,
              timeZoneType: "night",
              timeZoneBreakdown: [{ zone: "night", minutes: 30 }]
            }
          ]
        }
      ],
      updatedAt: "2026-06-01T00:00:00.000Z"
    };
  }

  function stubApi(estimate = createEstimate()) {
    const api = {
      getEstimate: vi.fn().mockResolvedValue(estimate),
      getPricingVersion: vi.fn().mockResolvedValue({ label: "サンプル料金", usesSamplePricing: true, ruleCount: 1 }),
      saveEstimate: vi.fn().mockResolvedValue(estimate),
      calculateMonthlyEstimate: vi.fn(),
      resetEstimate: vi.fn(),
      saveDailyVisit: vi.fn(),
      saveDailyVisits: vi.fn(),
      deleteDailyVisit: vi.fn()
    };

    Object.defineProperty(window, "hokanApi", {
      configurable: true,
      value: api
    });
    return api;
  }

  function mountView() {
    return shallowMount(MonthlyInputView, {
      global: {
        plugins: [createPinia()],
        stubs: {
          DailyVisitDialog: true
        }
      }
    });
  }

  it("renders monthly calendar with visit summaries", async () => {
    stubApi();

    const wrapper = mountView();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("月間予定");
    expect(wrapper.text()).toContain("月額費用を計算");
    expect(wrapper.text()).toContain("日");
    expect(wrapper.text()).toContain("土");
    expect(wrapper.text()).toContain("10");
    expect(wrapper.text()).toContain("看護師・2回");
    expect(wrapper.text()).toContain("10:00 / 19:00");
    expect(wrapper.find(".calendar-day.has-visit").exists()).toBe(true);
    expect(wrapper.find(".calendar-day.weekend").exists()).toBe(true);
  });

  it("opens daily visit dialog from a calendar day", async () => {
    const api = stubApi();
    const wrapper = mountView();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.find(".calendar-day.has-visit").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.saveEstimate).toHaveBeenCalled();
    expect(wrapper.findComponent({ name: "DailyVisitDialog" }).attributes("modelvalue")).toBe("true");
  });
});
