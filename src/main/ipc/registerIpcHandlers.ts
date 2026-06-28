import { BrowserWindow, ipcMain } from "electron";
import type {
  DeleteDailyVisitPayload,
  DailyVisitInput,
  MonthlyEstimateInput,
  MonthlyReportExportPayload,
  ResetEstimatePayload,
  SaveDailyVisitPayload,
  SaveDailyVisitsPayload
} from "../../shared/types";
import { MonthlyEstimateCalculator } from "../services/MonthlyEstimateCalculator";
import type { EstimateRepository } from "../repositories/EstimateRepository";
import { MonthlyReportExportService } from "../services/MonthlyReportExportService";
import { CustomIconService } from "../services/CustomIconService";

export function registerIpcHandlers(repository: EstimateRepository, getMainWindow: () => BrowserWindow | null = () => null): void {
  const reportExportService = new MonthlyReportExportService(repository, getMainWindow);
  const customIconService = new CustomIconService();

  ipcMain.handle("hokan:getEstimate", async () => repository.getOrCreateCurrentEstimate());

  ipcMain.handle("hokan:saveEstimate", async (_event, payload: MonthlyEstimateInput) => {
    validateEstimatePayload(payload);
    return repository.saveEstimate(payload);
  });

  ipcMain.handle("hokan:saveDailyVisit", async (_event, payload: SaveDailyVisitPayload) => {
    if (!Number.isInteger(payload.monthlyEstimateId)) {
      throw new Error("入力データが不正です。");
    }
    validateDailyVisitPayload(payload.visit);
    return repository.saveDailyVisit(payload.monthlyEstimateId, payload.visit);
  });

  ipcMain.handle("hokan:saveDailyVisits", async (_event, payload: SaveDailyVisitsPayload) => {
    if (!Number.isInteger(payload.monthlyEstimateId) || !Array.isArray(payload.visits)) {
      throw new Error("入力データが不正です。");
    }
    if (payload.visits.length < 1 || payload.visits.length > 31) {
      throw new Error("一度に保存できる日数は1日から31日までです。");
    }
    const visitDates = payload.visits.map((visit) => visit.visitDate);
    if (new Set(visitDates).size !== visitDates.length) {
      throw new Error("同じ日付が複数含まれています。");
    }
    payload.visits.forEach(validateDailyVisitPayload);
    return repository.saveDailyVisits(payload.monthlyEstimateId, payload.visits);
  });

  ipcMain.handle("hokan:deleteDailyVisit", async (_event, payload: DeleteDailyVisitPayload) => {
    if (!Number.isInteger(payload.monthlyEstimateId) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.visitDate)) {
      throw new Error("削除対象が不正です。");
    }
    return repository.deleteDailyVisit(payload.monthlyEstimateId, payload.visitDate);
  });

  ipcMain.handle("hokan:calculateMonthlyEstimate", async (_event, payload: { monthlyEstimateId: number }) => {
    if (!Number.isInteger(payload.monthlyEstimateId)) {
      throw new Error("入力データが不正です。");
    }
    const estimate = repository.getEstimate(payload.monthlyEstimateId);
    if (!estimate.patientName.trim()) {
      throw new Error("利用者名を入力してください。");
    }
    const calculator = new MonthlyEstimateCalculator(repository.getPricingRules());
    return calculator.calculate(estimate);
  });

  ipcMain.handle("hokan:resetEstimate", async (_event, payload: ResetEstimatePayload) => {
    if (!Number.isInteger(payload.monthlyEstimateId)) {
      throw new Error("入力データが不正です。");
    }
    return repository.resetEstimate(payload.monthlyEstimateId);
  });

  ipcMain.handle("hokan:getPricingVersion", async () => {
    const rules = repository.getPricingRules();
    return {
      label: rules.some((rule) => rule.samplePrice) ? "サンプル料金" : "正式料金",
      usesSamplePricing: rules.some((rule) => rule.samplePrice),
      ruleCount: rules.length
    };
  });

  ipcMain.handle("hokan:previewMonthlyReport", async (event, payload: MonthlyReportExportPayload) => {
    validateMonthlyReportPayload(payload);
    return reportExportService.preview(payload.monthlyEstimateId, BrowserWindow.fromWebContents(event.sender));
  });

  ipcMain.handle("hokan:printMonthlyReport", async (event, payload: MonthlyReportExportPayload) => {
    validateMonthlyReportPayload(payload);
    return reportExportService.print(payload.monthlyEstimateId, BrowserWindow.fromWebContents(event.sender));
  });

  ipcMain.handle("hokan:exportMonthlyReportPdf", async (event, payload: MonthlyReportExportPayload) => {
    validateMonthlyReportPayload(payload);
    return reportExportService.exportPdf(payload.monthlyEstimateId, BrowserWindow.fromWebContents(event.sender));
  });

  ipcMain.handle("hokan:exportMonthlyReportExcel", async (event, payload: MonthlyReportExportPayload) => {
    validateMonthlyReportPayload(payload);
    return reportExportService.exportExcel(payload.monthlyEstimateId, BrowserWindow.fromWebContents(event.sender));
  });

  ipcMain.handle("hokan:getIconPreference", async () => customIconService.getPreference());

  ipcMain.handle("hokan:selectCustomIcon", async (event) => customIconService.selectCustomIcon(BrowserWindow.fromWebContents(event.sender)));

  ipcMain.handle("hokan:resetCustomIcon", async () => customIconService.resetCustomIcon());
}

function validateEstimatePayload(payload: MonthlyEstimateInput): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("入力内容が不正です。");
  }
  if (!payload.targetMonth || !/^\d{4}-\d{2}$/.test(payload.targetMonth)) {
    throw new Error("対象年月を選択してください。");
  }
}

function validateDailyVisitPayload(payload: DailyVisitInput): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("訪問内容が不正です。");
  }
  if (!payload.visitDate || !/^\d{4}-\d{2}-\d{2}$/.test(payload.visitDate)) {
    throw new Error("訪問日が不正です。");
  }
  if (!Number.isInteger(payload.visitCount) || payload.visitCount < 1 || payload.visitCount > 10) {
    throw new Error("訪問回数が不正です。");
  }
  if (!Array.isArray(payload.timeSlots) || payload.timeSlots.length !== payload.visitCount) {
    throw new Error("訪問回数分の時間入力が不足しています。");
  }
}

function validateMonthlyReportPayload(payload: MonthlyReportExportPayload): void {
  if (!payload || !Number.isInteger(payload.monthlyEstimateId)) {
    throw new Error("出力対象が不正です。");
  }
}
