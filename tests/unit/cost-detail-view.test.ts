import { shallowMount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it, vi } from "vitest";
import CostDetailView from "../../src/renderer/views/CostDetailView.vue";
import { createCalculation, createEstimate, createPricingVersion } from "./monthly-report-fixture";

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("CostDetailView", () => {
  function stubApi() {
    const api = {
      getEstimate: vi.fn().mockResolvedValue(createEstimate()),
      getPricingVersion: vi.fn().mockResolvedValue(createPricingVersion()),
      saveEstimate: vi.fn(),
      saveDailyVisit: vi.fn(),
      saveDailyVisits: vi.fn(),
      deleteDailyVisit: vi.fn(),
      calculateMonthlyEstimate: vi.fn().mockResolvedValue(createCalculation()),
      resetEstimate: vi.fn(),
      previewMonthlyReport: vi.fn().mockResolvedValue(undefined),
      printMonthlyReport: vi.fn().mockResolvedValue({ canceled: false }),
      exportMonthlyReportPdf: vi.fn().mockResolvedValue({ canceled: false, filePath: "report.pdf" }),
      exportMonthlyReportExcel: vi.fn().mockResolvedValue({ canceled: false, filePath: "report.xlsx" })
    };

    Object.defineProperty(window, "hokanApi", {
      configurable: true,
      value: api
    });
    return api;
  }

  it("renders export buttons and calls PDF export API", async () => {
    const api = stubApi();
    const wrapper = shallowMount(CostDetailView, {
      global: {
        plugins: [createPinia()]
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(wrapper.text()).toContain("印刷プレビュー");
    expect(wrapper.text()).toContain("PDF保存");
    expect(wrapper.text()).toContain("Excel保存");

    const pdfButton = wrapper.findAll("v-btn").find((button) => button.text().includes("PDF保存"));
    expect(pdfButton).toBeDefined();
    await pdfButton?.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(api.exportMonthlyReportPdf).toHaveBeenCalledWith({ monthlyEstimateId: 1 });
  });
});
