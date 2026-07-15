<template>
  <div v-if="loading" class="text-center pa-12"><v-progress-circular indeterminate color="primary" size="52" /><div class="mt-3">介護保険の費用を計算しています。</div></div>
  <template v-else-if="store.estimate&&calculation">
    <v-card variant="outlined" class="mb-4">
      <v-card-title class="text-h6 font-weight-bold">介護保険 費用明細</v-card-title><v-card-text>
        <div class="meta-grid"><div><span>利用者名</span><strong>{{ store.estimate.patientName }}</strong></div><div><span>施設名</span><strong>{{ store.estimate.facilityName||"未入力" }}</strong></div><div><span>対象年月</span><strong>{{ formatMonth(store.estimate.targetMonth) }}</strong></div><div><span>認定区分</span><strong>{{ store.estimate.careClassification==='care'?'要介護':'要支援' }}</strong></div><div><span>自己負担割合</span><strong>{{ copaymentLabel }}</strong></div><div><span>地域区分</span><strong>{{ regionalLabel }}（{{ calculation.totals.regionalUnitPrice.toFixed(2) }}円／単位）</strong></div></div>
      </v-card-text>
    </v-card>
    <v-alert type="warning" variant="tonal" class="mb-4">本計算結果は概算です。実際の算定・請求内容を保証するものではありません。</v-alert>
    <v-alert v-if="calculation.warnings.length" type="warning" variant="tonal" class="mb-4"><strong>警告・確認事項</strong><ul class="mt-2 pl-5"><li v-for="warning in calculation.warnings" :key="warning">{{ warning }}</li></ul></v-alert>
    <v-card variant="outlined">
      <v-card-text class="pa-0">
        <div class="table-wrap">
          <v-table density="comfortable">
            <thead><tr><th>区分</th><th>サービス内容</th><th>算定条件</th><th>対象日</th><th class="text-right">回数</th><th class="text-right">単位/回</th><th class="text-right">単位小計</th><th class="text-right">地域単価</th><th class="text-right">金額</th><th>警告・備考</th></tr></thead><tbody>
              <tr v-for="(line,index) in calculation.lines" :key="index" :class="{excluded:!line.includedInTotal}"><td><v-chip size="small" :color="categoryColor(line.category)" variant="tonal">{{ categoryLabel(line.category) }}</v-chip></td><td class="font-weight-bold">{{ line.serviceName }}</td><td>{{ line.conditionSummary }}</td><td>{{ line.targetDates.length?line.targetDates.map(shortDate).join('、'):'月1回' }}</td><td class="text-right">{{ line.quantity }}</td><td class="text-right">{{ number(line.unitCount) }}</td><td class="text-right font-weight-bold">{{ signedUnits(line.subtotalUnits) }}</td><td class="text-right">{{ line.regionalUnitPrice.toFixed(2) }}円</td><td class="text-right">{{ yen(line.amount) }}</td><td>{{ line.warning||line.note||'' }}</td></tr>
              <tr v-if="calculation.lines.length===0"><td colspan="10" class="text-center pa-8">明細がありません。</td></tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>
    <div class="totals-grid"><div><span>基本報酬</span><strong>{{ number(calculation.totals.basicUnits) }}単位</strong></div><div><span>加算</span><strong>{{ number(calculation.totals.additionUnits) }}単位</strong></div><div><span>減算</span><strong>−{{ number(calculation.totals.deductionUnits) }}単位</strong></div><div class="primary"><span>合計単位</span><strong>{{ number(calculation.totals.totalUnits) }}単位</strong></div><div class="primary"><span>月額費用総額</span><strong>{{ yen(calculation.totals.grandTotal) }}</strong></div><div v-if="calculation.totals.copaymentAmount!==undefined" class="primary"><span>利用者負担額の概算</span><strong>{{ yen(calculation.totals.copaymentAmount) }}</strong></div></div>
    <v-alert type="info" variant="tonal" class="mt-4">区分支給限度基準額、他の介護サービス利用額、高額介護サービス費、公費、生活保護、医療・介護合算は含みません。</v-alert>
    <div class="actions"><v-btn variant="outlined" prepend-icon="mdi-arrow-left" @click="router.push({name:'care-monthly-input'})">月間入力へ戻る</v-btn><div class="d-flex flex-wrap ga-2"><v-btn variant="outlined" prepend-icon="mdi-eye" :loading="exporting==='preview'" @click="exportReport('preview')">印刷プレビュー</v-btn><v-btn variant="outlined" prepend-icon="mdi-printer" :loading="exporting==='print'" @click="exportReport('print')">印刷</v-btn><v-btn variant="outlined" prepend-icon="mdi-file-pdf-box" :loading="exporting==='pdf'" @click="exportReport('pdf')">PDF保存</v-btn><v-btn variant="outlined" prepend-icon="mdi-microsoft-excel" :loading="exporting==='excel'" @click="exportReport('excel')">Excel保存</v-btn><v-btn color="primary" prepend-icon="mdi-refresh" @click="recalculate">再計算する</v-btn></div></div>
    <v-snackbar v-model="showMessage" color="primary" timeout="4500">{{ message }}</v-snackbar>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type { CareLineCategory } from "../../shared/types";
import { useCareEstimateStore } from "../stores/careEstimateStore";
import { formatMonth } from "../utils/date";
const router=useRouter();const store=useCareEstimateStore();const loading=ref(true);const exporting=ref("");const message=ref("");const calculation=computed(()=>store.calculation);const showMessage=computed({get:()=>Boolean(message.value),set:value=>{if(!value)message.value=""}});
const copaymentLabel=computed(()=>store.estimate?.copaymentRate==="unset"?"未設定":`${Number(store.estimate?.copaymentRate)/10}割`);const regionalLabel=computed(()=>store.estimate?.regionalGrade==="other"?"その他":`${store.estimate?.regionalGrade.slice(-1)}級地`);
onMounted(async()=>{try{if(!store.estimate)await store.load();if(!store.calculation)await store.calculate()}catch(error){store.error=error instanceof Error?error.message:"計算に失敗しました。";await router.push({name:"care-monthly-input"})}finally{loading.value=false}});
async function recalculate(){loading.value=true;try{await store.calculate()}finally{loading.value=false}}
async function exportReport(type:"preview"|"print"|"pdf"|"excel"){if(!store.estimate)return;exporting.value=type;try{const payload={careEstimateId:store.estimate.id};if(type==="preview"){await window.hokanApi.previewCareMonthlyReport(payload);return}const result=type==="print"?await window.hokanApi.printCareMonthlyReport(payload):type==="pdf"?await window.hokanApi.exportCareMonthlyReportPdf(payload):await window.hokanApi.exportCareMonthlyReportExcel(payload);message.value=result.canceled?"出力をキャンセルしました。":result.filePath?`保存しました：${result.filePath}`:"出力しました。"}catch(error){message.value=error instanceof Error?error.message:"出力に失敗しました。"}finally{exporting.value=""}}
function categoryLabel(value:CareLineCategory){return value==="basic"?"基本報酬":value==="addition"?"加算":"減算"}function categoryColor(value:CareLineCategory){return value==="basic"?"primary":value==="addition"?"success":"warning"}function yen(value:number){return`${value.toLocaleString("ja-JP")}円`}function number(value:number){return value.toLocaleString("ja-JP")}function signedUnits(value:number){return`${value<0?'−':''}${number(Math.abs(value))}単位`}function shortDate(value:string){return`${Number(value.slice(5,7))}/${Number(value.slice(8,10))}`}
</script>

<style scoped>
.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.meta-grid div,.totals-grid div{border:1px solid #b7ccc7;border-radius:8px;padding:10px}.meta-grid span,.totals-grid span{display:block;font-size:12px;color:#55736d}.meta-grid strong,.totals-grid strong{display:block;margin-top:4px}.table-wrap{overflow:auto}th{white-space:nowrap}.excluded{background:#fff7e8}.totals-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.totals-grid strong{text-align:right;font-size:20px}.totals-grid .primary{background:#e8f5f1;border-color:#2e7d6e}.actions{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-top:22px}@media(max-width:900px){.meta-grid,.totals-grid{grid-template-columns:1fr 1fr}.actions{align-items:flex-start;flex-direction:column}}
</style>
