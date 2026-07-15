import { describe, expect, it } from "vitest";
import { buildCareMonthlyReportWorkbook } from "../../src/main/services/CareMonthlyReportExcelExporter";
import { createCareMonthlyReportData } from "./care-monthly-report-fixture";

describe("buildCareMonthlyReportExcelBuffer", () => {
  it("介護保険の概要・単位明細・警告シートを作成する", () => {
    const workbook = buildCareMonthlyReportWorkbook(createCareMonthlyReportData());

    const summary = workbook.getWorksheet("概要");
    const detail = workbook.getWorksheet("費用明細");
    const warnings = workbook.getWorksheet("警告");
    expect(summary).toBeDefined();
    expect(detail).toBeDefined();
    expect(warnings).toBeDefined();
    expect(summary?.getCell("B4").value).toBe("介護保険");
    expect(detail?.getCell("B2").value).toBe("訪問看護費（30分未満）");
    expect(detail?.getCell("F2").value).toBe(471);
    expect(detail?.getCell("H2").value).toBe(11.4);
    expect(detail?.getCell("I2").value).toBe(5369);
  });
});
