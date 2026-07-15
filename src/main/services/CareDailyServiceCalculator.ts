import type { CareProfession, CareServiceCategory, CareServiceEntry, CareServiceEntryInput } from "../../shared/types";
import { TimeZoneClassifier, parseTimeToMinutes } from "./TimeZoneClassifier";

export class CareDailyServiceCalculator {
  static normalize(inputs: CareServiceEntryInput[]): Omit<CareServiceEntry, "id">[] {
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 20) {
      throw new Error("1日に登録できるサービスは1件から20件までです。");
    }

    const normalized = inputs.map((input, index) => {
      this.validateInput(input);
      const classified = TimeZoneClassifier.classify(input.startTime, input.endTime, input.endDayType);
      const serviceCategory = this.serviceCategory(input.profession, classified.durationMinutes);
      const warnings: string[] = [];
      if (classified.timeZoneType === "mixed") warnings.push("複数の時間帯にまたがっています。介護保険の時間帯加算は開始時刻で判定します。");
      if (input.endDayType === "next_day") warnings.push("訪問が翌日にまたがっています。");
      if (isRehab(input.profession) && classified.durationMinutes % 20 !== 0) {
        warnings.push("20分に満たない端数時間は算定回数に含めません。");
      }
      return {
        ...input,
        sequence: index + 1,
        durationMinutes: classified.durationMinutes,
        serviceCategory,
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
    if (!/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime)) {
      throw new Error("開始時刻と終了時刻を選択してください。");
    }
    if (input.endDayType !== "same_day" && input.endDayType !== "next_day") {
      throw new Error("終了日区分を選択してください。");
    }
  }

  private static serviceCategory(profession: CareProfession, durationMinutes: number): CareServiceCategory {
    if (isRehab(profession)) {
      if (durationMinutes < 20) throw new Error("リハビリ専門職の訪問は20分以上で入力してください。");
      return "rehab";
    }
    if (durationMinutes < 20) return "under_20";
    if (durationMinutes < 30) return "under_30";
    if (durationMinutes < 60) return "under_60";
    if (durationMinutes < 90) return "under_90";
    return "long";
  }

  private static assertNoOverlap(entries: Array<{ startTime: string; durationMinutes: number; sequence: number }>): void {
    const ranges = entries
      .map((entry) => ({ start: parseTimeToMinutes(entry.startTime), end: parseTimeToMinutes(entry.startTime) + entry.durationMinutes, sequence: entry.sequence }))
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
