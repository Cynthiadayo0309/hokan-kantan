import type { CareNursingBillingCategory, EndDayType } from "./types";

export const careNursingBillingCategoryOptions: Array<{ title: string; value: CareNursingBillingCategory }> = [
  { title: "20分未満", value: "under_20" },
  { title: "30分未満", value: "under_30" },
  { title: "30分以上1時間未満", value: "under_60" },
  { title: "1時間以上1時間30分未満", value: "under_90" },
  { title: "90分以上（長時間）", value: "long" }
];

export function nursingBillingCategoryForDuration(durationMinutes: number): CareNursingBillingCategory {
  if (durationMinutes < 20) return "under_20";
  if (durationMinutes < 30) return "under_30";
  if (durationMinutes < 60) return "under_60";
  if (durationMinutes < 90) return "under_90";
  return "long";
}

const nursingRepresentativeMinutes: Record<CareNursingBillingCategory, number> = {
  under_20: 19,
  under_30: 29,
  under_60: 59,
  under_90: 89,
  long: 90
};

export function nursingDurationForBillingCategory(category: CareNursingBillingCategory): number {
  return nursingRepresentativeMinutes[category];
}

export function deriveCareEndTime(
  startTime: string,
  durationMinutes: number
): { endTime: string; endDayType: EndDayType } {
  const match = /^(\d{2}):(\d{2})$/.exec(startTime);
  if (!match) throw new Error("開始時刻を選択してください。");
  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  if (startMinutes < 0 || startMinutes >= 24 * 60 || durationMinutes <= 0 || durationMinutes >= 24 * 60) {
    throw new Error("開始時刻または訪問時間が不正です。");
  }
  const totalMinutes = startMinutes + durationMinutes;
  const endMinutes = totalMinutes % (24 * 60);
  return {
    endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    endDayType: totalMinutes >= 24 * 60 ? "next_day" : "same_day"
  };
}

export function nursingBillingCategoryLabel(category: CareNursingBillingCategory): string {
  return careNursingBillingCategoryOptions.find((option) => option.value === category)?.title ?? "";
}

export function isCareNursingBillingCategory(value: unknown): value is CareNursingBillingCategory {
  return careNursingBillingCategoryOptions.some((option) => option.value === value);
}
