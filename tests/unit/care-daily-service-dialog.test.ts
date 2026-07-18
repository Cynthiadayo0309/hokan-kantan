import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CareDailyServiceDialog from "../../src/renderer/components/CareDailyServiceDialog.vue";
import type { CareServiceEntry, CareServiceEntryInput } from "../../src/shared/types";

function mountDialog(existingVisitDates: string[] = [], services: CareServiceEntry[] = []) {
  return shallowMount(CareDailyServiceDialog, {
    props: {
      modelValue: true,
      visitDate: "2026-07-15",
      targetMonth: "2026-07",
      existingVisitDates,
      services
    }
  });
}

describe("CareDailyServiceDialog copy", () => {
  it("時刻から算定区分を仮選択し、手動選択後は時刻変更で上書きしない", () => {
    const wrapper = mountDialog();
    const vm = wrapper.vm as unknown as {
      form: CareServiceEntryInput[];
      updateTime: (index: number, field: "startTime" | "endTime", value: string) => void;
      updateBillingCategory: (index: number, value: "under_20" | "under_30" | "under_60" | "under_90") => void;
    };

    expect(vm.form[0].billingCategory).toBe("under_60");
    vm.updateTime(0, "endTime", "09:25");
    expect(vm.form[0].billingCategory).toBe("under_30");

    vm.updateBillingCategory(0, "under_20");
    vm.updateTime(0, "endTime", "09:30");
    expect(vm.form[0].billingCategory).toBe("under_20");
  });

  it("リハビリ職から看護職へ戻すと現在時刻から算定区分を仮選択する", () => {
    const wrapper = mountDialog();
    const vm = wrapper.vm as unknown as {
      form: CareServiceEntryInput[];
      updateProfession: (index: number, value: CareServiceEntryInput["profession"]) => void;
      updateBillingCategory: (index: number, value: "under_20" | "under_30" | "under_60" | "under_90") => void;
    };

    vm.updateBillingCategory(0, "under_20");
    vm.updateProfession(0, "physical_therapist");
    vm.updateProfession(0, "nurse");
    expect(vm.form[0].billingCategory).toBe("under_60");
  });

  it("保存済みサービスは選択した算定区分を保持して開く", () => {
    const saved: CareServiceEntry = {
      ...service({ billingCategory: "under_30" }),
      id: 1,
      durationMinutes: 30,
      serviceCategory: "under_30",
      timeZoneType: "daytime",
      timeZoneBreakdown: [{ zone: "daytime", minutes: 30 }],
      warnings: []
    };
    const wrapper = mountDialog([], [saved]);
    const vm = wrapper.vm as unknown as {
      form: CareServiceEntryInput[];
      updateTime: (index: number, field: "startTime" | "endTime", value: string) => void;
    };

    expect(vm.form[0].billingCategory).toBe("under_30");
    vm.updateTime(0, "endTime", "10:00");
    expect(vm.form[0].billingCategory).toBe("under_30");
  });

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
      service({ profession: "nurse", startTime: "09:00", endTime: "09:30", billingCategory: "under_30" }),
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
    expect(payload.services[0].billingCategory).toBe("under_30");
    expect(payload.services[1]).toMatchObject({ profession: "physical_therapist", startTime: "10:00", endTime: "10:40", unplannedEmergency: true });
    expect(payload.services[1].billingCategory).toBeUndefined();
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
