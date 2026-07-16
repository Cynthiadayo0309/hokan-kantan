import { contextBridge, ipcRenderer } from "electron";
import type {
  CalculateMonthlyEstimatePayload,
  DeleteDailyVisitPayload,
  HokanApi,
  MonthlyReportExportPayload,
  MonthlyEstimateInput,
  ResetEstimatePayload,
  SaveDailyVisitPayload,
  SaveDailyVisitsPayload
} from "../shared/types";

const api: HokanApi = {
  getEstimate: () => ipcRenderer.invoke("hokan:getEstimate"),
  saveEstimate: (payload: MonthlyEstimateInput) => ipcRenderer.invoke("hokan:saveEstimate", payload),
  saveDailyVisit: (payload: SaveDailyVisitPayload) => ipcRenderer.invoke("hokan:saveDailyVisit", payload),
  saveDailyVisits: (payload: SaveDailyVisitsPayload) => ipcRenderer.invoke("hokan:saveDailyVisits", payload),
  deleteDailyVisit: (payload: DeleteDailyVisitPayload) => ipcRenderer.invoke("hokan:deleteDailyVisit", payload),
  calculateMonthlyEstimate: (payload: CalculateMonthlyEstimatePayload) => ipcRenderer.invoke("hokan:calculateMonthlyEstimate", payload),
  resetEstimate: (payload: ResetEstimatePayload) => ipcRenderer.invoke("hokan:resetEstimate", payload),
  getPricingVersion: () => ipcRenderer.invoke("hokan:getPricingVersion"),
  previewMonthlyReport: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:previewMonthlyReport", payload),
  printMonthlyReport: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:printMonthlyReport", payload),
  exportMonthlyReportPdf: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:exportMonthlyReportPdf", payload),
  exportMonthlyReportExcel: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:exportMonthlyReportExcel", payload),
  getIconPreference: () => ipcRenderer.invoke("hokan:getIconPreference"),
  selectCustomIcon: () => ipcRenderer.invoke("hokan:selectCustomIcon"),
  resetCustomIcon: () => ipcRenderer.invoke("hokan:resetCustomIcon"),
  getCareEstimate: () => ipcRenderer.invoke("hokan:getCareEstimate"),
  saveCareEstimate: (payload) => ipcRenderer.invoke("hokan:saveCareEstimate", payload),
  saveCareDay: (payload) => ipcRenderer.invoke("hokan:saveCareDay", payload),
  saveCareDays: (payload) => ipcRenderer.invoke("hokan:saveCareDays", payload),
  deleteCareDay: (payload) => ipcRenderer.invoke("hokan:deleteCareDay", payload),
  calculateCareMonthlyEstimate: (payload) => ipcRenderer.invoke("hokan:calculateCareMonthlyEstimate", payload),
  resetCareEstimate: (payload) => ipcRenderer.invoke("hokan:resetCareEstimate", payload),
  getCarePricingVersion: () => ipcRenderer.invoke("hokan:getCarePricingVersion"),
  previewCareMonthlyReport: (payload) => ipcRenderer.invoke("hokan:previewCareMonthlyReport", payload),
  printCareMonthlyReport: (payload) => ipcRenderer.invoke("hokan:printCareMonthlyReport", payload),
  exportCareMonthlyReportPdf: (payload) => ipcRenderer.invoke("hokan:exportCareMonthlyReportPdf", payload),
  exportCareMonthlyReportExcel: (payload) => ipcRenderer.invoke("hokan:exportCareMonthlyReportExcel", payload)
};

contextBridge.exposeInMainWorld("hokanApi", api);
