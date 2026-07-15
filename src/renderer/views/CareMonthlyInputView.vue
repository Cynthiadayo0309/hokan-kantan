<template>
  <div v-if="store.loading" class="text-center pa-12"><v-progress-circular indeterminate color="primary" size="52" /><div class="mt-3">介護保険の入力内容を読み込んでいます。</div></div>
  <template v-else-if="store.estimate">
    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4">{{ store.error }}</v-alert>
    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-h6 font-weight-bold">基本情報</v-card-title><v-card-text>
        <div class="header-grid">
          <v-text-field v-model="form.patientName" label="利用者名（必須）" @blur="saveHeader" />
          <v-text-field v-model="form.facilityName" label="施設名" @blur="saveHeader" />
          <v-text-field v-model="form.targetMonth" label="対象年月（必須）" type="month" @update:model-value="onMonthChanged" />
          <v-select v-model="form.careClassification" label="認定区分（必須）" :items="careClassificationOptions" item-title="title" item-value="value" @update:model-value="saveHeader" />
          <v-select v-model="form.copaymentRate" label="自己負担割合" :items="careCopaymentOptions" item-title="title" item-value="value" @update:model-value="saveHeader" />
          <v-select v-model="form.regionalGrade" label="地域区分（必須）" :items="regionalGradeOptions" item-title="title" item-value="value" @update:model-value="saveHeader" />
        </div>
        <v-alert type="info" variant="tonal" density="compact">地域区分は事業所所在地の級地を選択してください。現在の単価：{{ regionalRates[form.regionalGrade].toFixed(2) }}円／単位</v-alert>
      </v-card-text>
    </v-card>

    <v-card class="mb-4" variant="outlined">
      <v-card-title class="text-h6 font-weight-bold">施設条件・月ごとの加算</v-card-title><v-card-text>
        <div class="condition-grid">
          <v-select v-model="form.sameBuildingCategory" label="同一建物減算" :items="sameBuildingOptions" item-title="title" item-value="value" @update:model-value="saveHeader" />
          <v-select v-model="form.initialAddition" label="初回加算" :items="initialAdditionOptions" item-title="title" item-value="value" @update:model-value="onInitialChanged" />
          <v-select v-model="form.emergencyAddition" label="緊急時訪問看護加算" :items="emergencyAdditionOptions" item-title="title" item-value="value" @update:model-value="saveHeader" />
          <v-select v-model="form.specialManagementAddition" label="特別管理加算" :items="specialManagementOptions" item-title="title" item-value="value" @update:model-value="saveHeader" />
        </div>
        <div class="check-grid">
          <v-checkbox v-model="form.dischargeJointGuidance" label="退院時共同指導加算" :disabled="form.initialAddition!=='none'" @update:model-value="saveHeader" />
          <v-checkbox v-model="form.terminalCare" label="ターミナルケア加算" @update:model-value="saveHeader" />
          <v-checkbox v-model="form.treatmentImprovement" label="介護職員等処遇改善加算（1.8%）" :disabled="form.targetMonth<'2026-06'" @update:model-value="saveHeader" />
          <v-checkbox v-model="form.rehabOver12Months" label="要支援でリハビリ利用開始から12か月超" :disabled="form.careClassification!=='support'" @update:model-value="saveHeader" />
          <v-checkbox v-model="form.rehabFacilityReduction" label="理学療法士等の事業所要件減算（8単位）" @update:model-value="saveHeader" />
        </div>
        <v-alert v-if="form.initialAddition!=='none'" type="info" variant="tonal" density="compact">初回加算を選択しているため、退院時共同指導加算は選択できません。</v-alert>
      </v-card-text>
    </v-card>

    <v-card variant="outlined">
      <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2"><div><h2 class="text-h6 font-weight-bold">{{ formatMonth(form.targetMonth) }} 月間予定</h2><div class="text-caption text-medium-emphasis">日付を1回クリックして訪問サービスを登録してください。</div></div><div class="legend"><span class="sun">日・祝</span><span class="sat">土</span><span class="today">今日</span></div></v-card-title><v-card-text>
        <div class="calendar-scroll">
          <div class="care-calendar">
            <div v-for="label in weekdayLabels" :key="label" class="weekday-header">{{ label }}</div>
            <template v-for="(week,weekIndex) in calendarWeeks" :key="weekIndex">
              <button v-for="(day,dayIndex) in week" :key="day.dateKey||`blank-${weekIndex}-${dayIndex}`" type="button" :disabled="!day.date" :class="dayClass(day.date)" @click="day.date&&openDay(day.dateKey)">
                <template v-if="day.date">
                  <div class="day-number"><strong>{{ day.date.getDate() }}</strong><span>{{ weekdayLabel(day.date) }}</span></div><div v-if="dayMap.get(day.dateKey)" class="day-summary">
                    <div v-for="service in dayMap.get(day.dateKey)?.services.slice(0,3)" :key="service.id"><strong>{{ careProfessionLabels[service.profession] }}</strong> {{ service.startTime }}～{{ service.endTime }}</div>
                    <div v-if="(dayMap.get(day.dateKey)?.services.length||0)>3">ほか{{ (dayMap.get(day.dateKey)?.services.length||0)-3 }}件</div>
                    <v-chip size="x-small" color="primary" variant="tonal">{{ dayMap.get(day.dateKey)?.services.length }}件登録</v-chip>
                  </div><div v-else class="empty-day">クリックして登録</div>
                </template>
              </button>
            </template>
          </div>
        </div>
        <v-alert v-if="store.estimate.serviceDays.length===0" type="info" variant="tonal" class="mt-4">まだ訪問サービスが登録されていません。</v-alert>
      </v-card-text>
    </v-card>

    <div class="action-row"><v-btn variant="outlined" color="error" prepend-icon="mdi-delete-sweep-outline" @click="confirmReset=true">入力内容をすべてクリア</v-btn><v-btn color="primary" size="x-large" prepend-icon="mdi-calculator" @click="calculate">月額費用を計算</v-btn></div>
    <v-alert type="warning" variant="tonal" class="mt-4">未対応：区分支給限度基準額、他サービス、高額介護サービス費、公費、複数名訪問、看護体制強化、サービス提供体制強化、特別地域・中山間地域加算等。</v-alert>
  </template>

  <CareDailyServiceDialog v-model="dialogOpen" :visit-date="selectedDate" :services="selectedServices" @save="saveDay" @delete="deleteDay" />
  <v-dialog v-model="confirmReset" max-width="460"><v-card><v-card-title>すべての訪問内容を削除しますか？</v-card-title><v-card-text>基本情報は残し、登録した日別サービスをすべて削除します。</v-card-text><v-card-actions><v-spacer /><v-btn variant="text" @click="confirmReset=false">キャンセル</v-btn><v-btn color="error" @click="reset">すべて削除</v-btn></v-card-actions></v-card></v-dialog>
  <v-snackbar v-model="showMessage" color="primary" timeout="4000">{{ store.message }}</v-snackbar>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { CareEstimateInput, CareServiceEntry, CareServiceEntryInput } from "../../shared/types";
import CareDailyServiceDialog from "../components/CareDailyServiceDialog.vue";
import { useCareEstimateStore } from "../stores/careEstimateStore";
import { calendarWeeksInMonth, formatMonth, isHoliday, isToday, isWeekend, weekdayLabel } from "../utils/date";
import { careClassificationOptions,careCopaymentOptions,regionalGradeOptions,sameBuildingOptions,initialAdditionOptions,emergencyAdditionOptions,specialManagementOptions,regionalRates,careProfessionLabels } from "../utils/careOptions";

const router=useRouter();const store=useCareEstimateStore();const dialogOpen=ref(false);const selectedDate=ref("");const selectedServices=ref<CareServiceEntry[]>([]);const confirmReset=ref(false);
const form=reactive<CareEstimateInput>({patientName:"",facilityName:"",targetMonth:"",careClassification:"care",copaymentRate:"unset",regionalGrade:"other",sameBuildingCategory:"none",initialAddition:"none",emergencyAddition:"none",specialManagementAddition:"none",dischargeJointGuidance:false,terminalCare:false,treatmentImprovement:false,rehabOver12Months:false,rehabFacilityReduction:false});
const weekdayLabels=["日","月","火","水","木","金","土"];const calendarWeeks=computed(()=>form.targetMonth?calendarWeeksInMonth(form.targetMonth):[]);const dayMap=computed(()=>new Map((store.estimate?.serviceDays||[]).filter(day=>day.visitDate.startsWith(`${form.targetMonth}-`)).map(day=>[day.visitDate,day])));
const showMessage=computed({get:()=>Boolean(store.message),set:value=>{if(!value)store.message=""}});
onMounted(async()=>{await store.load();if(store.estimate)Object.assign(form,headerFromEstimate(store.estimate))});
function headerFromEstimate(value:NonNullable<typeof store.estimate>):CareEstimateInput{return{id:value.id,patientName:value.patientName,facilityName:value.facilityName,targetMonth:value.targetMonth,careClassification:value.careClassification,copaymentRate:value.copaymentRate,regionalGrade:value.regionalGrade,sameBuildingCategory:value.sameBuildingCategory,initialAddition:value.initialAddition,emergencyAddition:value.emergencyAddition,specialManagementAddition:value.specialManagementAddition,dischargeJointGuidance:value.dischargeJointGuidance,terminalCare:value.terminalCare,treatmentImprovement:value.treatmentImprovement,rehabOver12Months:value.rehabOver12Months,rehabFacilityReduction:value.rehabFacilityReduction}}
async function saveHeader(){try{await store.saveEstimate({...form})}catch(error){store.error=error instanceof Error?error.message:"保存に失敗しました。"}}
async function onMonthChanged(){if(form.targetMonth<"2026-06")form.treatmentImprovement=false;await saveHeader()}
async function onInitialChanged(){if(form.initialAddition!=="none")form.dischargeJointGuidance=false;await saveHeader()}
function openDay(date:string){selectedDate.value=date;selectedServices.value=dayMap.value.get(date)?.services||[];dialogOpen.value=true}
async function saveDay(services:CareServiceEntryInput[]){if(!store.estimate)return;try{await store.saveDay({careEstimateId:store.estimate.id,visitDate:selectedDate.value,services});dialogOpen.value=false}catch(error){store.error=error instanceof Error?error.message:"保存に失敗しました。"}}
async function deleteDay(){try{await store.deleteDay(selectedDate.value);dialogOpen.value=false}catch(error){store.error=error instanceof Error?error.message:"削除に失敗しました。"}}
async function reset(){confirmReset.value=false;await store.reset()}
async function calculate(){if(!form.patientName.trim()){store.error="利用者名を入力してください。";return}if(!store.estimate?.serviceDays.some(day=>day.visitDate.startsWith(`${form.targetMonth}-`))){store.error="対象月の訪問サービスを1日以上登録してください。";return}try{await saveHeader();await store.calculate();await router.push({name:"care-cost-detail"})}catch(error){store.error=error instanceof Error?error.message:"計算に失敗しました。"}}
function dayClass(date:Date|null){if(!date)return["calendar-day","blank"];return["calendar-day",date.getDay()===0||isHoliday(date)?"sunday":date.getDay()===6?"saturday":"",isToday(date)?"is-today":"",dayMap.value.has(dateToKey(date))?"has-data":"",isWeekend(date)?"weekend":""]}
function dateToKey(date:Date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
</script>

<style scoped>
.header-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.condition-grid{display:grid;grid-template-columns:2fr repeat(3,1fr);gap:12px}.check-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 16px}.calendar-scroll{max-width:100%;overflow-x:auto;padding:2px 2px 8px}.care-calendar{display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));min-width:980px;border:1px solid #b7ccc7;border-radius:10px;overflow:hidden}.weekday-header{padding:9px;text-align:center;background:#e3f2ef;border-right:1px solid #b7ccc7;font-weight:700}.calendar-day{min-height:132px;padding:8px;border:0;border-right:1px solid #d0dedb;border-top:1px solid #d0dedb;background:white;text-align:left;vertical-align:top;cursor:pointer}.calendar-day:hover{background:#f0faf7}.calendar-day.blank{background:#f4f7f6;cursor:default}.calendar-day.sunday{background:#fff5f5}.calendar-day.saturday{background:#f2f7ff}.calendar-day.is-today{box-shadow:inset 0 0 0 3px #2e7d6e}.calendar-day.has-data{background:#eef8f5}.day-number{display:flex;justify-content:space-between}.day-summary{font-size:12px;margin-top:7px;display:grid;gap:4px}.empty-day{color:#78908b;font-size:12px;margin-top:12px}.legend{display:flex;gap:8px}.legend span{padding:3px 8px;border-radius:4px;font-size:12px}.legend .sun{background:#fff0f0}.legend .sat{background:#edf4ff}.legend .today{border:2px solid #2e7d6e}.action-row{display:flex;justify-content:space-between;align-items:center;margin-top:22px;gap:16px}@media(max-width:900px){.header-grid,.condition-grid,.check-grid{grid-template-columns:1fr 1fr}}@media(max-width:650px){.header-grid,.condition-grid,.check-grid{grid-template-columns:1fr}}
</style>
