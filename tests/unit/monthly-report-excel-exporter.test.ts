import { describe, expect, it } from "vitest";
import { buildMonthlyReportWorkbook } from "../../src/main/services/MonthlyReportExcelExporter";
import { ESTIMATE_DISCLAIMER, SAMPLE_PRICING_DISCLAIMER } from "../../src/main/services/MonthlyReportHtmlRenderer";
import { createMonthlyReportData } from "./monthly-report-fixture";

describe("buildMonthlyReportWorkbook", () => {
  it("creates summary, detail and warning sheets", () => {
    const workbook = buildMonthlyReportWorkbook(createMonthlyReportData());

    const summary = workbook.getWorksheet("概要");
    const detail = workbook.getWorksheet("費用明細");
    const warnings = workbook.getWorksheet("警告");

    expect(summary).toBeDefined();
    expect(detail).toBeDefined();
    expect(warnings).toBeDefined();
    expect(summary?.getCell("B4").value).toBe("山田 太郎");
    expect(summary?.getCell("B17").value).toBe(10650);
    expect(detail?.rowCount).toBe(3);
    expect(detail?.getCell("B2").value).toBe("訪問看護基本療養費");
    expect(detail?.getCell("H3").value).toBe(2100);
    expect(warnings?.getCell("B2").value).toBe(ESTIMATE_DISCLAIMER);
    expect(warnings?.getCell("B3").value).toBe(SAMPLE_PRICING_DISCLAIMER);
  });
});
