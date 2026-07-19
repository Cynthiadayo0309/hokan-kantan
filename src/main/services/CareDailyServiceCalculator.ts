import type {
  CareNursingBillingCategory,
  CareProfession,
  CareServiceCategory,
  CareServiceEntry,
  CareServiceEntryInput,
  EndDayType
} from "../../shared/types";
import {
  deriveCareEndTime,
  isCareNursingBillingCategory,
  nursingBillingCategoryForDuration,
  nursingDurationForBillingCategory
} from "../../shared/careBilling";
import { TimeZoneClassifier, parseTimeToMinutes } from "./TimeZoneClassifier";

type NormalizedTiming = {
  endTime: string;
  endDayType: EndDayType;
  durationMinutes: number;
  serviceCategory: CareServiceCategory;
  billingCategory?: CareNursingBillingCategory;
  rehabDurationMinutes?: 20 | 40;
};

export class CareDailyServiceCalculator {
  static normalize(inputs: CareServiceEntryInput[]): Omit<CareServiceEntry, "id">[] {
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 20) {
      throw new Error("1日に登録できるサービスは1件から20件までです。");
    }

    const normalized = inputs.map((input, index) => {
      this.validateInput(input);
      const timing = this.normalizeTiming(input);
      const classified = TimeZoneClassifier.classify(input.startTime, timing.endTime, timing.endDayType);
      const warnings: string[] = [];
      if (classified.timeZoneType === "mixed") {
        warnings.push("複数の時間帯にまたがっています。介護保険の時間帯加算は開始時刻で判定します。");
      }
      if (timing.endDayType === "next_day") warnings.push("訪問が翌日にまたがっています。");

      return {
        ...input,
        ...timing,
        sequence: index + 1,
        timeZoneType: classified.timeZoneType,
        timeZoneBreakdown: classified.breakdown,
        warnings
      };
    });

    this.assertNoOverlap(normalized);
    return normalized;
  }

  private static validateInput(input: CareServiceEntryInput): void {
    if (!input || typeof input !== "object") throw new Error("サービス内容が不正です。");
    if (!isCareProfession(input.profession)) throw new Error("訪問職種を選択してください。");
    if (!/^\d{2}:\d{2}$/.test(input.startTime)) throw new Error("開始時刻を選択してください。");

    const isLegacy = input.endTime !== undefined || input.endDayType !== undefined;
    if (isLegacy) {
      if (!input.endTime || !/^\d{2}:\d{2}$/.test(input.endTime)) throw new Error("終了時刻を選択してください。");
      if (input.endDayType !== "same_day" && input.endDayType !== "next_day") {
        throw new Error("終了日区分を選択してください。");
      }
      return;
    }

    if (isRehab(input.profession)) {
      if (input.rehabDurationMinutes !== 20 && input.rehabDurationMinutes !== 40) {
        throw new Error("リハビリ時間は20分または40分を選択してください。");
      }
      return;
    }
    if (!isCareNursingBillingCategory(input.billingCategory)) throw new Error("算定区分を選択してください。");
  }

  private static normalizeTiming(input: CareServiceEntryInput): NormalizedTiming {
    const isLegacy = input.endTime !== undefined && input.endDayType !== undefined;
    if (isLegacy) return this.normalizeLegacyTiming(input, input.endTime!, input.endDayType!);

    if (isRehab(input.profession)) {
      const durationMinutes = input.rehabDurationMinutes!;
      return {
        ...deriveCareEndTime(input.startTime, durationMinutes),
        durationMinutes,
        serviceCategory: "rehab",
        rehabDurationMinutes: durationMinutes
      };
    }

    const billingCategory = input.billingCategory!;
    const durationMinutes = nursingDurationForBillingCategory(billingCategory);
    return {
      ...deriveCareEndTime(input.startTime, durationMinutes),
      durationMinutes,
      serviceCategory: billingCategory,
      billingCategory
    };
  }

  private static normalizeLegacyTiming(
    input: CareServiceEntryInput,
    endTime: string,
    endDayType: EndDayType
  ): NormalizedTiming {
    const classified = TimeZoneClassifier.classify(input.startTime, endTime, endDayType);
    if (isRehab(input.profession)) {
      if (classified.durationMinutes < 20) throw new Error("リハビリ職の訪問は20分以上で入力してください。");
      const durationMinutes: 20 | 40 = classified.durationMinutes < 40 ? 20 : 40;
      return {
        ...deriveCareEndTime(input.startTime, durationMinutes),
        durationMinutes,
        serviceCategory: "rehab",
        rehabDurationMinutes: durationMinutes
      };
    }

    const billingCategory = nursingBillingCategoryForDuration(classified.durationMinutes);
    return {
      endTime,
      endDayType,
      durationMinutes: classified.durationMinutes,
      serviceCategory: billingCategory,
      billingCategory
    };
  }

  private static assertNoOverlap(entries: Array<{ startTime: string; durationMinutes: number; sequence: number }>): void {
    const ranges = entries
      .map((entry) => ({
        start: parseTimeToMinutes(entry.startTime),
        end: parseTimeToMinutes(entry.startTime) + entry.durationMinutes,
        sequence: entry.sequence
      }))
      .sort((a, b) => a.start - b.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].start < ranges[index - 1].end) {
        throw new Error(`${ranges[index - 1].sequence}件目と${ranges[index].sequence}件目のサービス時間が重複しています。`);
      }
    }
  }
}

export function isRehab(profession: CareProfession): boolean {
  return profession === "physical_therapist" || profession === "occupational_therapist" || profession === "speech_therapist";
}

function isCareProfession(value: string): value is CareProfession {
  return ["public_health_nurse", "nurse", "assistant_nurse", "physical_therapist", "occupational_therapist", "speech_therapist"].includes(value);
}
