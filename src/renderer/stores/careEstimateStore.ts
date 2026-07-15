import { defineStore } from "pinia";
import type { CareCalculationResult, CareEstimate, CareEstimateInput, PricingVersion, SaveCareDayPayload } from "../../shared/types";

type State={estimate:CareEstimate|null;calculation:CareCalculationResult|null;pricingVersion:PricingVersion|null;loading:boolean;message:string;error:string};
export const useCareEstimateStore=defineStore("careEstimate",{state:():State=>({estimate:null,calculation:null,pricingVersion:null,loading:false,message:"",error:""}),actions:{
  async load(){this.loading=true;this.error="";try{const [estimate,version]=await Promise.all([window.hokanApi.getCareEstimate(),window.hokanApi.getCarePricingVersion()]);this.estimate=estimate;this.pricingVersion=version}catch(error){this.error=message(error)}finally{this.loading=false}},
  async saveEstimate(input:CareEstimateInput){this.error="";this.estimate=await window.hokanApi.saveCareEstimate(input);this.calculation=null},
  async saveDay(payload:SaveCareDayPayload){this.error="";this.estimate=await window.hokanApi.saveCareDay(payload);this.calculation=null;this.message=`${Number(payload.visitDate.slice(5,7))}月${Number(payload.visitDate.slice(8,10))}日の介護保険サービスを保存しました。`},
  async deleteDay(visitDate:string){if(!this.estimate)return;this.estimate=await window.hokanApi.deleteCareDay({careEstimateId:this.estimate.id,visitDate});this.calculation=null;this.message=`${Number(visitDate.slice(5,7))}月${Number(visitDate.slice(8,10))}日のサービスを削除しました。`},
  async calculate(){if(!this.estimate)throw new Error("入力データが見つかりません。");this.calculation=await window.hokanApi.calculateCareMonthlyEstimate({careEstimateId:this.estimate.id});return this.calculation},
  async reset(){if(!this.estimate)return;this.estimate=await window.hokanApi.resetCareEstimate({careEstimateId:this.estimate.id});this.calculation=null;this.message="介護保険の訪問内容をすべてクリアしました。"}
}});
function message(error:unknown):string{return error instanceof Error?error.message:"処理に失敗しました。"}
