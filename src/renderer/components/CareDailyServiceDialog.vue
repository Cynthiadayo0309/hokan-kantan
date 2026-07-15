<template>
  <v-dialog :model-value="modelValue" max-width="1050" persistent scrollable @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between pa-5">
        <div><div class="text-h6 font-weight-bold">{{ displayDate }} の介護保険サービス</div><div class="text-caption text-medium-emphasis">同じ日に看護職とリハビリ職を複数登録できます。</div></div>
        <v-btn icon="mdi-close" variant="text" aria-label="閉じる" @click="close" />
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-5">
        <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
        <section v-for="(service,index) in form" :key="index" class="service-card mb-4">
          <div class="d-flex align-center justify-space-between mb-3"><h3 class="text-subtitle-1 font-weight-bold">{{ index+1 }}件目</h3><v-btn v-if="form.length>1" color="error" variant="text" prepend-icon="mdi-delete-outline" @click="remove(index)">この行を削除</v-btn></div>
          <div class="service-grid">
            <v-select v-model="service.profession" label="訪問職種（必須）" :items="careProfessionOptions" item-title="title" item-value="value" />
            <v-select v-model="service.startTime" label="開始時刻（必須）" :items="times" />
            <v-select v-model="service.endTime" label="終了時刻（必須）" :items="times" />
            <v-select v-model="service.endDayType" label="終了日" :items="endDayOptions" item-title="title" item-value="value" />
          </div>
          <v-checkbox v-model="service.unplannedEmergency" label="計画外の緊急訪問" hide-details class="mt-n2" />
          <v-alert v-if="previews[index].error" type="error" variant="tonal" density="compact">{{ previews[index].error }}</v-alert>
          <div v-else class="preview-grid">
            <div><span>訪問時間</span><strong>{{ previews[index].durationMinutes }}分</strong></div>
            <div><span>算定区分</span><strong>{{ serviceCategoryLabel(service.profession,previews[index].durationMinutes) }}</strong></div>
            <div><span>開始時間帯</span><strong>{{ startZoneLabel(service.startTime) }}</strong></div>
            <div><span>時間帯内訳</span><strong>{{ breakdownLabel(previews[index].breakdown) }}</strong></div>
          </div>
          <v-alert v-if="previews[index].timeZoneType==='mixed'" type="warning" variant="tonal" density="compact" class="mt-3">複数の時間帯にまたがっています。時間帯加算は開始時刻で判定します。</v-alert>
          <v-alert v-if="isRehab(service.profession)&&previews[index].durationMinutes%20!==0" type="warning" variant="tonal" density="compact" class="mt-3">20分に満たない端数時間は算定回数に含めません。</v-alert>
        </section>
        <v-btn variant="outlined" color="primary" prepend-icon="mdi-plus" @click="add">サービスを追加</v-btn>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-5 d-flex flex-wrap ga-3">
        <v-btn color="primary" size="large" prepend-icon="mdi-content-save" @click="save">この日の内容を保存</v-btn>
        <v-btn v-if="hasExisting" color="error" variant="outlined" prepend-icon="mdi-delete" @click="confirmDelete=true">この日の内容を削除</v-btn>
        <v-spacer /><v-btn variant="text" size="large" @click="close">閉じる</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <v-dialog v-model="confirmDelete" max-width="440"><v-card><v-card-title>この日の内容を削除しますか？</v-card-title><v-card-text>{{ displayDate }}に登録したすべてのサービスを削除します。</v-card-text><v-card-actions><v-spacer /><v-btn variant="text" @click="confirmDelete=false">キャンセル</v-btn><v-btn color="error" @click="removeDay">削除する</v-btn></v-card-actions></v-card></v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CareProfession, CareServiceEntry, CareServiceEntryInput, TimeZoneBreakdown } from "../../shared/types";
import { careProfessionOptions, endDayOptions, timeOptions } from "../utils/careOptions";
import { previewTime } from "../utils/timePreview";

const props=defineProps<{modelValue:boolean;visitDate:string;services:CareServiceEntry[]}>();
const emit=defineEmits<{"update:modelValue":[boolean];save:[CareServiceEntryInput[]];delete:[]}>();
const form=ref<CareServiceEntryInput[]>([]);const error=ref("");const confirmDelete=ref(false);const times=timeOptions();
const displayDate=computed(()=>props.visitDate?`${Number(props.visitDate.slice(5,7))}月${Number(props.visitDate.slice(8,10))}日`:"");
const hasExisting=computed(()=>props.services.length>0);
const previews=computed(()=>form.value.map(item=>previewTime(item.startTime,item.endTime,item.endDayType)));
watch(()=>props.modelValue,value=>{if(value){form.value=props.services.length?props.services.map(toInput):[defaultService()];error.value=""}},{immediate:true});
function toInput(service:CareServiceEntry):CareServiceEntryInput{return{sequence:service.sequence,profession:service.profession,startTime:service.startTime,endTime:service.endTime,endDayType:service.endDayType,unplannedEmergency:service.unplannedEmergency}}
function defaultService():CareServiceEntryInput{return{sequence:form.value.length+1,profession:"nurse",startTime:"09:00",endTime:"09:30",endDayType:"same_day",unplannedEmergency:false}}
function add(){form.value.push(defaultService())}function remove(index:number){form.value.splice(index,1);form.value.forEach((item,i)=>item.sequence=i+1)}
function close(){emit("update:modelValue",false)}
function save(){const invalid=previews.value.find(item=>item.error);if(invalid){error.value=invalid.error;return}if(form.value.some((item,index)=>isRehab(item.profession)&&previews.value[index].durationMinutes<20)){error.value="リハビリ専門職の訪問は20分以上で入力してください。";return}emit("save",form.value.map((item,index)=>({...item,sequence:index+1})))}
function removeDay(){confirmDelete.value=false;emit("delete")}
function isRehab(value:CareProfession){return["physical_therapist","occupational_therapist","speech_therapist"].includes(value)}
function serviceCategoryLabel(profession:CareProfession,minutes:number){if(isRehab(profession))return `${Math.floor(minutes/20)}回（20分単位）`;if(minutes<20)return"20分未満";if(minutes<30)return"20分以上30分未満";if(minutes<60)return"30分以上1時間未満";if(minutes<90)return"1時間以上1時間30分未満";return"90分以上（長時間）"}
function startZoneLabel(time:string){const minute=Number(time.slice(0,2))*60+Number(time.slice(3));if(minute<360||minute>=1320)return"深夜";if(minute<480)return"早朝";if(minute<1080)return"通常";return"夜間"}
function breakdownLabel(value:TimeZoneBreakdown[]){const labels={midnight:"深夜",early_morning:"早朝",daytime:"通常",night:"夜間"};return value.map(item=>`${labels[item.zone]}${item.minutes}分`).join("、")}
</script>

<style scoped>
.service-card{border:1px solid #b7ccc7;border-radius:12px;padding:18px;background:#fbfefd}.service-grid{display:grid;grid-template-columns:1.3fr repeat(3,1fr);gap:12px}.preview-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px;border-radius:8px;background:#eaf5f2}.preview-grid span{display:block;font-size:12px;color:#55736d}.preview-grid strong{display:block;margin-top:3px}@media(max-width:800px){.service-grid,.preview-grid{grid-template-columns:1fr 1fr}}
</style>
