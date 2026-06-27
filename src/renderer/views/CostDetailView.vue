<template>
  <div>
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4">{{ store.error }}</v-alert>

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

      <div class="detail-table-wrap">
        <table class="detail-table">
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
              <th>警告</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!calculation?.lines.length">
              <td colspan="11">明細がありません。</td>
            </tr>
            <tr v-for="line in calculation?.lines" :key="`${line.category}-${line.serviceName}-${line.targetDates.join(',')}`" :class="{ excluded: line.includedInTotal === false }">
              <td>{{ categoryLabel(line.category) }}</td>
              <td>{{ line.serviceName }}</td>
              <td>{{ line.conditionSummary }}</td>
              <td>{{ line.targetDates.map(formatShortDate).join("、") }}</td>
              <td class="amount">{{ line.quantity }}</td>
              <td>{{ line.unitType ? labels.unitType[line.unitType] : "" }}</td>
              <td class="amount">{{ yen(line.unitPrice) }}</td>
              <td class="amount">{{ yen(line.subtotal) }}</td>
              <td>{{ line.evidence || "" }}</td>
              <td class="warning-cell">{{ line.warning || (line.includedInTotal === false ? "合計対象外" : "") }}</td>
              <td>{{ line.note || "" }}</td>
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

      <v-alert v-if="store.estimate?.highCostCareLimitCategory !== 'unset'" color="warning" icon="mdi-alert-circle-outline" variant="tonal" class="mt-4">
        この上限は70歳以上・外来個人ごとの概算です。世帯合算、多数回該当、年間上限、公費、他医療機関分は含みません。
      </v-alert>

      <div class="action-row">
        <v-btn variant="outlined" prepend-icon="mdi-arrow-left" @click="router.push({ name: 'monthly-input' })">月間入力へ戻る</v-btn>
        <v-btn color="primary" prepend-icon="mdi-refresh" @click="recalculate">再計算する</v-btn>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import type { PricingCategory } from "../../shared/types";
import { labels } from "../../shared/types";
import { useEstimateStore } from "../stores/estimateStore";
import { formatMonth } from "../utils/date";

const router = useRouter();
const store = useEstimateStore();
const calculation = computed(() => store.calculation);

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

function categoryLabel(category: PricingCategory): string {
  return category === "basic" ? "基本療養費" : category === "management" ? "管理療養費" : "加算";
}

function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

function formatShortDate(value: string): string {
  return `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;
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
</style>
