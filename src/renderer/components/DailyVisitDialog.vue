<template>
  <v-dialog :model-value="modelValue" max-width="980" persistent @update:model-value="emit('update:modelValue', $event)">
    <v-sheet class="pa-5" rounded="sm">
      <div class="d-flex align-center justify-space-between mb-4">
        <div>
          <h2 class="text-h6 font-weight-bold">{{ displayDate }} の訪問内容</h2>
          <div class="text-body-2 text-medium-emphasis">上から順に選択してください。</div>
        </div>
        <v-btn icon="mdi-close" variant="text" aria-label="閉じる" @click="close" />
      </div>

      <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

      <v-row>
        <v-col cols="12" md="6">
          <v-select v-model="form.basicFeeApplicable" label="訪問看護基本療養費" :items="applicableOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="6">
          <v-select v-model="form.managementFeeApplicable" label="訪問看護管理療養費" :items="applicableOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="6">
          <v-select v-model="form.profession" label="訪問職種" :items="professionOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="3">
          <v-select v-model="visitCountKind" label="1日当たりの訪問回数" :items="visitCountKindOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col v-if="visitCountKind === 'three_or_more'" cols="12" md="3">
          <v-select v-model="exactVisitCount" label="正確な回数" :items="exactVisitCountOptions" />
        </v-col>
      </v-row>

      <div class="section-panel mb-4">
        <h3 class="text-subtitle-1 font-weight-bold mb-3">各回の訪問時間</h3>
        <div v-for="(slot, index) in form.timeSlots" :key="index" class="mb-4">
          <div class="font-weight-bold mb-2">{{ index + 1 }}回目</div>
          <v-row>
            <v-col cols="12" md="3">
              <v-select v-model="slot.startTime" label="開始時刻" :items="timeOptions" />
            </v-col>
            <v-col cols="12" md="3">
              <v-select v-model="slot.endTime" label="終了時刻" :items="timeOptions" />
            </v-col>
            <v-col cols="12" md="2">
              <v-select v-model="slot.endDayType" label="終了日区分" :items="endDayOptions" item-title="title" item-value="value" />
            </v-col>
            <v-col cols="12" md="4">
              <div :class="['time-preview', previewFor(slot).timeZoneType === 'mixed' ? 'warn' : '']">
                <div v-if="previewFor(slot).error" class="text-error">{{ previewFor(slot).error }}</div>
                <template v-else>
                  <div>訪問時間：{{ previewFor(slot).durationMinutes }}分</div>
                  <div>時間帯：{{ labels.timeZone[previewFor(slot).timeZoneType] }}</div>
                  <div v-if="previewFor(slot).timeZoneType === 'mixed'">
                    内訳：{{ previewFor(slot).breakdown.map((part) => `${labels.timeZone[part.zone]}${part.minutes}分`).join("、") }}
                  </div>
                </template>
              </div>
            </v-col>
          </v-row>
        </div>
      </div>

      <v-row>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.timeVisitRequestedByPatientOrFamily"
            label="夜間等訪問の求め"
            :items="notApplicableFirstOptions"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.multipleVisitEligibilityType"
            label="難病等複数回訪問要件"
            :items="multipleVisitEligibilityOptions"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.multipleStaffCategory"
            label="複数名訪問区分"
            :items="multipleStaffCategoryOptions"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.singlePersonVisitDifficult" label="1人訪問が困難" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.multipleStaffConsent" label="複数名訪問の同意" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.simultaneousMultipleStaffVisit" label="同時訪問" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.longVisitEligibilityType"
            label="長時間訪問要件"
            :items="longVisitEligibilityOptions"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.longVisitType" label="長時間訪問の算定候補" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.emergencyUnplanned" label="定期予定外の緊急訪問" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.emergencyRequestedByPatientOrFamily"
            label="緊急訪問の求め"
            :items="notApplicableFirstOptions"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.emergencyPhysicianInstruction" label="主治医の指示" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.emergencyType" label="緊急訪問の算定候補" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.dischargeJointGuidanceType" label="退院時共同指導（日別確認）" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            v-model="form.dischargeSupportGuidanceCategory"
            label="退院支援指導区分"
            :items="dischargeSupportGuidanceOptions"
            item-title="title"
            item-value="value"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-text-field v-model.number="form.dischargeSupportTotalMinutes" label="退院支援指導時間（分）" type="number" min="0" step="5" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select v-model="form.firstVisitAfterDischarge" label="退院後初回訪問" :items="notApplicableFirstOptions" item-title="title" item-value="value" />
        </v-col>
      </v-row>

      <div class="section-panel mt-4 mb-4">
        <h3 class="text-subtitle-1 font-weight-bold mb-3">同じ内容を別日に使う</h3>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field v-model="copyTargetDate" label="複写先日付" type="date" :min="monthStartDate" :max="monthEndDate" />
          </v-col>
          <v-col cols="12" md="8" class="d-flex align-center">
            <v-btn variant="outlined" prepend-icon="mdi-content-copy" @click="copyToDate">この内容を指定日に複写</v-btn>
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="rangeStartDate" label="範囲の開始日" type="date" :min="monthStartDate" :max="monthEndDate" />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field v-model="rangeEndDate" label="範囲の終了日" type="date" :min="monthStartDate" :max="monthEndDate" />
          </v-col>
          <v-col cols="12" md="4" class="d-flex align-center">
            <v-btn variant="outlined" prepend-icon="mdi-calendar-range" @click="copyToRange">この内容を範囲に反映</v-btn>
          </v-col>
        </v-row>
      </div>

      <div class="action-row">
        <v-btn color="primary" prepend-icon="mdi-content-save" @click="save">この日の内容を保存</v-btn>
        <v-btn color="error" variant="tonal" prepend-icon="mdi-delete" @click="deleteVisit">この日の内容を削除</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-close" @click="close">閉じる</v-btn>
      </div>
    </v-sheet>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { DailyVisit, DailyVisitInput, EndDayType, VisitTimeSlotInput } from "../../shared/types";
import { labels } from "../../shared/types";
import {
  applicableOptions,
  dischargeSupportGuidanceOptions,
  longVisitEligibilityOptions,
  multipleStaffCategoryOptions,
  multipleVisitEligibilityOptions,
  notApplicableFirstOptions,
  professionOptions,
  timeOptions
} from "../utils/options";
import { toSavableDailyVisitInput } from "../utils/dailyVisitInput";
import { previewTime } from "../utils/timePreview";

const props = defineProps<{
  modelValue: boolean;
  monthlyEstimateId: number;
  visitDate: string;
  targetMonth: string;
  existingVisitDates: string[];
  visit?: DailyVisit;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [value: DailyVisitInput];
  bulkSave: [value: DailyVisitInput[]];
  delete: [];
}>();

const error = ref("");
const visitCountKind = ref<"1" | "2" | "three_or_more">("1");
const exactVisitCount = ref(3);
const copyTargetDate = ref("");
const rangeStartDate = ref("");
const rangeEndDate = ref("");

const form = reactive<DailyVisitInput>(createDefaultVisit(""));

const visitCountKindOptions = [
  { value: "1", title: "1回" },
  { value: "2", title: "2回" },
  { value: "three_or_more", title: "3回以上" }
];
const exactVisitCountOptions = Array.from({ length: 8 }, (_, index) => index + 3);
const endDayOptions = [
  { value: "same_day", title: "当日" },
  { value: "next_day", title: "翌日" }
];
const displayDate = computed(() => `${Number(props.visitDate.slice(5, 7))}月${Number(props.visitDate.slice(8, 10))}日`);
const monthStartDate = computed(() => `${props.targetMonth}-01`);
const monthEndDate = computed(() => {
  const [year, month] = props.targetMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${props.targetMonth}-${String(lastDay).padStart(2, "0")}`;
});

watch(
  () => [props.modelValue, props.visitDate, props.visit?.id],
  () => {
    if (!props.modelValue) return;
    Object.assign(form, props.visit ? fromVisit(props.visit) : createDefaultVisit(props.visitDate));
    if (form.visitCount === 1) visitCountKind.value = "1";
    else if (form.visitCount === 2) visitCountKind.value = "2";
    else {
      visitCountKind.value = "three_or_more";
      exactVisitCount.value = form.visitCount;
    }
    syncSlotCount();
    copyTargetDate.value = "";
    rangeStartDate.value = props.visitDate;
    rangeEndDate.value = props.visitDate;
    error.value = "";
  },
  { immediate: true }
);

watch([visitCountKind, exactVisitCount], syncSlotCount);

function createDefaultVisit(visitDate: string): DailyVisitInput {
  return {
    visitDate,
    basicFeeApplicable: "applicable",
    managementFeeApplicable: "applicable",
    profession: "nurse",
    visitCount: 1,
    longVisitType: "not_applicable",
    multipleStaffType: "not_applicable",
    emergencyType: "not_applicable",
    specialManagementType: "none",
    dischargeJointGuidanceType: "not_applicable",
    dischargeSupportGuidanceType: "not_applicable",
    timeVisitRequestedByPatientOrFamily: "not_applicable",
    multipleVisitEligibilityType: "none",
    multipleStaffCategory: "none",
    singlePersonVisitDifficult: "not_applicable",
    multipleStaffConsent: "not_applicable",
    simultaneousMultipleStaffVisit: "not_applicable",
    longVisitEligibilityType: "none",
    emergencyUnplanned: "not_applicable",
    emergencyRequestedByPatientOrFamily: "not_applicable",
    emergencyPhysicianInstruction: "not_applicable",
    dischargeSupportGuidanceCategory: "none",
    dischargeSupportTotalMinutes: 0,
    firstVisitAfterDischarge: "not_applicable",
    timeSlots: [createDefaultSlot(1)]
  };
}

function createDefaultSlot(sequence: number): VisitTimeSlotInput {
  return {
    sequence,
    startTime: "10:00",
    endTime: "10:30",
    endDayType: "same_day"
  };
}

function fromVisit(visit: DailyVisit): DailyVisitInput {
  return toSavableDailyVisitInput(visit, visit.visitDate);
}

function syncSlotCount(): void {
  form.visitCount = visitCountKind.value === "three_or_more" ? exactVisitCount.value : Number(visitCountKind.value);
  while (form.timeSlots.length < form.visitCount) {
    form.timeSlots.push(createDefaultSlot(form.timeSlots.length + 1));
  }
  while (form.timeSlots.length > form.visitCount) {
    form.timeSlots.pop();
  }
  form.timeSlots.forEach((slot, index) => {
    slot.sequence = index + 1;
  });
}

function previewFor(slot: VisitTimeSlotInput) {
  return previewTime(slot.startTime, slot.endTime, slot.endDayType as EndDayType);
}

function save(): void {
  error.value = "";
  const payload = buildSavableVisit(props.visitDate);
  if (!payload) return;
  emit("save", payload);
}

function copyToDate(): void {
  error.value = "";
  if (!copyTargetDate.value) {
    error.value = "複写先日付を選択してください。";
    return;
  }
  if (!isDateInTargetMonth(copyTargetDate.value)) {
    error.value = "複写先日付は対象年月の範囲内で選択してください。";
    return;
  }
  const payload = buildSavableVisit(copyTargetDate.value);
  if (!payload) return;
  if (!confirmOverwrite([copyTargetDate.value])) return;
  emit("bulkSave", [payload]);
}

function copyToRange(): void {
  error.value = "";
  if (!rangeStartDate.value || !rangeEndDate.value) {
    error.value = "範囲の開始日と終了日を選択してください。";
    return;
  }
  if (!isDateInTargetMonth(rangeStartDate.value) || !isDateInTargetMonth(rangeEndDate.value)) {
    error.value = "範囲は対象年月の中で選択してください。";
    return;
  }
  if (rangeEndDate.value < rangeStartDate.value) {
    error.value = "終了日は開始日以降の日付を選択してください。";
    return;
  }
  const dates = datesBetween(rangeStartDate.value, rangeEndDate.value);
  if (dates.length > 31) {
    error.value = "一度に反映できる範囲は31日までです。";
    return;
  }
  const visits = dates.map((date) => buildSavableVisit(date));
  if (visits.some((visit) => !visit)) return;
  if (!confirmOverwrite(dates)) return;
  emit("bulkSave", visits as DailyVisitInput[]);
}

function buildSavableVisit(visitDate: string): DailyVisitInput | null {
  const badPreview = form.timeSlots.map(previewFor).find((preview) => preview.error);
  if (badPreview) {
    error.value = badPreview.error;
    return null;
  }
  return toSavableDailyVisitInput(form, visitDate);
}

function confirmOverwrite(targetDates: string[]): boolean {
  const overwriteDates = targetDates.filter((date) => props.existingVisitDates.includes(date));
  if (overwriteDates.length === 0) return true;
  const labels = overwriteDates.map((date) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`).join("、");
  return window.confirm(`${labels}にはすでに訪問内容があります。上書きしてよろしいですか？`);
}

function isDateInTargetMonth(value: string): boolean {
  return value >= monthStartDate.value && value <= monthEndDate.value;
}

function datesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function deleteVisit(): void {
  if (window.confirm(`${displayDate.value}の訪問内容を削除します。よろしいですか？`)) {
    emit("delete");
  }
}

function close(): void {
  emit("update:modelValue", false);
}
</script>

<style scoped>
.time-preview {
  min-height: 84px;
  padding: 10px;
  border: 1px solid #cddfdb;
  border-radius: 6px;
  background: #f8fbfa;
  line-height: 1.55;
}

.time-preview.warn {
  border-color: #d7922a;
  background: #fff7e8;
}
</style>
