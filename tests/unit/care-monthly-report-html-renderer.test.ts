import { describe, expect, it } from "vitest";
import { buildCareMonthlyReportHtml, CARE_DISCLAIMER, CARE_SCOPE_NOTICE } from "../../src/main/services/CareMonthlyReportHtmlRenderer";
import { createCareMonthlyReportData } from "./care-monthly-report-fixture";

describe("buildCareMonthlyReportHtml", () => {
  it("介護保険、単位、地域単価、円額と注意事項を出力する", () => {
    const html = buildCareMonthlyReportHtml(createCareMonthlyReportData());

    expect(html).toContain("介護保険 2026年6月 費用明細");
    expect(html).toContain("介護 花子");
    expect(html).toContain("訪問看護費（30分未満）");
    expect(html).toContain("471単位");
    expect(html).toContain("11.40円");
    expect(html).toContain("5,369円");
    expect(html).toContain("537円");
    expect(html).toContain(CARE_DISCLAIMER);
    expect(html).toContain(CARE_SCOPE_NOTICE);
  });
});
