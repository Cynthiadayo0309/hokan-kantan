import type { HighCostCareLimitCategory, HighCostCareLimitRule } from "../../shared/types";

export type HighCostCareLimitResult = {
  limitAmount?: number;
  appliedAmount?: number;
  applied: boolean;
  ruleLabel?: string;
  warning?: string;
};

export const HIGH_COST_CARE_SCOPE_NOTICE =
  "高額療養費は70歳以上・外来個人ごとの概算です。年間上限、世帯合算、多数回該当、公費、他医療機関・薬局分は自動計算していません。";

export function calculateHighCostCareLimit(
  totalMedicalCost: number,
  copaymentAmount: number | undefined,
  category: HighCostCareLimitCategory,
  targetMonth: string,
  rules: HighCostCareLimitRule[]
): HighCostCareLimitResult {
  if (copaymentAmount === undefined || category === "unset") {
    return { applied: false };
  }

  const targetDate = `${targetMonth}-01`;
  const matches = rules.filter(
    (rule) =>
      rule.enabled &&
      rule.category === category &&
      rule.effectiveFrom <= targetDate &&
      (!rule.effectiveTo || rule.effectiveTo >= targetDate)
  );
  if (matches.length === 0) {
    const [year, month] = targetMonth.split("-");
    return {
      applied: false,
      warning: `${year}年${Number(month)}月に適用できる高額療養費の制度ルールが見つからないため、自己負担限度額を適用していません。`
    };
  }
  if (matches.length > 1) {
    return {
      applied: false,
      warning: "高額療養費の制度ルールが複数一致したため、自己負担限度額を適用していません。制度マスターを確認してください。"
    };
  }

  const rule = matches[0];
  const limitAmount = calculateLimitAmount(totalMedicalCost, rule);
  const appliedAmount = Math.min(copaymentAmount, limitAmount);
  return {
    limitAmount,
    appliedAmount,
    applied: appliedAmount < copaymentAmount,
    ruleLabel: rule.versionLabel
  };
}

export function calculateLimitAmount(totalMedicalCost: number, rule: HighCostCareLimitRule): number {
  const excess = rule.medicalCostThreshold === undefined ? 0 : Math.max(0, totalMedicalCost - rule.medicalCostThreshold) * rule.excessRate;
  return Math.round(rule.fixedAmount + excess);
}

export function shouldShowAnnualLimitNotice(targetMonth: string, category: HighCostCareLimitCategory): boolean {
  return category !== "unset" && targetMonth >= "2026-08";
}
