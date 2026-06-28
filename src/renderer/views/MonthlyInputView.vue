<template>
  <div>
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4">{{ store.error }}</v-alert>
    <v-snackbar v-model="showMessage" color="primary" timeout="3500">{{ store.message }}</v-snackbar>

    <section class="section-panel mb-4">
      <v-row>
        <v-col cols="12" md="3">
          <v-text-field v-model="form.patientName" label="利用者名（必須）" @blur="saveHeader" />
        </v-col>
        <v-col cols="12" md="3">
          <v-text-field v-model="form.facilityName" label="施設名" @blur="saveHeader" />
        </v-col>
        <v-col cols="12" md="2">
          <v-text-field v-model="form.targetMonth" label="対象年月（必須）" type="month" @update:model-value="saveHeader" />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="form.sameBuildingCategory"
            label="同一建物人数区分"
            :items="sameBuildingOptions"
            item-title="title"
            item-value="value"
            @update:model-value="saveHeader"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select
            v-model="form.copaymentRate"
            label="自己負担割合"
            :items="copaymentOptions"
            item-title="title"
            item-value="value"
            @update:model-value="saveHeader"
          />
        </v-col>
      </v-row>

      <v-expansion-panels class="mt-2" variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title>
            詳細な算定条件
            <span class="text-body-2 text-medium-emphasis ml-3">必要な場合だけ開いて設定します。</span>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-row>
              <v-col cols="12" md="2">
                <v-text-field model-value="訪問看護基本療養費（Ⅱ）" label="基本療養費" readonly />
              </v-col>
              <v-col cols="12" md="2">
                <v-select
                  v-model="form.stationCategory"
                  label="ステーション区分"
                  :items="stationOptions"
                  item-title="title"
                  item-value="value"
                  @update:model-value="saveHeader"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="form.singleBuildingResidentCategory"
                  label="管理療養費用人数区分"
                  :items="singleBuildingResidentOptions"
                  item-title="title"
                  item-value="value"
                  @update:model-value="saveHeader"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="form.specialManagementCategory"
                  label="特別管理加算（月1回）"
                  :items="specialManagementCategoryOptions"
                  item-title="title"
                  item-value="value"
                  @update:model-value="saveHeader"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-select
                  v-model="form.dischargeJointGuidanceCountCategory"
                  label="退院時共同指導"
                  :items="dischargeJointGuidanceCountOptions"
                  item-title="title"
                  item-value="value"
                  @update:model-value="saveHeader"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-select
                  v-model="form.specialManagementGuidanceApplicable"
                  label="特別管理指導"
                  :items="notApplicableFirstOptions"
                  item-title="title"
                  item-value="value"
                  @update:model-value="saveHeader"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="form.highCostCareLimitCategory"
                  label="高額療養費自己負担限度額（70歳以上）"
                  :items="highCostCareLimitOptions"
                  item-title="title"
                  item-value="value"
                  @update:model-value="saveHeader"
                />
              </v-col>
            </v-row>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <v-alert v-if="form.sameBuildingCategory === 'one'" type="warning" variant="tonal" density="comfortable" class="mt-2">
        1人区分は入力できますが、今回の正式対応範囲は基本療養費（Ⅱ）のみです。基本療養費（Ⅰ）が必要な場合は明細に警告し、合計には含めません。
      </v-alert>
    </section>

    <section>
      <div class="d-flex align-center justify-space-between mb-2">
        <h2 class="text-h6 font-weight-bold">{{ formatMonth(form.targetMonth) }} 月間予定</h2>
        <div class="text-body-2 text-medium-emphasis">日付を1回クリックして入力します。</div>
      </div>

      <div class="calendar-wrap">
        <div class="calendar-grid" role="grid" aria-label="月間予定カレンダー">
          <div v-for="label in weekdayLabels" :key="label" class="calendar-weekday" role="columnheader">{{ label }}</div>
          <template v-for="(week, weekIndex) in calendarWeeks" :key="weekIndex">
            <div v-for="(day, dayIndex) in week" :key="`${weekIndex}-${dayIndex}-${day.dateKey}`" class="calendar-slot">
              <button
                v-if="day.date"
                type="button"
                :class="[
                  'calendar-day',
                  isWeekend(day.date) ? 'weekend' : '',
                  isHoliday(day.date) ? 'holiday' : '',
                  isToday(day.date) ? 'today' : '',
                  summaryFor(day.dateKey) ? 'has-visit' : 'empty'
                ]"
                @click="openDay(day.date)"
              >
                <span class="calendar-date">
                  <span>{{ day.date.getDate() }}</span>
                  <span v-if="isToday(day.date)" class="day-badge today-badge">今日</span>
                  <span v-else-if="isHoliday(day.date)" class="day-badge holiday-badge">祝日</span>
                </span>
                <span v-if="summaryFor(day.dateKey)" class="visit-summary">
                  <v-icon icon="mdi-check-circle" size="16" class="mr-1" aria-hidden="true" />
                  {{ summaryFor(day.dateKey) }}
                </span>
                <span v-else class="empty-day">未入力</span>
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="action-row">
        <v-btn color="primary" size="x-large" prepend-icon="mdi-calculator" @click="calculate">月額費用を計算</v-btn>
        <v-btn variant="outlined" color="error" prepend-icon="mdi-backspace-outline" @click="resetAll">入力内容をすべてクリア</v-btn>
      </div>
    </section>

    <DailyVisitDialog
      v-if="store.estimate"
      v-model="dialog"
      :monthly-estimate-id="store.estimate.id"
      :visit-date="selectedDate"
      :target-month="form.targetMonth"
      :existing-visit-dates="existingVisitDates"
      :visit="selectedVisit"
      @save="saveDailyVisit"
      @bulk-save="saveDailyVisits"
      @delete="deleteDailyVisit"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import type {
  ApplicableType,
  CopaymentRate,
  DailyVisitInput,
  DischargeJointGuidanceCountCategory,
  HighCostCareLimitCategory,
  SameBuildingCategory,
  SingleBuildingResidentCategory,
  SpecialManagementCategory,
  StationCategory
} from "../../shared/types";
import { labels } from "../../shared/types";
import DailyVisitDialog from "../components/DailyVisitDialog.vue";
import { useEstimateStore } from "../stores/estimateStore";
import { calendarWeeksInMonth, formatMonth, isHoliday, isToday, isWeekend, toDateKey, weekdayLabel } from "../utils/date";
import {
  copaymentOptions,
  dischargeJointGuidanceCountOptions,
  highCostCareLimitOptions,
  notApplicableFirstOptions,
  sameBuildingOptions,
  singleBuildingResidentOptions,
  specialManagementCategoryOptions,
  stationOptions
} from "../utils/options";

const router = useRouter();
const store = useEstimateStore();
const dialog = ref(false);
const selectedDate = ref("");

const form = reactive({
  id: 0,
  patientName: "",
  facilityName: "",
  targetMonth: "",
  sameBuildingCategory: "three_to_nine" as SameBuildingCategory,
  copaymentRate: "unset" as CopaymentRate,
  basicFeeType: "type_2" as const,
  stationCategory: "standard" as StationCategory,
  singleBuildingResidentCategory: "under_20" as SingleBuildingResidentCategory,
  specialManagementCategory: "none" as SpecialManagementCategory,
  dischargeJointGuidanceCountCategory: "none" as DischargeJointGuidanceCountCategory,
  specialManagementGuidanceApplicable: "not_applicable" as ApplicableType,
  highCostCareLimitCategory: "unset" as HighCostCareLimitCategory
});

store.load();

watch(
  () => store.estimate,
  (estimate) => {
    if (!estimate) return;
    Object.assign(form, {
      id: estimate.id,
      patientName: estimate.patientName,
      facilityName: estimate.facilityName,
      targetMonth: estimate.targetMonth,
      sameBuildingCategory: estimate.sameBuildingCategory,
      copaymentRate: estimate.copaymentRate,
      basicFeeType: estimate.basicFeeType,
      stationCategory: estimate.stationCategory,
      singleBuildingResidentCategory: estimate.singleBuildingResidentCategory,
      specialManagementCategory: estimate.specialManagementCategory,
      dischargeJointGuidanceCountCategory: estimate.dischargeJointGuidanceCountCategory,
      specialManagementGuidanceApplicable: estimate.specialManagementGuidanceApplicable,
      highCostCareLimitCategory: estimate.highCostCareLimitCategory
    });
  },
  { immediate: true }
);

const calendarWeeks = computed(() => (form.targetMonth ? calendarWeeksInMonth(form.targetMonth) : []));
const weekdayLabels = Array.from({ length: 7 }, (_, index) => weekdayLabel(new Date(2026, 5, index + 7)));
const selectedVisit = computed(() => store.estimate?.dailyVisits.find((visit) => visit.visitDate === selectedDate.value));
const existingVisitDates = computed(() => store.estimate?.dailyVisits.map((visit) => visit.visitDate) ?? []);
const showMessage = computed({
  get: () => Boolean(store.message),
  set: (value: boolean) => {
    if (!value) store.message = "";
  }
});

async function saveHeader(): Promise<void> {
  if (!form.targetMonth) return;
  await store.saveEstimate({ ...form });
}

async function openDay(day: Date): Promise<void> {
  await saveHeader();
  selectedDate.value = toDateKey(day);
  dialog.value = true;
}

async function saveDailyVisit(visit: DailyVisitInput): Promise<void> {
  if (!store.estimate) return;
  try {
    await store.saveDailyVisit({ monthlyEstimateId: store.estimate.id, visit });
    dialog.value = false;
  } catch (error) {
    store.error = error instanceof Error ? error.message : "保存に失敗しました。";
  }
}

async function saveDailyVisits(visits: DailyVisitInput[]): Promise<void> {
  if (!store.estimate) return;
  try {
    await store.saveDailyVisits({ monthlyEstimateId: store.estimate.id, visits });
    dialog.value = false;
  } catch (error) {
    store.error = error instanceof Error ? error.message : "保存に失敗しました。";
  }
}

async function deleteDailyVisit(): Promise<void> {
  if (!store.estimate || !selectedDate.value) return;
  await store.deleteDailyVisit(store.estimate.id, selectedDate.value);
  dialog.value = false;
}

async function calculate(): Promise<void> {
  try {
    if (!form.patientName.trim()) {
      store.error = "利用者名を入力してください。";
      return;
    }
    await saveHeader();
    await store.calculate();
    await router.push({ name: "cost-detail" });
  } catch (error) {
    store.error = error instanceof Error ? error.message : "計算に失敗しました。";
  }
}

async function resetAll(): Promise<void> {
  if (!store.estimate) return;
  if (!window.confirm("入力内容をすべてクリアします。よろしいですか？")) return;
  await store.reset();
}

function summaryFor(dateKey: string): string {
  const visit = store.estimate?.dailyVisits.find((item) => item.visitDate === dateKey);
  if (!visit) return "";
  const profession = labels.profession[visit.profession];
  const count = visit.visitCount > 1 ? `・${visit.visitCount}回` : "";
  const starts = visit.timeSlots.map((slot) => slot.startTime).join(" / ");
  const zones = visit.timeSlots.map((slot) => labels.timeZone[slot.timeZoneType]).join(" / ");
  const hasAddition =
    visit.longVisitType === "applicable" ||
    visit.multipleStaffType === "applicable" ||
    visit.emergencyType === "applicable" ||
    visit.dischargeJointGuidanceType === "applicable" ||
    visit.dischargeSupportGuidanceType === "applicable" ||
    visit.timeVisitRequestedByPatientOrFamily === "applicable" ||
    visit.multipleVisitEligibilityType !== "none" ||
    visit.multipleStaffCategory !== "none" ||
    visit.longVisitEligibilityType !== "none" ||
    visit.dischargeSupportGuidanceCategory !== "none";
  return `${profession}${count}\n${starts}\n${zones}${hasAddition ? "\n加算あり" : ""}`;
}
</script>
