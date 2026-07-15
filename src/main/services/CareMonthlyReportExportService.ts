import { BrowserWindow, dialog, type SaveDialogOptions, type SaveDialogReturnValue } from "electron";
import { writeFile } from "node:fs/promises";
import type { MonthlyReportExportResult, PricingVersion } from "../../shared/types";
import type { CareEstimateRepository } from "../repositories/CareEstimateRepository";
import { CareMonthlyEstimateCalculator } from "./CareMonthlyEstimateCalculator";
import { buildCareMonthlyReportExcelBuffer } from "./CareMonthlyReportExcelExporter";
import { buildCareMonthlyReportHtml, type CareMonthlyReportData } from "./CareMonthlyReportHtmlRenderer";
import { carePricingVersion } from "./CarePricingRuleResolver";

export class CareMonthlyReportExportService {
  constructor(private readonly repository:CareEstimateRepository,private readonly getMainWindow:()=>BrowserWindow|null){}
  async preview(id:number,owner?:BrowserWindow|null):Promise<void>{const data=this.build(id);const win=this.window(owner??this.getMainWindow(),true);await win.loadURL(toDataUrl(buildCareMonthlyReportHtml(data)))}
  async print(id:number,owner?:BrowserWindow|null):Promise<MonthlyReportExportResult>{const data=this.build(id);const win=this.window(owner??this.getMainWindow(),false);await win.loadURL(toDataUrl(buildCareMonthlyReportHtml(data)));return new Promise(resolve=>win.webContents.print({printBackground:true,landscape:true},success=>{win.destroy();resolve({canceled:!success})}))}
  async exportPdf(id:number,owner?:BrowserWindow|null):Promise<MonthlyReportExportResult>{const data=this.build(id);const result=await saveDialog(owner??this.getMainWindow(),{title:"介護保険費用明細をPDFとして保存",defaultPath:`${baseName(data)}.pdf`,filters:[{name:"PDFファイル",extensions:["pdf"]}]});if(result.canceled||!result.filePath)return{canceled:true};const win=this.window(owner??this.getMainWindow(),false);try{await win.loadURL(toDataUrl(buildCareMonthlyReportHtml(data)));const pdf=await win.webContents.printToPDF({landscape:true,printBackground:true,pageSize:"A4",margins:{marginType:"default"}});await writeFile(result.filePath,pdf);return{canceled:false,filePath:result.filePath}}finally{win.destroy()}}
  async exportExcel(id:number,owner?:BrowserWindow|null):Promise<MonthlyReportExportResult>{const data=this.build(id);const result=await saveDialog(owner??this.getMainWindow(),{title:"介護保険費用明細をExcelとして保存",defaultPath:`${baseName(data)}.xlsx`,filters:[{name:"Excelファイル",extensions:["xlsx"]}]});if(result.canceled||!result.filePath)return{canceled:true};await writeFile(result.filePath,await buildCareMonthlyReportExcelBuffer(data));return{canceled:false,filePath:result.filePath}}
  private build(id:number):CareMonthlyReportData{const estimate=this.repository.getEstimate(id);const rules=this.repository.getPricingRules();const rate=this.repository.getRegionalRate(estimate.regionalGrade,`${estimate.targetMonth}-01`);const calculation=new CareMonthlyEstimateCalculator(rules).calculate(estimate,rate);const pricingVersion:PricingVersion=carePricingVersion(estimate.targetMonth,rules.length);return{estimate,calculation,pricingVersion}}
  private window(owner:BrowserWindow|null,show:boolean):BrowserWindow{return new BrowserWindow({width:1180,height:820,show,parent:owner??undefined,title:"介護保険 費用明細プレビュー",backgroundColor:"#fff",webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}})}
}
function baseName(data:CareMonthlyReportData):string{return `訪看かんたん計算_${(data.estimate.patientName.trim()||"利用者").replace(/[<>:"/\\|?*\u0000-\u001f]/g,"_").slice(0,60)}_${data.estimate.targetMonth}_介護保険費用明細`}
function toDataUrl(html:string):string{return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`}
function saveDialog(owner:BrowserWindow|null,options:SaveDialogOptions):Promise<SaveDialogReturnValue>{return owner?dialog.showSaveDialog(owner,options):dialog.showSaveDialog(options)}
