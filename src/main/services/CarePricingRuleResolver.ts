import type { CareClassification, CarePricingRule, CareServiceCategory, PricingVersion } from "../../shared/types";

export class CarePricingRuleResolver {
  constructor(private readonly rules: CarePricingRule[]) {}

  resolveBase(input: {
    targetDate: string;
    careClassification: CareClassification;
    professionCategory: "nurse" | "rehab";
    serviceCategory: CareServiceCategory;
  }): CarePricingRule {
    const serviceCategory = input.serviceCategory === "long" ? "under_90" : input.serviceCategory;
    const matches = this.rules.filter(
      (rule) =>
        rule.category === "basic" &&
        isEffective(rule, input.targetDate) &&
        (rule.careClassification === "any" || rule.careClassification === input.careClassification) &&
        (rule.professionCategory === "any" || rule.professionCategory === input.professionCategory) &&
        (rule.serviceCategory === "any" || rule.serviceCategory === serviceCategory)
    );
    if (matches.length !== 1) throw new Error("介護保険の基本報酬に一致する料金が見つかりません。料金マスターを確認してください。");
    return matches[0];
  }

  resolveCode(code: string, targetDate: string): CarePricingRule | undefined {
    return this.rules.find((rule) => rule.code === code && isEffective(rule, targetDate));
  }
}

export function carePricingVersion(targetMonth: string, ruleCount: number): PricingVersion {
  return {
    label: targetMonth >= "2026-06" ? "令和8年6月期中改定対応" : "令和6年度介護報酬改定",
    usesSamplePricing: false,
    ruleCount
  };
}

function isEffective(rule: CarePricingRule, targetDate: string): boolean {
  return rule.effectiveFrom <= targetDate && (!rule.effectiveTo || rule.effectiveTo >= targetDate);
}
