import ExcelJS from "exceljs";
import type { MonthlyReportData } from "./MonthlyReportHtmlRenderer";
import { ESTIMATE_DISCLAIMER, SAMPLE_PRICING_DISCLAIMER, categoryLabel, formatMonth, formatShortDate } from "./MonthlyReportHtmlRenderer";
import { labels } from "../../shared/types";

export async function buildMonthlyReportExcelBuffer(data: MonthlyReportData): Promise<Buffer> {
  const workbook = buildMonthlyReportWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildMonthlyReportWorkbook(data: MonthlyReportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "訪看かんたん計算";
  workbook.created = new Date();

  addSummarySheet(workbook, data);
  addDetailSheet(workbook, data);
  addWarningSheet(workbook, data);

  return workbook;
}

function addSummarySheet(workbook: ExcelJS.Workbook, data: MonthlyReportData): void {
  const { estimate, calculation, pricingVersion } = data;
  const sheet = workbook.addWorksheet("概要");
  sheet.columns = [
    { header: "項目", key: "label", width: 28 },
    { header: "内容", key: "value", width: 42 }
  ];
  sheet.addRows([
    { label: "注意", value: ESTIMATE_DISCLAIMER },
    ...(pricingVersion.usesSamplePricing ? [{ label: "料金", value: SAMPLE_PRICING_DISCLAIMER }] : []),
    { label: "利用者名", value: estimate.patientName },
    { label: "施設名", value: estimate.facilityName || "未入力" },
    { label: "対象年月", value: formatMonth(estimate.targetMonth) },
    { label: "同一建物人数区分", value: labels.sameBuildingCategory[estimate.sameBuildingCategory] },
    { label: "自己負担割合", value: labels.copaymentRate[estimate.copaymentRate] },
    { label: "基本療養費", value: "Ⅱ" },
    { label: "ステーション区分", value: labels.stationCategory[estimate.stationCategory] },
    { label: "管理療養費用人数区分", value: labels.singleBuildingResidentCategory[estimate.singleBuildingResidentCategory] },
    { label: "特別管理加算", value: labels.specialManagementCategory[estimate.specialManagementCategory] },
    { label: "高額療養費自己負担限度額", value: labels.highCostCareLimitCategory[estimate.highCostCareLimitCategory] },
    { label: "訪問看護基本療養費合計", value: calculation.totals.basic },
    { label: "訪問看護管理療養費合計", value: calculation.totals.management },
    { label: "各種加算合計", value: calculation.totals.additions },
    { label: "月額費用総額", value: calculation.totals.grandTotal },
    ...(calculation.totals.copaymentAmountBeforeLimit !== undefined ? [{ label: "上限適用前の利用者負担額", value: calculation.totals.copaymentAmountBeforeLimit }] : []),
    ...(calculation.totals.highCostCareLimitAmount !== undefined ? [{ label: "高額療養費自己負担限度額", value: calculation.totals.highCostCareLimitAmount }] : []),
    ...(calculation.totals.copaymentAmount !== undefined ? [{ label: "利用者負担額の概算", value: calculation.totals.copaymentAmount }] : [])
  ]);
  styleHeader(sheet);
  sheet.getColumn("value").numFmt = '#,##0"円"';
  sheet.getCell("B2").numFmt = "@";
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addDetailSheet(workbook: ExcelJS.Workbook, data: MonthlyReportData): void {
  const sheet = workbook.addWorksheet("費用明細");
  sheet.columns = [
    { header: "区分", key: "category", width: 14 },
    { header: "サービス内容", key: "serviceName", width: 28 },
    { header: "算定条件", key: "conditionSummary", width: 32 },
    { header: "対象日", key: "targetDates", width: 24 },
    { header: "算定回数", key: "quantity", width: 12 },
    { header: "算定単位", key: "unitType", width: 14 },
    { header: "単価", key: "unitPrice", width: 12 },
    { header: "金額", key: "subtotal", width: 12 },
    { header: "算定根拠", key: "evidence", width: 32 },
    { header: "警告", key: "warning", width: 28 },
    { header: "備考", key: "note", width: 28 }
  ];

  data.calculation.lines.forEach((line) => {
    sheet.addRow({
      category: categoryLabel(line.category),
      serviceName: line.serviceName,
      conditionSummary: line.conditionSummary,
      targetDates: line.targetDates.map(formatShortDate).join("、"),
      quantity: line.quantity,
      unitType: line.unitType ? labels.unitType[line.unitType] : "",
      unitPrice: line.unitPrice,
      subtotal: line.subtotal,
      evidence: line.evidence || "",
      warning: line.warning || (line.includedInTotal === false ? "合計対象外" : ""),
      note: line.note || ""
    });
  });

  styleHeader(sheet);
  sheet.getColumn("unitPrice").numFmt = '#,##0"円"';
  sheet.getColumn("subtotal").numFmt = '#,##0"円"';
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function addWarningSheet(workbook: ExcelJS.Workbook, data: MonthlyReportData): void {
  const sheet = workbook.addWorksheet("警告");
  sheet.columns = [
    { header: "種別", key: "type", width: 18 },
    { header: "内容", key: "message", width: 90 }
  ];
  sheet.addRow({ type: "注意", message: ESTIMATE_DISCLAIMER });
  if (data.pricingVersion.usesSamplePricing) {
    sheet.addRow({ type: "料金", message: SAMPLE_PRICING_DISCLAIMER });
  }
  data.calculation.warnings.forEach((warning) => {
    sheet.addRow({ type: "確認", message: warning });
  });
  styleHeader(sheet);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF143F3A" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2EF" } };
  header.alignment = { vertical: "middle", wrapText: true };
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FF9BB8B3" } },
        left: { style: "thin", color: { argb: "FF9BB8B3" } },
        bottom: { style: "thin", color: { argb: "FF9BB8B3" } },
        right: { style: "thin", color: { argb: "FF9BB8B3" } }
      };
      cell.alignment = { vertical: "top", wrapText: true };
    });
  });
}
