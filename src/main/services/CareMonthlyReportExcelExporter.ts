import ExcelJS from "exceljs";
import type { CareMonthlyReportData } from "./CareMonthlyReportHtmlRenderer";
import { CARE_DISCLAIMER, CARE_SCOPE_NOTICE, categoryLabel, formatMonth } from "./CareMonthlyReportHtmlRenderer";

export async function buildCareMonthlyReportExcelBuffer(data: CareMonthlyReportData): Promise<Buffer> {
  const workbook = buildCareMonthlyReportWorkbook(data);
  const buffer=await workbook.xlsx.writeBuffer(); return Buffer.from(buffer);
}

export function buildCareMonthlyReportWorkbook(data: CareMonthlyReportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const summary = workbook.addWorksheet("概要");
  summary.columns = [{header:"項目",key:"label",width:30},{header:"内容",key:"value",width:50}];
  summary.addRows([
    {label:"注意",value:CARE_DISCLAIMER},{label:"対象外",value:CARE_SCOPE_NOTICE},{label:"保険種別",value:"介護保険"},
    {label:"利用者名",value:data.estimate.patientName},{label:"施設名",value:data.estimate.facilityName||"未入力"},{label:"対象年月",value:formatMonth(data.estimate.targetMonth)},
    {label:"認定区分",value:data.estimate.careClassification==="care"?"要介護":"要支援"},{label:"料金版",value:data.pricingVersion.label},
    {label:"合計単位",value:data.calculation.totals.totalUnits},{label:"地域単価",value:data.calculation.totals.regionalUnitPrice},
    {label:"月額費用総額",value:data.calculation.totals.grandTotal},...(data.calculation.totals.copaymentAmount===undefined?[]:[{label:"利用者負担額の概算",value:data.calculation.totals.copaymentAmount}])
  ]);
  style(summary);

  const detail = workbook.addWorksheet("費用明細");
  detail.columns = [
    {header:"区分",key:"category",width:12},{header:"サービス内容",key:"serviceName",width:34},{header:"算定条件",key:"condition",width:34},
    {header:"対象日",key:"dates",width:20},{header:"回数",key:"quantity",width:9},{header:"単位/回",key:"unitCount",width:12},
    {header:"単位小計",key:"subtotalUnits",width:12},{header:"地域単価",key:"rate",width:12},{header:"金額",key:"amount",width:14},{header:"警告・備考",key:"warning",width:40}
  ];
  data.calculation.lines.forEach(line=>detail.addRow({category:categoryLabel(line.category),serviceName:line.serviceName,condition:line.conditionSummary,dates:line.targetDates.join("、")||"月1回",quantity:line.quantity,unitCount:line.unitCount,subtotalUnits:line.subtotalUnits,rate:line.regionalUnitPrice,amount:line.amount,warning:line.warning||line.note||""}));
  style(detail);

  const warning = workbook.addWorksheet("警告"); warning.columns=[{header:"種別",key:"type",width:18},{header:"内容",key:"message",width:100}];
  warning.addRow({type:"注意",message:CARE_DISCLAIMER}); warning.addRow({type:"対象外",message:CARE_SCOPE_NOTICE}); data.calculation.warnings.forEach(message=>warning.addRow({type:"確認",message})); style(warning);
  return workbook;
}

function style(sheet:ExcelJS.Worksheet):void{const header=sheet.getRow(1);header.font={bold:true,color:{argb:"FF143F3A"}};header.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE3F2EF"}};sheet.views=[{state:"frozen",ySplit:1}];sheet.eachRow(row=>row.eachCell(cell=>{cell.alignment={vertical:"top",wrapText:true};cell.border={top:{style:"thin",color:{argb:"FF9BB8B3"}},left:{style:"thin",color:{argb:"FF9BB8B3"}},bottom:{style:"thin",color:{argb:"FF9BB8B3"}},right:{style:"thin",color:{argb:"FF9BB8B3"}}}}))}
