import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
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
});
