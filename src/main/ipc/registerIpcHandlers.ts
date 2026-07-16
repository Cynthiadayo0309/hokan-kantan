import { BrowserWindow, ipcMain } from "electron";
import type {
  CalculateMonthlyEstimatePayload,
  DeleteDailyVisitPayload,
  DailyVisitInput,
  MonthlyEstimateInput,
  MonthlyReportExportPayload,
  ResetEstimatePayload,
  SaveDailyVisitPayload,
  SaveDailyVisitsPayload,
  SaveCareDayPayload,
  SaveCareDaysPayload
} from "../../shared/types";
import { MonthlyEstimateCalculator } from "../services/MonthlyEstimateCalculator";
import type { EstimateRepository } from "../repositories/EstimateRepository";
import { MonthlyReportExportService } from "../services/MonthlyReportExportService";
import { CustomIconService } from "../services/CustomIconService";
import type { CareEstimateRepository } from "../repositories/CareEstimateRepository";
import { CareMonthlyEstimateCalculator } from "../services/CareMonthlyEstimateCalculator";
import { CareMonthlyReportExportService } from "../services/CareMonthlyReportExportService";
import { carePricingVersion } from "../services/CarePricingRuleResolver";

export function registerIpcHandlers(
  repository: EstimateRepository,
  careRepository: CareEstimateRepository,
  getMainWindow: () => BrowserWindow | null = () => null
): void {
  const reportExportService = new MonthlyReportExportService(repository, getMainWindow);
  const careReportExportService = new CareMonthlyReportExportService(careRepository, getMainWindow);
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

  ipcMain.handle("hokan:calculateMonthlyEstimate", async (_event, payload: CalculateMonthlyEstimatePayload) => {
    if (!Number.isInteger(payload.monthlyEstimateId)) {
      throw new Error("入力データが不正です。");
    }
    validateCalculationPeriodPayload(payload);
    const estimate = repository.getEstimate(payload.monthlyEstimateId);
    if (!estimate.patientName.trim()) {
      throw new Error("利用者名を入力してください。");
    }
    const calculator = new MonthlyEstimateCalculator(repository.getPricingRules());
    return calculator.calculate(estimate, { startDate: payload.startDate, endDate: payload.endDate });
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

  ipcMain.handle("hokan:getCareEstimate", async () => careRepository.getOrCreateCurrentEstimate());

  ipcMain.handle("hokan:saveCareEstimate", async (_event, payload) => {
    validateCareEstimatePayload(payload);
    return careRepository.saveEstimate(payload);
  });

  ipcMain.handle("hokan:saveCareDay", async (_event, payload: SaveCareDayPayload) => {
    if (!payload || !Number.isInteger(payload.careEstimateId) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.visitDate) || !Array.isArray(payload.services)) {
      throw new Error("介護保険の訪問内容が不正です。");
    }
    return careRepository.saveDay(payload.careEstimateId, payload.visitDate, payload.services);
  });

  ipcMain.handle("hokan:saveCareDays", async (_event, payload: SaveCareDaysPayload) => {
    validateCareDaysPayload(payload);
    return careRepository.saveDays(payload.careEstimateId, payload.days);
  });

  ipcMain.handle("hokan:deleteCareDay", async (_event, payload) => {
    if (!payload || !Number.isInteger(payload.careEstimateId) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.visitDate)) {
      throw new Error("削除対象が不正です。");
    }
    return careRepository.deleteDay(payload.careEstimateId, payload.visitDate);
  });

  ipcMain.handle("hokan:calculateCareMonthlyEstimate", async (_event, payload) => {
    if (!payload || !Number.isInteger(payload.careEstimateId)) throw new Error("入力データが不正です。");
    const estimate = careRepository.getEstimate(payload.careEstimateId);
    const rate = careRepository.getRegionalRate(estimate.regionalGrade, `${estimate.targetMonth}-01`);
    return new CareMonthlyEstimateCalculator(careRepository.getPricingRules()).calculate(estimate, rate);
  });

  ipcMain.handle("hokan:resetCareEstimate", async (_event, payload) => {
    if (!payload || !Number.isInteger(payload.careEstimateId)) throw new Error("入力データが不正です。");
    return careRepository.resetEstimate(payload.careEstimateId);
  });

  ipcMain.handle("hokan:getCarePricingVersion", async () => {
    const estimate = careRepository.getOrCreateCurrentEstimate();
    return carePricingVersion(estimate.targetMonth, careRepository.getPricingRules().length);
  });

  ipcMain.handle("hokan:previewCareMonthlyReport", async (event, payload) => {
    validateCareReportPayload(payload);
    return careReportExportService.preview(payload.careEstimateId, BrowserWindow.fromWebContents(event.sender));
  });
  ipcMain.handle("hokan:printCareMonthlyReport", async (event, payload) => {
    validateCareReportPayload(payload);
    return careReportExportService.print(payload.careEstimateId, BrowserWindow.fromWebContents(event.sender));
  });
  ipcMain.handle("hokan:exportCareMonthlyReportPdf", async (event, payload) => {
    validateCareReportPayload(payload);
    return careReportExportService.exportPdf(payload.careEstimateId, BrowserWindow.fromWebContents(event.sender));
  });
  ipcMain.handle("hokan:exportCareMonthlyReportExcel", async (event, payload) => {
    validateCareReportPayload(payload);
    return careReportExportService.exportExcel(payload.careEstimateId, BrowserWindow.fromWebContents(event.sender));
  });
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

function validateCalculationPeriodPayload(payload: CalculateMonthlyEstimatePayload): void {
  if ((payload.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.startDate)) || (payload.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(payload.endDate))) {
    throw new Error("計算対象期間が不正です。");
  }
  if (payload.startDate && payload.endDate && payload.endDate < payload.startDate) {
    throw new Error("計算対象期間の終了日は開始日以降の日付を選択してください。");
  }
}

function validateMonthlyReportPayload(payload: MonthlyReportExportPayload): void {
  if (!payload || !Number.isInteger(payload.monthlyEstimateId)) {
    throw new Error("出力対象が不正です。");
  }
}

function validateCareEstimatePayload(payload: any): void {
  if (!payload || typeof payload !== "object" || !/^\d{4}-\d{2}$/.test(payload.targetMonth)) {
    throw new Error("介護保険の入力内容が不正です。");
  }
  if (!['care', 'support'].includes(payload.careClassification)) throw new Error("認定区分を選択してください。");
  if (!['unset', '10', '20', '30'].includes(payload.copaymentRate)) throw new Error("自己負担割合が不正です。");
  if (payload.initialAddition !== 'none' && payload.dischargeJointGuidance) {
    throw new Error("初回加算と退院時共同指導加算は同時に選択できません。");
  }
}

function validateCareDaysPayload(payload: SaveCareDaysPayload): void {
  if (!payload || !Number.isInteger(payload.careEstimateId) || !Array.isArray(payload.days)) {
    throw new Error("介護保険のコピー内容が不正です。");
  }
  if (payload.days.length < 1 || payload.days.length > 31) {
    throw new Error("一度に保存できる日数は1日から31日までです。");
  }
  const dates = payload.days.map((day) => day?.visitDate);
  if (dates.some((date) => !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) || new Set(dates).size !== dates.length) {
    throw new Error("コピー先の日付が不正です。");
  }
  if (payload.days.some((day) => !day || typeof day !== "object" || !Array.isArray(day.services))) {
    throw new Error("コピーするサービス内容が不正です。");
  }
}

function validateCareReportPayload(payload: any): void {
  if (!payload || !Number.isInteger(payload.careEstimateId)) throw new Error("出力対象が不正です。");
}
