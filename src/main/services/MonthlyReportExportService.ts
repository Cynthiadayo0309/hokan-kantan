import { BrowserWindow, dialog, type SaveDialogOptions, type SaveDialogReturnValue } from "electron";
import { writeFile } from "node:fs/promises";
import type { MonthlyReportExportResult, PricingVersion } from "../../shared/types";
import type { EstimateRepository } from "../repositories/EstimateRepository";
import { MonthlyEstimateCalculator } from "./MonthlyEstimateCalculator";
import { buildMonthlyReportExcelBuffer } from "./MonthlyReportExcelExporter";
import { buildMonthlyReportHtml, type MonthlyReportData } from "./MonthlyReportHtmlRenderer";

export class MonthlyReportExportService {
  constructor(
    private readonly repository: EstimateRepository,
    private readonly getMainWindow: () => BrowserWindow | null
  ) {}

  async preview(monthlyEstimateId: number, owner?: BrowserWindow | null): Promise<void> {
    const data = this.buildReportData(monthlyEstimateId);
    const previewWindow = this.createReportWindow(owner ?? this.getMainWindow(), true);
    await previewWindow.loadURL(toDataUrl(buildMonthlyReportHtml(data)));
  }

  async print(monthlyEstimateId: number, owner?: BrowserWindow | null): Promise<MonthlyReportExportResult> {
    const data = this.buildReportData(monthlyEstimateId);
    const printWindow = this.createReportWindow(owner ?? this.getMainWindow(), false);
    await printWindow.loadURL(toDataUrl(buildMonthlyReportHtml(data)));

    return new Promise((resolve) => {
      printWindow.webContents.print({ printBackground: true, landscape: true }, (success) => {
        printWindow.destroy();
        resolve({ canceled: !success });
      });
    });
  }

  async exportPdf(monthlyEstimateId: number, owner?: BrowserWindow | null): Promise<MonthlyReportExportResult> {
    const data = this.buildReportData(monthlyEstimateId);
    const saveResult = await showSaveDialog(owner ?? this.getMainWindow(), {
      title: "PDFとして保存",
      defaultPath: `${monthlyReportFileBaseName(data)}.pdf`,
      filters: [{ name: "PDFファイル", extensions: ["pdf"] }]
    });
    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const pdfWindow = this.createReportWindow(owner ?? this.getMainWindow(), false);
    try {
      await pdfWindow.loadURL(toDataUrl(buildMonthlyReportHtml(data)));
      const pdf = await pdfWindow.webContents.printToPDF({
        landscape: true,
        printBackground: true,
        pageSize: "A4",
        margins: { marginType: "default" }
      });
      await writeFile(saveResult.filePath, pdf);
      return { canceled: false, filePath: saveResult.filePath };
    } finally {
      pdfWindow.destroy();
    }
  }

  async exportExcel(monthlyEstimateId: number, owner?: BrowserWindow | null): Promise<MonthlyReportExportResult> {
    const data = this.buildReportData(monthlyEstimateId);
    const saveResult = await showSaveDialog(owner ?? this.getMainWindow(), {
      title: "Excelとして保存",
      defaultPath: `${monthlyReportFileBaseName(data)}.xlsx`,
      filters: [{ name: "Excelファイル", extensions: ["xlsx"] }]
    });
    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const buffer = await buildMonthlyReportExcelBuffer(data);
    await writeFile(saveResult.filePath, buffer);
    return { canceled: false, filePath: saveResult.filePath };
  }

  private buildReportData(monthlyEstimateId: number): MonthlyReportData {
    const estimate = this.repository.getEstimate(monthlyEstimateId);
    if (!estimate.patientName.trim()) {
      throw new Error("利用者名を入力してください。");
    }
    const pricingRules = this.repository.getPricingRules();
    const calculator = new MonthlyEstimateCalculator(pricingRules);
    const pricingVersion: PricingVersion = {
      label: pricingRules.some((rule) => rule.samplePrice) ? "サンプル料金" : "正式料金",
      usesSamplePricing: pricingRules.some((rule) => rule.samplePrice),
      ruleCount: pricingRules.length
    };
    return {
      estimate,
      calculation: calculator.calculate(estimate),
      pricingVersion
    };
  }

  private createReportWindow(owner: BrowserWindow | null, show: boolean): BrowserWindow {
    return new BrowserWindow({
      width: 1180,
      height: 820,
      show,
      parent: owner ?? undefined,
      title: "費用明細プレビュー",
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
  }
}

export function monthlyReportFileBaseName(data: MonthlyReportData): string {
  const patientName = sanitizeFileName(data.estimate.patientName.trim() || "利用者");
  return `訪看かんたん計算_${patientName}_${data.estimate.targetMonth}_費用明細`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 60);
}

function toDataUrl(html: string): string {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function showSaveDialog(owner: BrowserWindow | null, options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
  return owner ? dialog.showSaveDialog(owner, options) : dialog.showSaveDialog(options);
}
