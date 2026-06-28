<template>
  <div>
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4">{{ store.error }}</v-alert>
    <v-snackbar v-model="showOutputMessage" color="primary" timeout="3500">{{ outputMessage }}</v-snackbar>

    <section v-if="store.estimate" class="section-panel mb-4">
      <v-row>
        <v-col cols="12" md="2">
          <div class="text-caption text-medium-emphasis">利用者名</div>
          <div class="font-weight-bold">{{ store.estimate.patientName }}</div>
        </v-col>
        <v-col cols="12" md="2">
          <div class="text-caption text-medium-emphasis">施設名</div>
          <div class="font-weight-bold">{{ store.estimate.facilityName || "未入力" }}</div>
        </v-col>
        <v-col cols="12" md="2">
          <div class="text-caption text-medium-emphasis">対象年月</div>
          <div class="font-weight-bold">{{ formatMonth(store.estimate.targetMonth) }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">同一建物人数区分</div>
          <div class="font-weight-bold">{{ labels.sameBuildingCategory[store.estimate.sameBuildingCategory] }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">自己負担割合</div>
          <div class="font-weight-bold">{{ labels.copaymentRate[store.estimate.copaymentRate] }}</div>
        </v-col>
        <v-col cols="12" md="2">
          <div class="text-caption text-medium-emphasis">基本療養費</div>
          <div class="font-weight-bold">Ⅱ</div>
        </v-col>
        <v-col cols="12" md="2">
          <div class="text-caption text-medium-emphasis">ステーション区分</div>
          <div class="font-weight-bold">{{ labels.stationCategory[store.estimate.stationCategory] }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">管理療養費用人数区分</div>
          <div class="font-weight-bold">{{ labels.singleBuildingResidentCategory[store.estimate.singleBuildingResidentCategory] }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">特別管理加算</div>
          <div class="font-weight-bold">{{ labels.specialManagementCategory[store.estimate.specialManagementCategory] }}</div>
        </v-col>
        <v-col cols="12" md="3">
          <div class="text-caption text-medium-emphasis">高額療養費自己負担限度額</div>
          <div class="font-weight-bold">{{ labels.highCostCareLimitCategory[store.estimate.highCostCareLimitCategory] }}</div>
        </v-col>
      </v-row>
    </section>

    <v-alert v-if="calculation?.warnings.length" color="warning" icon="mdi-alert-circle-outline" variant="tonal" class="mb-4">
      <div v-for="warning in calculation.warnings" :key="warning">{{ warning }}</div>
    </v-alert>

    <section>
      <div class="d-flex align-center justify-space-between mb-2">
        <h2 class="text-h6 font-weight-bold">費用明細</h2>
        <div class="text-body-2 text-medium-emphasis">同じ算定条件はまとめて表示しています。</div>
      </div>
      <div v-if="calculation?.periodStartDate && calculation?.periodEndDate" class="text-body-2 text-medium-emphasis mb-3">
        計算範囲：{{ formatDate(calculation.periodStartDate) }}〜{{ formatDate(calculation.periodEndDate) }}
      </div>

      <template v-if="isRangeCalculation">
        <div v-for="monthly in calculation?.monthlyResults" :key="monthly.targetMonth" class="monthly-result-block">
          <h3 class="text-subtitle-1 font-weight-bold mb-2">{{ formatMonth(monthly.targetMonth) }}分</h3>
          <div class="detail-table-wrap">
            <table :class="['detail-table', showLineWarningFor(monthly) ? 'has-warning-column' : '']">
              <colgroup>
                <col class="col-category">
                <col class="col-service">
                <col class="col-condition">
                <col class="col-dates">
                <col class="col-quantity">
                <col class="col-unit">
                <col class="col-price">
                <col class="col-subtotal">
                <col class="col-evidence">
                <col v-if="showLineWarningFor(monthly)" class="col-warning">
                <col class="col-note">
              </colgroup>
              <thead>
                <tr>
                  <th>区分</th>
                  <th>サービス内容</th>
                  <th>算定条件</th>
                  <th>対象日</th>
                  <th>算定回数</th>
                  <th>算定単位</th>
                  <th>単価</th>
                  <th>金額</th>
                  <th>算定根拠</th>
                  <th v-if="showLineWarningFor(monthly)">警告</th>
                  <th>備考</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!monthly.lines.length">
                  <td :colspan="showLineWarningFor(monthly) ? 11 : 10">明細がありません。</td>
                </tr>
                <tr v-for="line in monthly.lines" :key="`${monthly.targetMonth}-${line.category}-${line.serviceName}-${line.targetDates.join(',')}`" :class="{ excluded: line.includedInTotal === false }">
                  <td class="category-cell"><span :class="['category-badge', `category-${line.category}`]">{{ categoryLabel(line.category) }}</span></td>
                  <td class="service-cell">{{ line.serviceName }}</td>
                  <td class="condition-cell">{{ line.conditionSummary }}</td>
                  <td class="date-cell">
                    <span v-for="date in line.targetDates" :key="date" class="date-pill">{{ formatShortDate(date) }}</span>
                  </td>
                  <td class="amount">{{ line.quantity }}</td>
                  <td class="unit-cell">{{ line.unitType ? labels.unitType[line.unitType] : "" }}</td>
                  <td class="amount">{{ yen(line.unitPrice) }}</td>
                  <td class="amount">{{ yen(line.subtotal) }}</td>
                  <td class="text-cell">{{ line.evidence || "" }}</td>
                  <td v-if="showLineWarningFor(monthly)" class="warning-cell">{{ warningFor(line) }}</td>
                  <td class="text-cell">{{ line.note || "" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <TotalsGrid :totals="monthly.totals" :high-cost-care-limit-selected="store.estimate?.highCostCareLimitCategory !== 'unset'" :yen="yen" />
        </div>
        <div v-if="calculation" class="range-total-block">
          <h3 class="text-subtitle-1 font-weight-bold mb-2">選択範囲合計</h3>
          <TotalsGrid :totals="calculation.totals" :high-cost-care-limit-selected="store.estimate?.highCostCareLimitCategory !== 'unset'" :yen="yen" />
        </div>
      </template>

      <template v-else>
        <div class="detail-table-wrap">
          <table :class="['detail-table', showLineWarning ? 'has-warning-column' : '']">
            <colgroup>
              <col class="col-category">
              <col class="col-service">
              <col class="col-condition">
              <col class="col-dates">
              <col class="col-quantity">
              <col class="col-unit">
              <col class="col-price">
              <col class="col-subtotal">
              <col class="col-evidence">
              <col v-if="showLineWarning" class="col-warning">
              <col class="col-note">
            </colgroup>
            <thead>
              <tr>
                <th>区分</th>
                <th>サービス内容</th>
                <th>算定条件</th>
                <th>対象日</th>
                <th>算定回数</th>
                <th>算定単位</th>
                <th>単価</th>
                <th>金額</th>
                <th>算定根拠</th>
                <th v-if="showLineWarning">警告</th>
                <th>備考</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!calculation?.lines.length">
                <td :colspan="showLineWarning ? 11 : 10">明細がありません。</td>
              </tr>
              <tr v-for="line in calculation?.lines" :key="`${line.category}-${line.serviceName}-${line.targetDates.join(',')}`" :class="{ excluded: line.includedInTotal === false }">
                <td class="category-cell"><span :class="['category-badge', `category-${line.category}`]">{{ categoryLabel(line.category) }}</span></td>
                <td class="service-cell">{{ line.serviceName }}</td>
                <td class="condition-cell">{{ line.conditionSummary }}</td>
                <td class="date-cell">
                  <span v-for="date in line.targetDates" :key="date" class="date-pill">{{ formatShortDate(date) }}</span>
                </td>
                <td class="amount">{{ line.quantity }}</td>
                <td class="unit-cell">{{ line.unitType ? labels.unitType[line.unitType] : "" }}</td>
                <td class="amount">{{ yen(line.unitPrice) }}</td>
                <td class="amount">{{ yen(line.subtotal) }}</td>
                <td class="text-cell">{{ line.evidence || "" }}</td>
                <td v-if="showLineWarning" class="warning-cell">{{ warningFor(line) }}</td>
                <td class="text-cell">{{ line.note || "" }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="calculation" class="totals-grid">
          <div class="total-box">
            <div class="total-label">訪問看護基本療養費合計</div>
            <div class="total-value">{{ yen(calculation.totals.basic) }}</div>
          </div>
          <div class="total-box">
            <div class="total-label">訪問看護管理療養費合計</div>
            <div class="total-value">{{ yen(calculation.totals.management) }}</div>
          </div>
          <div class="total-box">
            <div class="total-label">各種加算合計</div>
            <div class="total-value">{{ yen(calculation.totals.additions) }}</div>
          </div>
          <div class="total-box">
            <div class="total-label">月額費用総額</div>
            <div class="total-value">{{ yen(calculation.totals.grandTotal) }}</div>
          </div>
          <div v-if="calculation.totals.copaymentAmountBeforeLimit !== undefined" class="total-box">
            <div class="total-label">上限適用前の利用者負担額</div>
            <div class="total-value">{{ yen(calculation.totals.copaymentAmountBeforeLimit) }}</div>
          </div>
          <div v-if="calculation.totals.highCostCareLimitAmount !== undefined" class="total-box">
            <div class="total-label">高額療養費自己負担限度額</div>
            <div class="total-value">{{ yen(calculation.totals.highCostCareLimitAmount) }}</div>
          </div>
          <div v-if="calculation.totals.copaymentAmount !== undefined" class="total-box">
            <div class="total-label">{{ calculation.totals.highCostCareLimitAmount !== undefined ? "高額療養費上限適用後の利用者負担額" : "利用者負担額の概算" }}</div>
            <div class="total-value">{{ yen(calculation.totals.copaymentAmount) }}</div>
          </div>
        </div>
      </template>

      <v-alert v-if="store.estimate?.highCostCareLimitCategory !== 'unset'" color="warning" icon="mdi-alert-circle-outline" variant="tonal" class="mt-4">
        この上限は70歳以上・外来個人ごとの概算です。世帯合算、多数回該当、年間上限、公費、他医療機関分は含みません。
      </v-alert>

      <div class="action-row">
        <v-btn variant="outlined" prepend-icon="mdi-file-eye-outline" :loading="outputLoading === 'preview'" @click="previewReport">印刷プレビュー</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-printer" :loading="outputLoading === 'print'" @click="printReport">印刷</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-file-pdf-box" :loading="outputLoading === 'pdf'" @click="exportPdf">PDF保存</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-file-excel-box" :loading="outputLoading === 'excel'" @click="exportExcel">Excel保存</v-btn>
        <v-btn variant="outlined" prepend-icon="mdi-arrow-left" @click="router.push({ name: 'monthly-input' })">月間入力へ戻る</v-btn>
        <v-btn color="primary" prepend-icon="mdi-refresh" @click="recalculate">再計算する</v-btn>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from "vue";
import type { PropType } from "vue";
import { useRouter } from "vue-router";
import type { CalculationTotals, MonthlyCalculationPeriodResult, PricingCategory } from "../../shared/types";
import { labels } from "../../shared/types";
import { useEstimateStore } from "../stores/estimateStore";
import { formatMonth } from "../utils/date";

const router = useRouter();
const store = useEstimateStore();
const calculation = computed(() => store.calculation);
const isRangeCalculation = computed(() => (calculation.value?.monthlyResults?.length ?? 0) > 1);
const showLineWarning = computed(() => Boolean(calculation.value?.lines.some((line) => warningFor(line))));
const outputLoading = ref<"" | "preview" | "print" | "pdf" | "excel">("");
const outputMessage = ref("");
const showOutputMessage = computed({
  get: () => Boolean(outputMessage.value),
  set: (value: boolean) => {
    if (!value) outputMessage.value = "";
  }
});

const TotalsGrid = defineComponent({
  props: {
    totals: {
      type: Object as PropType<CalculationTotals>,
      required: true
    },
    highCostCareLimitSelected: {
      type: Boolean,
      required: true
    },
    yen: {
      type: Function as PropType<(value: number) => string>,
      required: true
    }
  },
  setup(props) {
    return () =>
      h("div", { class: "totals-grid" }, [
        totalBox("訪問看護基本療養費合計", props.yen(props.totals.basic)),
        totalBox("訪問看護管理療養費合計", props.yen(props.totals.management)),
        totalBox("各種加算合計", props.yen(props.totals.additions)),
        totalBox("月額費用総額", props.yen(props.totals.grandTotal)),
        props.totals.copaymentAmountBeforeLimit !== undefined ? totalBox("上限適用前の利用者負担額", props.yen(props.totals.copaymentAmountBeforeLimit)) : null,
        props.totals.highCostCareLimitAmount !== undefined ? totalBox("高額療養費自己負担限度額", props.yen(props.totals.highCostCareLimitAmount)) : null,
        props.totals.copaymentAmount !== undefined
          ? totalBox(props.highCostCareLimitSelected ? "高額療養費上限適用後の利用者負担額" : "利用者負担額の概算", props.yen(props.totals.copaymentAmount))
          : null
      ]);
  }
});

function totalBox(label: string, value: string) {
  return h("div", { class: "total-box" }, [h("div", { class: "total-label" }, label), h("div", { class: "total-value" }, value)]);
}

onMounted(async () => {
  if (!store.estimate) {
    await store.load();
  }
  if (!store.calculation) {
    await recalculate();
  }
});

async function recalculate(): Promise<void> {
  try {
    await store.calculate();
  } catch (error) {
    store.error = error instanceof Error ? error.message : "再計算に失敗しました。";
  }
}

async function previewReport(): Promise<void> {
  await runOutput("preview", async (monthlyEstimateId) => {
    await window.hokanApi.previewMonthlyReport({ monthlyEstimateId });
    outputMessage.value = "印刷プレビューを開きました。";
  });
}

async function printReport(): Promise<void> {
  await runOutput("print", async (monthlyEstimateId) => {
    const result = await window.hokanApi.printMonthlyReport({ monthlyEstimateId });
    if (!result.canceled) outputMessage.value = "印刷を開始しました。";
  });
}

async function exportPdf(): Promise<void> {
  await runOutput("pdf", async (monthlyEstimateId) => {
    const result = await window.hokanApi.exportMonthlyReportPdf({ monthlyEstimateId });
    if (!result.canceled) outputMessage.value = "PDFを保存しました。";
  });
}

async function exportExcel(): Promise<void> {
  await runOutput("excel", async (monthlyEstimateId) => {
    const result = await window.hokanApi.exportMonthlyReportExcel({ monthlyEstimateId });
    if (!result.canceled) outputMessage.value = "Excelを保存しました。";
  });
}

async function runOutput(kind: "preview" | "print" | "pdf" | "excel", action: (monthlyEstimateId: number) => Promise<void>): Promise<void> {
  if (!store.estimate) return;
  outputLoading.value = kind;
  store.error = "";
  try {
    if (!store.calculation) {
      await store.calculate();
    }
    await action(store.estimate.id);
  } catch (error) {
    store.error = error instanceof Error ? error.message : "出力に失敗しました。";
  } finally {
    outputLoading.value = "";
  }
}

function categoryLabel(category: PricingCategory): string {
  return category === "basic" ? "基本療養費" : category === "management" ? "管理療養費" : "加算";
}

function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

function formatShortDate(value: string): string {
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
}

function formatDate(value: string): string {
  return `${Number(value.slice(0, 4))}年${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`;
}

function warningFor(line: { warning?: string; includedInTotal?: boolean }): string {
  return line.warning || (line.includedInTotal === false ? "合計対象外" : "");
}

function showLineWarningFor(result: MonthlyCalculationPeriodResult): boolean {
  return result.lines.some((line) => warningFor(line));
}
</script>

<style scoped>
.excluded {
  background: #fff7e8;
}

.warning-cell {
  color: #8a5b00;
  font-weight: 600;
}

.monthly-result-block,
.range-total-block {
  margin-top: 18px;
}
</style>
