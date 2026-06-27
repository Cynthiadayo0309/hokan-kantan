import { defineStore } from "pinia";
import type { MonthlyCalculationResult, MonthlyEstimate, MonthlyEstimateInput, PricingVersion, SaveDailyVisitPayload } from "../../shared/types";

type State = {
  estimate: MonthlyEstimate | null;
  calculation: MonthlyCalculationResult | null;
  pricingVersion: PricingVersion | null;
  loading: boolean;
  message: string;
  error: string;
};

export const useEstimateStore = defineStore("estimate", {
  state: (): State => ({
    estimate: null,
    calculation: null,
    pricingVersion: null,
    loading: false,
    message: "",
    error: ""
  }),
  actions: {
    async load(): Promise<void> {
      this.loading = true;
      this.error = "";
      try {
        const [estimate, pricingVersion] = await Promise.all([window.hokanApi.getEstimate(), window.hokanApi.getPricingVersion()]);
        this.estimate = estimate;
        this.pricingVersion = pricingVersion;
      } catch (error) {
        this.error = getMessage(error);
      } finally {
        this.loading = false;
      }
    },
    async saveEstimate(input: MonthlyEstimateInput): Promise<void> {
      this.error = "";
      this.estimate = await window.hokanApi.saveEstimate(input);
    },
    async saveDailyVisit(payload: SaveDailyVisitPayload): Promise<void> {
      this.error = "";
      const visit = await window.hokanApi.saveDailyVisit(payload);
      await this.load();
      this.message = `${Number(visit.visitDate.slice(5, 7))}月${Number(visit.visitDate.slice(8, 10))}日の訪問内容を保存しました。`;
    },
    async deleteDailyVisit(monthlyEstimateId: number, visitDate: string): Promise<void> {
      this.error = "";
      this.estimate = await window.hokanApi.deleteDailyVisit({ monthlyEstimateId, visitDate });
      this.message = `${Number(visitDate.slice(5, 7))}月${Number(visitDate.slice(8, 10))}日の訪問内容を削除しました。`;
    },
    async calculate(): Promise<MonthlyCalculationResult> {
      if (!this.estimate) throw new Error("入力データが見つかりません。");
      this.error = "";
      this.calculation = await window.hokanApi.calculateMonthlyEstimate({ monthlyEstimateId: this.estimate.id });
      return this.calculation;
    },
    async reset(): Promise<void> {
      if (!this.estimate) return;
      this.error = "";
      this.estimate = await window.hokanApi.resetEstimate({ monthlyEstimateId: this.estimate.id });
      this.calculation = null;
      this.message = "入力内容をすべてクリアしました。";
    }
  }
});

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : "処理に失敗しました。";
}
