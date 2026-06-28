import type { MonthlyCalculationResult, MonthlyEstimate, PricingCategory, PricingVersion } from "../../shared/types";
import { labels } from "../../shared/types";

export const ESTIMATE_DISCLAIMER = "本計算結果は概算です。実際の算定・請求内容を保証するものではありません。";
export const SAMPLE_PRICING_DISCLAIMER = "現在はサンプル料金を使用しています。正式な費用計算には料金マスターの更新が必要です。";

export type MonthlyReportData = {
  estimate: MonthlyEstimate;
  calculation: MonthlyCalculationResult;
  pricingVersion: PricingVersion;
};

export function buildMonthlyReportHtml(data: MonthlyReportData): string {
  const { estimate, calculation, pricingVersion } = data;
  const warnings = [...calculation.warnings];
  if (pricingVersion.usesSamplePricing && !warnings.includes(SAMPLE_PRICING_DISCLAIMER)) {
    warnings.unshift(SAMPLE_PRICING_DISCLAIMER);
  }

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(reportTitle(estimate))}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #143f3a;
      background: #ffffff;
      font-family: "Yu Gothic UI", "Meiryo", "Segoe UI", sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    h1 { margin: 0 0 8px; font-size: 20px; }
    h2 { margin: 16px 0 8px; font-size: 14px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 6px;
      margin: 10px 0;
    }
    .meta-item {
      min-height: 44px;
      padding: 6px 8px;
      border: 1px solid #9bb8b3;
      border-radius: 4px;
    }
    .meta-label { color: #45645f; font-size: 10px; }
    .meta-value { margin-top: 2px; font-weight: 700; }
    .notice {
      margin: 8px 0;
      padding: 8px 10px;
      border: 1px solid #d7922a;
      border-radius: 4px;
      background: #fff7e8;
      color: #5b3d00;
      font-weight: 700;
    }
    .warning-list {
      margin: 8px 0;
      padding: 8px 10px;
      border: 1px solid #d7922a;
      border-radius: 4px;
      background: #fffaf0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td {
      border: 1px solid #60736f;
      padding: 5px 6px;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: #e3f2ef;
      font-weight: 700;
      text-align: left;
    }
    .amount { text-align: right; white-space: nowrap; }
    .excluded { background: #fff7e8; }
    .totals {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-top: 10px;
    }
    .total-box {
      padding: 8px;
      border: 1px solid #9bb8b3;
      border-radius: 4px;
    }
    .total-label { color: #45645f; font-size: 10px; }
    .total-value { margin-top: 4px; font-size: 15px; font-weight: 800; text-align: right; }
    .footer { margin-top: 12px; color: #45645f; font-size: 10px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(reportTitle(estimate))}</h1>
  <div class="notice">${escapeHtml(ESTIMATE_DISCLAIMER)}</div>
  ${pricingVersion.usesSamplePricing ? `<div class="notice">${escapeHtml(SAMPLE_PRICING_DISCLAIMER)}</div>` : ""}
  <section class="meta-grid">
    ${metaItem("利用者名", estimate.patientName)}
    ${metaItem("施設名", estimate.facilityName || "未入力")}
    ${metaItem("対象年月", formatMonth(estimate.targetMonth))}
    ${metaItem("同一建物人数区分", labels.sameBuildingCategory[estimate.sameBuildingCategory])}
    ${metaItem("自己負担割合", labels.copaymentRate[estimate.copaymentRate])}
    ${metaItem("基本療養費", "Ⅱ")}
    ${metaItem("ステーション区分", labels.stationCategory[estimate.stationCategory])}
    ${metaItem("管理療養費用人数区分", labels.singleBuildingResidentCategory[estimate.singleBuildingResidentCategory])}
    ${metaItem("特別管理加算", labels.specialManagementCategory[estimate.specialManagementCategory])}
    ${metaItem("高額療養費自己負担限度額", labels.highCostCareLimitCategory[estimate.highCostCareLimitCategory])}
  </section>
  ${warnings.length ? `<section class="warning-list"><strong>警告・確認事項</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>` : ""}
  <h2>費用明細</h2>
  <table>
    <thead>
      <tr>
        <th>区分</th>
        <th>サービス内容</th>
        <th>算定条件</th>
        <th>対象日</th>
        <th>算定回数</th>
        <th>算定単位</th>
        <th>単価</th>
        <th>金額</th>
        <th>算定根拠</th>
        <th>警告</th>
        <th>備考</th>
      </tr>
    </thead>
    <tbody>
      ${calculation.lines.length ? calculation.lines.map(lineRow).join("") : `<tr><td colspan="11">明細がありません。</td></tr>`}
    </tbody>
  </table>
  <section class="totals">
    ${totalItem("訪問看護基本療養費合計", yen(calculation.totals.basic))}
    ${totalItem("訪問看護管理療養費合計", yen(calculation.totals.management))}
    ${totalItem("各種加算合計", yen(calculation.totals.additions))}
    ${totalItem("月額費用総額", yen(calculation.totals.grandTotal))}
    ${calculation.totals.copaymentAmountBeforeLimit !== undefined ? totalItem("上限適用前の利用者負担額", yen(calculation.totals.copaymentAmountBeforeLimit)) : ""}
    ${calculation.totals.highCostCareLimitAmount !== undefined ? totalItem("高額療養費自己負担限度額", yen(calculation.totals.highCostCareLimitAmount)) : ""}
    ${calculation.totals.copaymentAmount !== undefined ? totalItem(calculation.totals.highCostCareLimitAmount !== undefined ? "高額療養費上限適用後の利用者負担額" : "利用者負担額の概算", yen(calculation.totals.copaymentAmount)) : ""}
  </section>
  <div class="footer">出力日時：${escapeHtml(new Date().toLocaleString("ja-JP"))}</div>
</body>
</html>`;
}

export function reportTitle(estimate: MonthlyEstimate): string {
  return `訪看かんたん計算 ${formatMonth(estimate.targetMonth)} 費用明細`;
}

export function formatMonth(targetMonth: string): string {
  const [year, month] = targetMonth.split("-");
  return `${year}年${Number(month)}月`;
}

export function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

export function categoryLabel(category: PricingCategory): string {
  return category === "basic" ? "基本療養費" : category === "management" ? "管理療養費" : "加算";
}

export function formatShortDate(value: string): string {
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
}

function metaItem(label: string, value: string): string {
  return `<div class="meta-item"><div class="meta-label">${escapeHtml(label)}</div><div class="meta-value">${escapeHtml(value)}</div></div>`;
}

function totalItem(label: string, value: string): string {
  return `<div class="total-box"><div class="total-label">${escapeHtml(label)}</div><div class="total-value">${escapeHtml(value)}</div></div>`;
}

function lineRow(line: MonthlyCalculationResult["lines"][number]): string {
  const warning = line.warning || (line.includedInTotal === false ? "合計対象外" : "");
  return `<tr${line.includedInTotal === false ? ` class="excluded"` : ""}>
    <td>${escapeHtml(categoryLabel(line.category))}</td>
    <td>${escapeHtml(line.serviceName)}</td>
    <td>${escapeHtml(line.conditionSummary)}</td>
    <td>${escapeHtml(line.targetDates.map(formatShortDate).join("、"))}</td>
    <td class="amount">${escapeHtml(String(line.quantity))}</td>
    <td>${escapeHtml(line.unitType ? labels.unitType[line.unitType] : "")}</td>
    <td class="amount">${escapeHtml(yen(line.unitPrice))}</td>
    <td class="amount">${escapeHtml(yen(line.subtotal))}</td>
    <td>${escapeHtml(line.evidence || "")}</td>
    <td>${escapeHtml(warning)}</td>
    <td>${escapeHtml(line.note || "")}</td>
  </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
