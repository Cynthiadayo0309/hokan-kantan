import { contextBridge, ipcRenderer } from "electron";
import type {
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
  calculateMonthlyEstimate: (payload: { monthlyEstimateId: number }) => ipcRenderer.invoke("hokan:calculateMonthlyEstimate", payload),
  resetEstimate: (payload: ResetEstimatePayload) => ipcRenderer.invoke("hokan:resetEstimate", payload),
  getPricingVersion: () => ipcRenderer.invoke("hokan:getPricingVersion"),
  previewMonthlyReport: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:previewMonthlyReport", payload),
  printMonthlyReport: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:printMonthlyReport", payload),
  exportMonthlyReportPdf: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:exportMonthlyReportPdf", payload),
  exportMonthlyReportExcel: (payload: MonthlyReportExportPayload) => ipcRenderer.invoke("hokan:exportMonthlyReportExcel", payload),
  getIconPreference: () => ipcRenderer.invoke("hokan:getIconPreference"),
  selectCustomIcon: () => ipcRenderer.invoke("hokan:selectCustomIcon"),
  resetCustomIcon: () => ipcRenderer.invoke("hokan:resetCustomIcon")
};

contextBridge.exposeInMainWorld("hokanApi", api);
