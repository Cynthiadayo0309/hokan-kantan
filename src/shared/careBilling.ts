import type { CareNursingBillingCategory } from "./types";

export const careNursingBillingCategoryOptions: Array<{ title: string; value: CareNursingBillingCategory }> = [
  { title: "20分未満", value: "under_20" },
  { title: "30分未満", value: "under_30" },
  { title: "30分以上1時間未満", value: "under_60" },
  { title: "1時間以上1時間30分未満", value: "under_90" }
];

export function nursingBillingCategoryForDuration(durationMinutes: number): CareNursingBillingCategory {
  if (durationMinutes < 20) return "under_20";
  if (durationMinutes < 30) return "under_30";
  if (durationMinutes < 60) return "under_60";
  return "under_90";
}

export function nursingBillingCategoryLabel(category: CareNursingBillingCategory): string {
  return careNursingBillingCategoryOptions.find((option) => option.value === category)?.title ?? "";
}

export function isCareNursingBillingCategory(value: unknown): value is CareNursingBillingCategory {
  return careNursingBillingCategoryOptions.some((option) => option.value === value);
}
