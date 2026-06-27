import { contextBridge, ipcRenderer } from "electron";
import type {
  DeleteDailyVisitPayload,
  HokanApi,
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
  getPricingVersion: () => ipcRenderer.invoke("hokan:getPricingVersion")
};

contextBridge.exposeInMainWorld("hokanApi", api);
