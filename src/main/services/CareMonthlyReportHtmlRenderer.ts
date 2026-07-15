import type { CareCalculationResult, CareEstimate, CareLineCategory, PricingVersion } from "../../shared/types";

export type CareMonthlyReportData = { estimate: CareEstimate; calculation: CareCalculationResult; pricingVersion: PricingVersion };
export const CARE_DISCLAIMER = "本計算結果は概算です。実際の算定・請求内容を保証するものではありません。";
export const CARE_SCOPE_NOTICE = "区分支給限度基準額、他サービス利用額、高額介護サービス費、公費等は計算していません。";

export function buildCareMonthlyReportHtml(data: CareMonthlyReportData): string {
  const { estimate, calculation, pricingVersion } = data;
  const rows = calculation.lines.map((line) => `<tr${line.includedInTotal ? "" : ' class="excluded"'}>
    <td>${escapeHtml(categoryLabel(line.category))}</td><td>${escapeHtml(line.serviceName)}</td>
    <td>${escapeHtml(line.conditionSummary)}</td><td>${escapeHtml(line.targetDates.map(shortDate).join("、") || "月1回")}</td>
    <td class="number">${line.quantity}</td><td class="number">${line.unitCount.toLocaleString("ja-JP")}</td>
    <td class="number">${line.subtotalUnits.toLocaleString("ja-JP")}</td><td class="number">${line.regionalUnitPrice.toFixed(2)}円</td>
    <td class="number">${yen(line.amount)}</td><td>${escapeHtml(line.warning || line.note || "")}</td></tr>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>介護保険 費用明細</title><style>
  @page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:"Yu Gothic UI",Meiryo,sans-serif;color:#143f3a;font-size:11px}
  h1{font-size:20px}.notice{padding:8px;margin:8px 0;border:1px solid #d7922a;background:#fff7e8}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}.box{border:1px solid #9bb8b3;padding:7px}.label{font-size:10px;color:#45645f}table{width:100%;border-collapse:collapse}th,td{border:1px solid #60736f;padding:5px;vertical-align:top}th{background:#e3f2ef}.number{text-align:right;white-space:nowrap}.excluded{background:#fff7e8}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.total{border:1px solid #9bb8b3;padding:8px}.value{text-align:right;font-size:15px;font-weight:bold}
  </style></head><body><h1>訪看かんたん計算 介護保険 ${formatMonth(estimate.targetMonth)} 費用明細</h1>
  <div class="notice">${escapeHtml(CARE_DISCLAIMER)}</div><div class="notice">${escapeHtml(CARE_SCOPE_NOTICE)}</div>
  <section class="meta">${meta("利用者名",estimate.patientName)}${meta("施設名",estimate.facilityName||"未入力")}${meta("対象年月",formatMonth(estimate.targetMonth))}${meta("認定区分",estimate.careClassification==="care"?"要介護":"要支援")}${meta("自己負担割合",copaymentLabel(estimate.copaymentRate))}${meta("地域区分",regionalLabel(estimate.regionalGrade))}${meta("地域単価",`${calculation.totals.regionalUnitPrice.toFixed(2)}円`)}${meta("料金版",pricingVersion.label)}</section>
  ${calculation.warnings.length?`<div class="notice"><strong>警告・確認事項</strong><ul>${calculation.warnings.map(w=>`<li>${escapeHtml(w)}</li>`).join("")}</ul></div>`:""}
  <table><thead><tr><th>区分</th><th>サービス内容</th><th>算定条件</th><th>対象日</th><th>回数</th><th>単位/回</th><th>単位小計</th><th>地域単価</th><th>金額</th><th>警告・備考</th></tr></thead><tbody>${rows||'<tr><td colspan="10">明細がありません。</td></tr>'}</tbody></table>
  <section class="totals">${total("基本報酬",`${calculation.totals.basicUnits.toLocaleString("ja-JP")}単位`)}${total("加算",`${calculation.totals.additionUnits.toLocaleString("ja-JP")}単位`)}${total("減算",`${calculation.totals.deductionUnits.toLocaleString("ja-JP")}単位`)}${total("合計",`${calculation.totals.totalUnits.toLocaleString("ja-JP")}単位`)}${total("月額費用総額",yen(calculation.totals.grandTotal))}${calculation.totals.copaymentAmount===undefined?"":total("利用者負担額の概算",yen(calculation.totals.copaymentAmount))}</section></body></html>`;
}

export function categoryLabel(value: CareLineCategory): string { return value === "basic" ? "基本報酬" : value === "addition" ? "加算" : "減算"; }
export function formatMonth(value: string): string { const [y,m]=value.split("-"); return `${y}年${Number(m)}月`; }
function shortDate(value:string):string{return `${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`}
function yen(value:number):string{return `${value.toLocaleString("ja-JP")}円`}
function meta(label:string,value:string):string{return `<div class="box"><div class="label">${escapeHtml(label)}</div><strong>${escapeHtml(value)}</strong></div>`}
function total(label:string,value:string):string{return `<div class="total"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`}
function copaymentLabel(value:CareEstimate["copaymentRate"]):string{return value==="unset"?"未設定":`${Number(value)/10}割`}
function regionalLabel(value:CareEstimate["regionalGrade"]):string{return value==="other"?"その他":`${value.slice(-1)}級地`}
function escapeHtml(value:string):string{return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;")}
