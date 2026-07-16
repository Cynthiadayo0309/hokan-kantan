import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CareDailyServiceDialog from "../../src/renderer/components/CareDailyServiceDialog.vue";
import type { CareServiceEntryInput } from "../../src/shared/types";

function mountDialog(existingVisitDates: string[] = []) {
  return shallowMount(CareDailyServiceDialog, {
    props: {
      modelValue: true,
      visitDate: "2026-07-15",
      targetMonth: "2026-07",
      existingVisitDates,
      services: []
    }
  });
}

describe("CareDailyServiceDialog copy", () => {
  it("selects every matching weekday in the target month except the source date", () => {
    const wrapper = mountDialog();
    const vm = wrapper.vm as unknown as { sameWeekdayDates: string[]; copyTargetDates: string[] };

    expect(vm.sameWeekdayDates).toEqual(["2026-07-01", "2026-07-08", "2026-07-22", "2026-07-29"]);
    expect(vm.copyTargetDates).toEqual(vm.sameWeekdayDates);
  });

  it("allows individual dates to be selected and cleared without selecting the source", () => {
    const wrapper = mountDialog();
    const vm = wrapper.vm as unknown as {
      copyMode: "same_weekday" | "selected_dates";
      selectedCopyDates: string[];
      toggleCopyDate: (date: string) => void;
    };

    vm.copyMode = "selected_dates";
    vm.toggleCopyDate("2026-07-03");
    vm.toggleCopyDate("2026-07-20");
    vm.toggleCopyDate("2026-07-15");
    expect(vm.selectedCopyDates).toEqual(["2026-07-03", "2026-07-20"]);

    vm.toggleCopyDate("2026-07-03");
    expect(vm.selectedCopyDates).toEqual(["2026-07-20"]);
  });

  it("emits every service row for the source and selected target dates", () => {
    const wrapper = mountDialog(["2026-07-22"]);
    const vm = wrapper.vm as unknown as {
      form: CareServiceEntryInput[];
      prepareCopy: () => void;
      executeCopy: () => void;
      pendingOverwriteDates: string[];
    };
    vm.form = [
      service({ profession: "nurse", startTime: "09:00", endTime: "09:30" }),
      service({ sequence: 2, profession: "physical_therapist", startTime: "10:00", endTime: "10:40", unplannedEmergency: true })
    ];

    vm.prepareCopy();
    expect(vm.pendingOverwriteDates).toEqual(["2026-07-22"]);
    vm.executeCopy();

    const payload = wrapper.emitted("copy")?.[0]?.[0] as {
      sourceDate: string;
      targetDates: string[];
      services: CareServiceEntryInput[];
    };
    expect(payload.sourceDate).toBe("2026-07-15");
    expect(payload.targetDates).toEqual(["2026-07-01", "2026-07-08", "2026-07-22", "2026-07-29"]);
    expect(payload.services).toHaveLength(2);
    expect(payload.services[1]).toMatchObject({ profession: "physical_therapist", startTime: "10:00", endTime: "10:40", unplannedEmergency: true });
  });

  it("does not prepare a copy when no individual date is selected", () => {
    const wrapper = mountDialog();
    const vm = wrapper.vm as unknown as {
      copyMode: "same_weekday" | "selected_dates";
      prepareCopy: () => void;
      confirmCopy: boolean;
      error: string;
    };

    vm.copyMode = "selected_dates";
    vm.prepareCopy();

    expect(vm.confirmCopy).toBe(false);
    expect(vm.error).toContain("コピー先の日付を1日以上");
    expect(wrapper.emitted("copy")).toBeUndefined();
  });
});

function service(overrides: Partial<CareServiceEntryInput> = {}): CareServiceEntryInput {
  return {
    sequence: 1,
    profession: "nurse",
    startTime: "09:00",
    endTime: "09:30",
    endDayType: "same_day",
    unplannedEmergency: false,
    ...overrides
  };
}
