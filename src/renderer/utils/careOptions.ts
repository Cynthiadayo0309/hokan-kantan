import type { CareEstimate, CareProfession, EndDayType } from "../../shared/types";

export const careClassificationOptions = [{title:"要介護（1～5）",value:"care"},{title:"要支援（1～2）",value:"support"}];
export const careCopaymentOptions = [{title:"未設定",value:"unset"},{title:"1割",value:"10"},{title:"2割",value:"20"},{title:"3割",value:"30"}];
export const regionalGradeOptions = [
  {title:"1級地（11.40円／単位）",value:"grade_1"},{title:"2級地（11.12円／単位）",value:"grade_2"},{title:"3級地（11.05円／単位）",value:"grade_3"},
  {title:"4級地（10.84円／単位）",value:"grade_4"},{title:"5級地（10.70円／単位）",value:"grade_5"},{title:"6級地（10.42円／単位）",value:"grade_6"},
  {title:"7級地（10.21円／単位）",value:"grade_7"},{title:"その他（10.00円／単位）",value:"other"}
];
export const sameBuildingOptions = [
  {title:"非該当",value:"none"},{title:"同一敷地・隣接（50人未満）：10%減算",value:"same_adjacent_under_50"},
  {title:"同一敷地・隣接（50人以上）：15%減算",value:"same_adjacent_50_plus"},{title:"その他の同一建物（20人以上）：10%減算",value:"other_building_20_plus"}
];
export const initialAdditionOptions = [{title:"対象外",value:"none"},{title:"初回加算（Ⅰ）",value:"type_1"},{title:"初回加算（Ⅱ）",value:"type_2"}];
export const emergencyAdditionOptions = [{title:"対象外",value:"none"},{title:"緊急時訪問看護加算（Ⅰ）",value:"type_1"},{title:"緊急時訪問看護加算（Ⅱ）",value:"type_2"}];
export const specialManagementOptions = [{title:"対象外",value:"none"},{title:"特別管理加算（Ⅰ）",value:"type_1"},{title:"特別管理加算（Ⅱ）",value:"type_2"}];
export const careProfessionOptions:{title:string;value:CareProfession}[]=[{title:"保健師",value:"public_health_nurse"},{title:"看護師",value:"nurse"},{title:"准看護師",value:"assistant_nurse"},{title:"理学療法士",value:"physical_therapist"},{title:"作業療法士",value:"occupational_therapist"},{title:"言語聴覚士",value:"speech_therapist"}];
export const endDayOptions:{title:string;value:EndDayType}[]=[{title:"当日",value:"same_day"},{title:"翌日",value:"next_day"}];
export const regionalRates:Record<CareEstimate["regionalGrade"],number>={grade_1:11.4,grade_2:11.12,grade_3:11.05,grade_4:10.84,grade_5:10.7,grade_6:10.42,grade_7:10.21,other:10};
export const careProfessionLabels:Record<CareProfession,string>={public_health_nurse:"保健師",nurse:"看護師",assistant_nurse:"准看護師",physical_therapist:"理学療法士",occupational_therapist:"作業療法士",speech_therapist:"言語聴覚士"};

export function timeOptions():string[]{const result:string[]=[];for(let minute=0;minute<24*60;minute+=5){result.push(`${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`)}return result}
