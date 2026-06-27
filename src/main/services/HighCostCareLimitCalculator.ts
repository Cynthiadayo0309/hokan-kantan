import type { HighCostCareLimitCategory } from "../../shared/types";

export type HighCostCareLimitResult = {
  limitAmount?: number;
  appliedAmount?: number;
  applied: boolean;
};

export function calculateHighCostCareLimit(totalMedicalCost: number, copaymentAmount: number | undefined, category: HighCostCareLimitCategory): HighCostCareLimitResult {
  if (copaymentAmount === undefined || category === "unset") {
    return { applied: false };
  }

  const limitAmount = calculateLimitAmount(totalMedicalCost, category);
  const appliedAmount = Math.min(copaymentAmount, limitAmount);
  return {
    limitAmount,
    appliedAmount,
    applied: appliedAmount < copaymentAmount
  };
}

export function calculateLimitAmount(totalMedicalCost: number, category: Exclude<HighCostCareLimitCategory, "unset">): number {
  switch (category) {
    case "active_income_3":
      return Math.round(252600 + Math.max(0, totalMedicalCost - 842000) * 0.01);
    case "active_income_2":
      return Math.round(167400 + Math.max(0, totalMedicalCost - 558000) * 0.01);
    case "active_income_1":
      return Math.round(80100 + Math.max(0, totalMedicalCost - 267000) * 0.01);
    case "general":
      return 18000;
    case "low_income_2":
    case "low_income_1":
      return 8000;
  }
}

export function shouldWarnHighCostCareLimitRevision(targetMonth: string, category: HighCostCareLimitCategory): boolean {
  return category !== "unset" && targetMonth >= "2026-08";
}
