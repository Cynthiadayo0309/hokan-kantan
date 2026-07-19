<template>
  <v-dialog :model-value="modelValue" max-width="1050" persistent scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between pa-5">
        <div>
          <div class="text-h6 font-weight-bold">{{ displayDate }} の介護保険サービス</div>
          <div class="text-caption text-medium-emphasis">同じ日に看護職とリハビリ職を複数登録できます。</div>
        </div>
        <v-btn icon="mdi-close" variant="text" aria-label="閉じる" @click="close" />
      </v-card-title>
      <v-divider />

      <v-card-text class="pa-5">
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

        <section v-for="(service, index) in form" :key="index" class="service-card mb-4">
          <div class="d-flex align-center justify-space-between mb-3">
            <h3 class="text-subtitle-1 font-weight-bold">{{ index + 1 }}件目</h3>
            <v-btn v-if="form.length > 1" color="error" variant="text" prepend-icon="mdi-delete-outline" @click="remove(index)">この行を削除</v-btn>
          </div>
          <div class="service-grid">
            <v-select :model-value="service.profession" label="訪問職種（必須）" :items="careProfessionOptions" item-title="title" item-value="value" @update:model-value="updateProfession(index, $event)" />
            <v-select :model-value="service.startTime" label="開始時刻（必須）" :items="times" @update:model-value="updateStartTime(index, $event)" />
            <v-select
              v-if="!isRehab(service.profession)"
              :model-value="service.billingCategory"
              label="算定区分（必須）"
              :items="careNursingBillingCategoryOptions"
              item-title="title"
              item-value="value"
              @update:model-value="updateBillingCategory(index, $event)"
            />
            <v-select
              v-else
              :model-value="service.rehabDurationMinutes"
              label="リハビリ時間（必須）"
              :items="rehabDurationOptions"
              item-title="title"
              item-value="value"
              @update:model-value="updateRehabDuration(index, $event)"
            />
          </div>
          <v-checkbox v-model="service.unplannedEmergency" label="計画外の緊急訪問" hide-details class="mt-n2" />
          <v-alert v-if="previews[index].error" type="error" variant="tonal" density="compact">{{ previews[index].error }}</v-alert>
          <div v-else class="preview-grid">
            <div><span>終了時刻（自動）</span><strong>{{ endTimeLabel(index) }}</strong></div>
            <div><span>訪問時間</span><strong>{{ previews[index].durationMinutes }}分</strong></div>
            <div><span>開始時間帯</span><strong>{{ startZoneLabel(service.startTime) }}</strong></div>
            <div><span>時間帯内訳</span><strong>{{ breakdownLabel(previews[index].breakdown) }}</strong></div>
          </div>
          <v-alert v-if="previews[index].timeZoneType === 'mixed'" type="warning" variant="tonal" density="compact" class="mt-3">
            複数の時間帯にまたがっています。時間帯加算は開始時刻で判定します。
          </v-alert>
        </section>

        <v-btn variant="outlined" color="primary" prepend-icon="mdi-plus" @click="add">サービスを追加</v-btn>

        <v-expansion-panels v-model="copyPanel" class="mt-5" variant="accordion">
          <v-expansion-panel value="copy">
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 font-weight-bold"><v-icon icon="mdi-content-copy" />この日の内容をコピー</div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <p class="text-body-2 mb-3">現在入力しているすべてのサービスを、対象月内の別の日へコピーします。</p>
              <v-radio-group v-model="copyMode" inline hide-details class="mb-3">
                <v-radio label="同じ曜日すべて" value="same_weekday" />
                <v-radio label="日付を選ぶ" value="selected_dates" />
              </v-radio-group>

              <v-alert v-if="copyMode === 'same_weekday'" type="info" variant="tonal" density="compact" class="mb-3">
                {{ sourceWeekday }}曜日のうち、コピー元を除く{{ sameWeekdayDates.length }}日を選択しています。
              </v-alert>

              <div v-else class="copy-calendar-wrap mb-3">
                <div class="copy-calendar" role="grid" :aria-label="`${targetMonthLabel}のコピー先日付`">
                  <div v-for="label in weekdayLabels" :key="label" class="copy-weekday" role="columnheader">{{ label }}</div>
                  <template v-for="(week, weekIndex) in copyCalendarWeeks" :key="weekIndex">
                    <template v-for="(day, dayIndex) in week" :key="day.dateKey || `copy-blank-${weekIndex}-${dayIndex}`">
                      <div v-if="!day.date" class="copy-day blank" aria-hidden="true" />
                      <button
                        v-else
                        type="button"
                        :disabled="day.dateKey === visitDate"
                        :class="copyDayClass(day.dateKey)"
                        :aria-pressed="selectedCopyDates.includes(day.dateKey)"
                        :aria-label="copyDayAriaLabel(day.dateKey)"
                        @click="toggleCopyDate(day.dateKey)"
                      >
                        <strong>{{ day.date.getDate() }}</strong>
                        <span v-if="day.dateKey === visitDate" class="day-status">コピー元</span>
                        <span v-else-if="existingDateSet.has(day.dateKey)" class="day-status">登録あり</span>
                      </button>
                    </template>
                  </template>
                </div>
              </div>

              <div class="copy-selection-summary mb-3" aria-live="polite">
                <strong>選択中：{{ copyTargetDates.length }}日</strong>
                <span v-if="copyTargetDates.length">{{ formattedCopyTargetDates }}</span>
                <span v-else>コピー先の日付を選択してください。</span>
              </div>
              <v-btn color="primary" variant="outlined" prepend-icon="mdi-content-copy" :disabled="copyTargetDates.length === 0" @click="prepareCopy">
                選択した日へコピー
              </v-btn>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-card-text>

      <v-divider />
      <v-card-actions class="pa-5 d-flex flex-wrap ga-3">
        <v-btn color="primary" size="large" prepend-icon="mdi-content-save" @click="save">この日の内容を保存</v-btn>
        <v-btn v-if="hasExisting" color="error" variant="outlined" prepend-icon="mdi-delete" @click="confirmDelete = true">この日の内容を削除</v-btn>
        <v-spacer />
        <v-btn variant="text" size="large" @click="close">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmCopy" max-width="620">
    <v-card>
      <v-card-title>選択した日へコピーしますか？</v-card-title>
      <v-card-text>
        <p>{{ displayDate }}の入力内容を保存し、次の{{ pendingTargetDates.length }}日へコピーします。</p>
        <p class="target-list mt-2">{{ formatDateList(pendingTargetDates) }}</p>
        <v-alert v-if="pendingOverwriteDates.length" type="warning" variant="tonal" density="compact" class="mt-4">
          {{ formatDateList(pendingOverwriteDates) }}は登録済みです。その日のサービス全体を上書きします。
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmCopy = false">キャンセル</v-btn>
        <v-btn color="primary" prepend-icon="mdi-content-copy" @click="executeCopy">保存してコピー</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmDelete" max-width="440">
    <v-card>
      <v-card-title>この日の内容を削除しますか？</v-card-title>
      <v-card-text>{{ displayDate }}に登録したすべてのサービスを削除します。</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmDelete = false">キャンセル</v-btn>
        <v-btn color="error" @click="removeDay">削除する</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  CareNursingBillingCategory,
  CareProfession,
  CareServiceEntry,
  CareServiceEntryInput,
  TimeZoneBreakdown
} from "../../shared/types";
import {
  careNursingBillingCategoryOptions,
  deriveCareEndTime,
  isCareNursingBillingCategory,
  nursingBillingCategoryForDuration,
  nursingDurationForBillingCategory
} from "../../shared/careBilling";
import { careProfessionOptions, timeOptions } from "../utils/careOptions";
import { calendarWeeksInMonth, daysInMonth, weekdayLabel } from "../utils/date";
import { previewTime } from "../utils/timePreview";

type CopyMode = "same_weekday" | "selected_dates";
type CopyRequest = { sourceDate: string; targetDates: string[]; services: CareServiceEntryInput[] };

const props = defineProps<{
  modelValue: boolean;
  visitDate: string;
  targetMonth: string;
  existingVisitDates: string[];
  services: CareServiceEntry[];
}>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  save: [CareServiceEntryInput[]];
  copy: [CopyRequest];
  delete: [];
}>();

const form = ref<CareServiceEntryInput[]>([]);
const error = ref("");
const confirmDelete = ref(false);
const confirmCopy = ref(false);
const copyPanel = ref<string>();
const copyMode = ref<CopyMode>("same_weekday");
const selectedCopyDates = ref<string[]>([]);
const pendingTargetDates = ref<string[]>([]);
const pendingServices = ref<CareServiceEntryInput[]>([]);
const times = timeOptions();
const rehabDurationOptions = [
  { title: "20分（1回）", value: 20 },
  { title: "40分（2回）", value: 40 }
] as const;
const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

const displayDate = computed(() => formatJapaneseDate(props.visitDate, false));
const targetMonthLabel = computed(() => {
  const [year, month] = props.targetMonth.split("-");
  return `${year}年${Number(month)}月`;
});
const hasExisting = computed(() => props.services.length > 0);
const derivedTimings = computed(() => form.value.map((item) => {
  const durationMinutes = isRehab(item.profession)
    ? item.rehabDurationMinutes ?? 20
    : nursingDurationForBillingCategory(item.billingCategory ?? "under_30");
  return { durationMinutes, ...deriveCareEndTime(item.startTime, durationMinutes) };
}));
const previews = computed(() => form.value.map((item, index) => {
  const timing = derivedTimings.value[index];
  return previewTime(item.startTime, timing.endTime, timing.endDayType);
}));
const existingDateSet = computed(() => new Set(props.existingVisitDates));
const copyCalendarWeeks = computed(() => calendarWeeksInMonth(props.targetMonth));
const sourceWeekday = computed(() => {
  const source = parseDate(props.visitDate);
  return source ? weekdayLabel(source) : "";
});
const sameWeekdayDates = computed(() => {
  const source = parseDate(props.visitDate);
  if (!source) return [];
  return daysInMonth(props.targetMonth)
    .filter((date) => date.getDay() === source.getDay())
    .map(toDateKey)
    .filter((date) => date !== props.visitDate);
});
const copyTargetDates = computed(() => {
  const dates = copyMode.value === "same_weekday" ? sameWeekdayDates.value : selectedCopyDates.value;
  return [...new Set(dates)].filter((date) => date !== props.visitDate && date.startsWith(`${props.targetMonth}-`)).sort();
});
const formattedCopyTargetDates = computed(() => formatDateList(copyTargetDates.value));
const pendingOverwriteDates = computed(() => pendingTargetDates.value.filter((date) => existingDateSet.value.has(date)));

watch(
  () => props.modelValue,
  (value) => {
    if (!value) return;
    form.value = props.services.length ? props.services.map(toInput) : [defaultService(1)];
    error.value = "";
    confirmDelete.value = false;
    confirmCopy.value = false;
    copyPanel.value = undefined;
    copyMode.value = "same_weekday";
    selectedCopyDates.value = [];
    pendingTargetDates.value = [];
    pendingServices.value = [];
  },
  { immediate: true }
);

function toInput(service: CareServiceEntry): CareServiceEntryInput {
  return {
    sequence: service.sequence,
    profession: service.profession,
    startTime: service.startTime,
    unplannedEmergency: service.unplannedEmergency,
    ...(isRehab(service.profession)
      ? { rehabDurationMinutes: service.durationMinutes >= 40 ? 40 : 20 }
      : { billingCategory: nursingBillingCategoryForDuration(service.durationMinutes) })
  };
}

function defaultService(sequence: number): CareServiceEntryInput {
  return {
    sequence,
    profession: "nurse",
    startTime: "09:00",
    unplannedEmergency: false,
    billingCategory: "under_30"
  };
}

function add(): void {
  form.value.push(defaultService(form.value.length + 1));
}

function remove(index: number): void {
  form.value.splice(index, 1);
  form.value.forEach((item, itemIndex) => { item.sequence = itemIndex + 1; });
}

function updateProfession(index: number, profession: CareProfession): void {
  const service = form.value[index];
  const wasRehab = isRehab(service.profession);
  service.profession = profession;
  if (isRehab(profession) && !wasRehab) {
    delete service.billingCategory;
    service.rehabDurationMinutes = 20;
  } else if (!isRehab(profession) && wasRehab) {
    delete service.rehabDurationMinutes;
    service.billingCategory = "under_30";
  }
}

function updateStartTime(index: number, value: string): void {
  form.value[index].startTime = value;
}

function updateBillingCategory(index: number, value: CareNursingBillingCategory): void {
  if (!isCareNursingBillingCategory(value)) return;
  form.value[index].billingCategory = value;
}

function updateRehabDuration(index: number, value: number): void {
  if (value !== 20 && value !== 40) return;
  form.value[index].rehabDurationMinutes = value;
}

function close(): void {
  emit("update:modelValue", false);
}

function save(): void {
  const services = buildSavableServices();
  if (services) emit("save", services);
}

function prepareCopy(): void {
  error.value = "";
  const services = buildSavableServices();
  if (!services) return;
  if (copyTargetDates.value.length === 0) {
    error.value = "コピー先の日付を1日以上選択してください。";
    return;
  }
  pendingTargetDates.value = [...copyTargetDates.value];
  pendingServices.value = services;
  confirmCopy.value = true;
}

function executeCopy(): void {
  confirmCopy.value = false;
  emit("copy", {
    sourceDate: props.visitDate,
    targetDates: [...pendingTargetDates.value],
    services: pendingServices.value.map((service) => ({ ...service }))
  });
}

function buildSavableServices(): CareServiceEntryInput[] | null {
  error.value = "";
  const invalid = previews.value.find((item) => item.error);
  if (invalid) {
    error.value = invalid.error;
    return null;
  }
  return form.value.map((item, index) => ({
    sequence: index + 1,
    profession: item.profession,
    startTime: item.startTime,
    unplannedEmergency: item.unplannedEmergency,
    ...(isRehab(item.profession)
      ? { rehabDurationMinutes: item.rehabDurationMinutes ?? 20 }
      : { billingCategory: item.billingCategory ?? "under_30" })
  }));
}

function removeDay(): void {
  confirmDelete.value = false;
  emit("delete");
}

function toggleCopyDate(date: string): void {
  if (date === props.visitDate) return;
  selectedCopyDates.value = selectedCopyDates.value.includes(date)
    ? selectedCopyDates.value.filter((item) => item !== date)
    : [...selectedCopyDates.value, date].sort();
}

function copyDayClass(date: string): Array<string | Record<string, boolean>> {
  return [
    "copy-day",
    {
      source: date === props.visitDate,
      "has-data": existingDateSet.value.has(date),
      "is-selected": selectedCopyDates.value.includes(date)
    }
  ];
}

function copyDayAriaLabel(date: string): string {
  const states = [];
  if (date === props.visitDate) states.push("コピー元");
  else if (existingDateSet.value.has(date)) states.push("登録あり");
  if (selectedCopyDates.value.includes(date)) states.push("選択中");
  return `${formatJapaneseDate(date)}${states.length ? `、${states.join("、")}` : ""}`;
}

function formatDateList(dates: string[]): string {
  return dates.map((date) => formatJapaneseDate(date)).join("、");
}

function formatJapaneseDate(dateKey: string, includeWeekday = true): string {
  const date = parseDate(dateKey);
  if (!date) return "";
  const base = `${date.getMonth() + 1}月${date.getDate()}日`;
  return includeWeekday ? `${base}（${weekdayLabel(date)}）` : base;
}

function parseDate(dateKey: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isRehab(value: CareProfession): boolean {
  return ["physical_therapist", "occupational_therapist", "speech_therapist"].includes(value);
}

function endTimeLabel(index: number): string {
  const timing = derivedTimings.value[index];
  if (!timing) return "－";
  const time = `${Number(timing.endTime.slice(0, 2))}:${timing.endTime.slice(3)}`;
  return timing.endDayType === "next_day" ? `翌日 ${time}` : time;
}

function startZoneLabel(time: string): string {
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  if (minute < 360 || minute >= 1320) return "深夜";
  if (minute < 480) return "早朝";
  if (minute < 1080) return "通常";
  return "夜間";
}

function breakdownLabel(value: TimeZoneBreakdown[]): string {
  const labels = { midnight: "深夜", early_morning: "早朝", daytime: "通常", night: "夜間" };
  return value.map((item) => `${labels[item.zone]}${item.minutes}分`).join("、");
}
</script>

<style scoped>
.service-card{border:1px solid #b7ccc7;border-radius:12px;padding:18px;background:#fbfefd}
.service-grid{display:grid;grid-template-columns:1.2fr 1fr 1.5fr;gap:12px}
.preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px;border-radius:8px;background:#eaf5f2}
.preview-grid span{display:block;font-size:12px;color:#55736d}
.preview-grid strong{display:block;margin-top:3px}
.copy-calendar-wrap{max-width:720px;overflow-x:auto}
.copy-calendar{display:grid;grid-template-columns:repeat(7,minmax(82px,1fr));min-width:620px;border:1px solid #b7ccc7;border-radius:10px;overflow:hidden}
.copy-weekday{padding:7px;text-align:center;font-weight:700;background:#e3f2ef;border-right:1px solid #c8d8d4}
.copy-day{min-height:68px;padding:6px;border:0;border-top:1px solid #d0dedb;border-right:1px solid #d0dedb;background:#fff;text-align:left;cursor:pointer}
.copy-day:hover:not(:disabled){background:#eff9f6}
.copy-day.blank{background:#f4f7f6;cursor:default}
.copy-day.source{background:#f0f2f1;color:#697773;cursor:not-allowed}
.copy-day.has-data:not(.source){box-shadow:inset 0 0 0 2px #d59b2a}
.copy-day.is-selected{background:#d9f0ea;box-shadow:inset 0 0 0 3px #2e7d6e}
.day-status{display:block;margin-top:5px;font-size:11px;font-weight:700}
.copy-selection-summary{display:grid;gap:4px;padding:10px 12px;border-radius:8px;background:#f1f7f5}
.copy-selection-summary span,.target-list{line-height:1.7;overflow-wrap:anywhere}
@media(max-width:800px){.service-grid,.preview-grid{grid-template-columns:1fr 1fr}}
</style>
