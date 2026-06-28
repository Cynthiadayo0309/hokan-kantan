import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import DailyVisitDialog from "../../src/renderer/components/DailyVisitDialog.vue";

describe("DailyVisitDialog", () => {
  it("shows basic inputs first and keeps detailed addition conditions collapsed", () => {
    const wrapper = shallowMount(DailyVisitDialog, {
      props: {
        modelValue: true,
        monthlyEstimateId: 1,
        visitDate: "2026-06-10",
        targetMonth: "2026-06",
        existingVisitDates: []
      }
    });

    expect(wrapper.html()).toContain("訪問看護基本療養費");
    expect(wrapper.text()).toContain("各回の訪問時間");
    expect(wrapper.text()).toContain("詳細な加算条件");
    expect(wrapper.text()).toContain("必要な加算がある場合だけ開いて選択します。");
  });

  it("allows bulk copy across the selected month and next month up to 31 days", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const wrapper = shallowMount(DailyVisitDialog, {
      props: {
        modelValue: true,
        monthlyEstimateId: 1,
        visitDate: "2026-06-15",
        targetMonth: "2026-06",
        existingVisitDates: []
      }
    });

    const vm = wrapper.vm as unknown as { rangeStartDate: string; rangeEndDate: string; copyToRange: () => void };
    vm.rangeStartDate = "2026-06-15";
    vm.rangeEndDate = "2026-07-15";
    vm.copyToRange();

    const emitted = wrapper.emitted("bulkSave")?.[0]?.[0] as Array<{ visitDate: string }>;
    expect(emitted).toHaveLength(31);
    expect(emitted[0].visitDate).toBe("2026-06-15");
    expect(emitted[30].visitDate).toBe("2026-07-15");
  });

  it("keeps the 31 day limit and rejects dates outside the allowed adjacent months", () => {
    const wrapper = shallowMount(DailyVisitDialog, {
      props: {
        modelValue: true,
        monthlyEstimateId: 1,
        visitDate: "2026-06-01",
        targetMonth: "2026-06",
        existingVisitDates: []
      }
    });

    const vm = wrapper.vm as unknown as { rangeStartDate: string; rangeEndDate: string; copyToRange: () => void; error: string };
    vm.rangeStartDate = "2026-06-01";
    vm.rangeEndDate = "2026-07-15";
    vm.copyToRange();
    expect(wrapper.emitted("bulkSave")).toBeUndefined();

    vm.rangeStartDate = "2026-06-15";
    vm.rangeEndDate = "2026-08-01";
    vm.copyToRange();
    expect(wrapper.emitted("bulkSave")).toBeUndefined();
  });
});
