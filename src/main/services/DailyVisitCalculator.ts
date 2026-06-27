import type { DailyVisitInput, VisitTimeSlot } from "../../shared/types";
import { TimeZoneClassifier, parseTimeToMinutes } from "./TimeZoneClassifier";

type NormalizedRange = {
  start: number;
  end: number;
  sequence: number;
};

export class DailyVisitCalculator {
  static normalize(input: DailyVisitInput): { slots: VisitTimeSlot[]; warnings: string[] } {
    const errors = this.validateRequired(input);
    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }

    const slots = input.timeSlots.map((slot, index) => {
      const classified = TimeZoneClassifier.classify(slot.startTime, slot.endTime, slot.endDayType);
      return {
        ...slot,
        sequence: index + 1,
        durationMinutes: classified.durationMinutes,
        timeZoneType: classified.timeZoneType,
        timeZoneBreakdown: classified.breakdown
      };
    });

    this.assertNoOverlap(slots);

    const warnings: string[] = [];
    for (const slot of slots) {
      if (slot.timeZoneType === "mixed") {
        warnings.push(`${slot.sequence}回目の訪問が複数の時間帯にまたがっています。`);
      }
      if (slot.durationMinutes < 10) {
        warnings.push(`${slot.sequence}回目の訪問時間が著しく短い可能性があります。`);
      }
      if (slot.durationMinutes >= 90 && input.longVisitType === "not_applicable") {
        warnings.push(`${slot.sequence}回目は長時間訪問に該当する可能性があります。`);
      }
      if (slot.endDayType === "next_day") {
        warnings.push(`${slot.sequence}回目の訪問が翌日にまたがっています。`);
      }
    }

    return { slots, warnings };
  }

  static assertNoOverlap(slots: VisitTimeSlot[]): void {
    const ranges: NormalizedRange[] = slots
      .map((slot) => {
        const start = parseTimeToMinutes(slot.startTime);
        const end = start + slot.durationMinutes;
        return { start, end, sequence: slot.sequence };
      })
      .sort((a, b) => a.start - b.start);

    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].start < ranges[index - 1].end) {
        throw new Error(`${ranges[index - 1].sequence}回目と${ranges[index].sequence}回目の訪問時間が重複しています。`);
      }
    }
  }

  private static validateRequired(input: DailyVisitInput): string[] {
    const errors: string[] = [];
    if (!input.visitDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.visitDate)) {
      errors.push("訪問日が不正です。");
    }
    if (!input.profession) {
      errors.push("訪問職種を選択してください。");
    }
    if (!Number.isInteger(input.visitCount) || input.visitCount < 1 || input.visitCount > 10) {
      errors.push("訪問回数が不正です。");
    }
    if (input.timeSlots.length !== input.visitCount) {
      errors.push("訪問回数分の時間入力が不足しています。");
    }
    input.timeSlots.forEach((slot, index) => {
      if (!slot.startTime) {
        errors.push(`${index + 1}回目の開始時刻を選択してください。`);
      }
      if (!slot.endTime) {
        errors.push(`${index + 1}回目の終了時刻を選択してください。`);
      }
      if (!slot.endDayType) {
        errors.push(`${index + 1}回目の終了日区分を選択してください。`);
      }
    });
    return errors;
  }
}
