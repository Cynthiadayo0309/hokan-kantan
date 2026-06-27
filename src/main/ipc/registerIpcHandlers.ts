import { ipcMain } from "electron";
import type { DeleteDailyVisitPayload, MonthlyEstimateInput, ResetEstimatePayload, SaveDailyVisitPayload } from "../../shared/types";
import { MonthlyEstimateCalculator } from "../services/MonthlyEstimateCalculator";
import type { EstimateRepository } from "../repositories/EstimateRepository";

export function registerIpcHandlers(repository: EstimateRepository): void {
  ipcMain.handle("hokan:getEstimate", async () => repository.getOrCreateCurrentEstimate());

  ipcMain.handle("hokan:saveEstimate", async (_event, payload: MonthlyEstimateInput) => {
    validateEstimatePayload(payload);
    return repository.saveEstimate(payload);
  });

  ipcMain.handle("hokan:saveDailyVisit", async (_event, payload: SaveDailyVisitPayload) => {
    if (!Number.isInteger(payload.monthlyEstimateId)) {
      throw new Error("入力データが不正です。");
    }
    return repository.saveDailyVisit(payload.monthlyEstimateId, payload.visit);
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
}

function validateEstimatePayload(payload: MonthlyEstimateInput): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("入力内容が不正です。");
  }
  if (!payload.targetMonth || !/^\d{4}-\d{2}$/.test(payload.targetMonth)) {
    throw new Error("対象年月を選択してください。");
  }
}
