import { describe, expect, it } from "vitest";
import highCostCarePricing from "../../resources/pricing/high-cost-care-limit-rules.json";
import { calculateHighCostCareLimit } from "../../src/main/services/HighCostCareLimitCalculator";
import type { HighCostCareLimitRule } from "../../src/shared/types";

const rules: HighCostCareLimitRule[] = highCostCarePricing.map((rule) => ({
  ...rule,
  category: rule.category as HighCostCareLimitRule["category"],
  enabled: true
}));

describe("HighCostCareLimitCalculator", () => {
  it.each([
    ["general", 18000, 22000],
    ["low_income_2", 8000, 11000],
    ["low_income_1", 8000, 8000]
  ] as const)("switches %s outpatient limit in August 2026", (category, oldLimit, revisedLimit) => {
    expect(calculateHighCostCareLimit(1_000_000, 300_000, category, "2026-07", rules).limitAmount).toBe(oldLimit);
    expect(calculateHighCostCareLimit(1_000_000, 300_000, category, "2026-08", rules).limitAmount).toBe(revisedLimit);
  });

  it.each([
    ["active_income_3", 270300, 901000],
    ["active_income_2", 179100, 597000],
    ["active_income_1", 85800, 286000]
  ] as const)("uses the revised formula for %s", (category, fixedAmount, threshold) => {
    const result = calculateHighCostCareLimit(1_000_000, 500_000, category, "2026-08", rules);
    expect(result.limitAmount).toBe(Math.round(fixedAmount + (1_000_000 - threshold) * 0.01));
    expect(result.ruleLabel).toBe("2026年8月改定");
  });

  it("refuses to calculate when more than one rule matches", () => {
    const duplicate = { ...rules.find((rule) => rule.ruleCode === "hcl_202608_general")!, ruleCode: "duplicate" };
    const result = calculateHighCostCareLimit(100_000, 30_000, "general", "2026-08", [...rules, duplicate]);
    expect(result.limitAmount).toBeUndefined();
    expect(result.warning).toContain("複数一致");
  });
});
