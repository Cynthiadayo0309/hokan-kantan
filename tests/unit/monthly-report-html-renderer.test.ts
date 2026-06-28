import { describe, expect, it } from "vitest";
import { buildMonthlyReportHtml, ESTIMATE_DISCLAIMER, SAMPLE_PRICING_DISCLAIMER } from "../../src/main/services/MonthlyReportHtmlRenderer";
import { createMonthlyReportData } from "./monthly-report-fixture";

describe("buildMonthlyReportHtml", () => {
  it("includes report header, detail lines, totals and notices", () => {
    const html = buildMonthlyReportHtml(createMonthlyReportData());

    expect(html).toContain("訪看かんたん計算 2026年6月 費用明細");
    expect(html).toContain("山田 太郎");
    expect(html).toContain("青空ホーム");
    expect(html).toContain("訪問看護基本療養費");
    expect(html).toContain("夜間・早朝訪問に関する加算");
    expect(html).toContain("10,650円");
    expect(html).toContain(ESTIMATE_DISCLAIMER);
    expect(html).toContain(SAMPLE_PRICING_DISCLAIMER);
    expect(html).toContain("料金マスターに確認事項があります。");
  });
});
