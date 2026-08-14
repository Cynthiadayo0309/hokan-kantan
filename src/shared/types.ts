export type SameBuildingCategory =
  | "one"
  | "two"
  | "one_or_two"
  | "three_to_nine"
  | "ten_to_nineteen"
  | "twenty_to_forty_nine"
  | "fifty_or_more";

export type CopaymentRate = "unset" | "10" | "20" | "30";
export type ApplicableType = "applicable" | "not_applicable";
export type EndDayType = "same_day" | "next_day";
export type TimeZoneType = "midnight" | "early_morning" | "daytime" | "night" | "mixed";
export type PricingCategory = "basic" | "management" | "addition";
export type Profession =
  | "public_health_nurse"
  | "midwife"
  | "nurse"
  | "assistant_nurse"
  | "physical_therapist"
  | "occupational_therapist"
  | "speech_therapist";

export type ProfessionCategory = "nurse_group" | "assistant_nurse" | "rehab" | "any";
export type BasicFeeType = "type_2";
export type StationCategory = "enhanced_1" | "enhanced_2" | "enhanced_3" | "enhanced_4" | "standard";
export type SingleBuildingResidentCategory = "under_20" | "twenty_to_forty_nine" | "fifty_or_more";
export type SpecialManagementCategory = "none" | "yen_2500" | "yen_5000";
export type DischargeJointGuidanceCountCategory = "none" | "normal" | "two_times";
export type MultipleVisitEligibilityType = "none" | "specified_disease" | "special_instruction";
export type MultipleStaffCategory = "none" | "nurse_companion" | "assistant_nurse_companion" | "care_worker_normal" | "care_worker_special";
export type LongVisitEligibilityType = "none" | "under_15_severe_child" | "appendix_8" | "special_instruction" | "other";
export type DischargeSupportGuidanceCategory = "none" | "normal" | "long";
export type HighCostCareLimitCategory =
  | "unset"
  | "active_income_3"
  | "active_income_2"
  | "active_income_1"
  | "general"
  | "low_income_2"
  | "low_income_1";

export type HighCostCareLimitRule = {
  id?: number;
  ruleCode: string;
  category: Exclude<HighCostCareLimitCategory, "unset">;
  effectiveFrom: string;
  effectiveTo?: string;
  fixedAmount: number;
  medicalCostThreshold?: number;
  excessRate: number;
  annualLimitAmount?: number;
  outpatientAnnualLimitAmount?: number;
  versionLabel: string;
  sourceNote: string;
  sourceUrl: string;
  enabled: boolean;
};

export type AdditionType =
  | "none"
  | "long_visit"
  | "multiple_staff"
  | "emergency"
  | "special_management"
  | "special_management_guidance"
  | "discharge_joint_guidance"
  | "discharge_support_guidance"
  | "night_or_early_morning"
  | "midnight"
  | "multiple_visits";

export type UnitType = "per_visit" | "per_day" | "per_month" | "per_guidance";
export type RoundingType = "round" | "none";

export type TimeZoneBreakdown = {
  zone: Exclude<TimeZoneType, "mixed">;
  minutes: number;
};

export type VisitTimeSlotInput = {
  sequence: number;
  startTime: string;
  endTime: string;
  endDayType: EndDayType;
};

export type VisitTimeSlot = VisitTimeSlotInput & {
  id?: number;
  durationMinutes: number;
  timeZoneType: TimeZoneType;
  timeZoneBreakdown: TimeZoneBreakdown[];
};

export type DailyVisitInput = {
  id?: number;
  visitDate: string;
  basicFeeApplicable: ApplicableType;
  managementFeeApplicable: ApplicableType;
  profession: Profession;
  visitCount: number;
  longVisitType: ApplicableType;
  multipleStaffType: ApplicableType;
  emergencyType: ApplicableType;
  specialManagementType: "none" | "type_1" | "type_2";
  dischargeJointGuidanceType: ApplicableType;
  dischargeSupportGuidanceType: ApplicableType;
  timeVisitRequestedByPatientOrFamily: ApplicableType;
  multipleVisitEligibilityType: MultipleVisitEligibilityType;
  multipleStaffCategory: MultipleStaffCategory;
  singlePersonVisitDifficult: ApplicableType;
  multipleStaffConsent: ApplicableType;
  simultaneousMultipleStaffVisit: ApplicableType;
  longVisitEligibilityType: LongVisitEligibilityType;
  emergencyUnplanned: ApplicableType;
  emergencyRequestedByPatientOrFamily: ApplicableType;
  emergencyPhysicianInstruction: ApplicableType;
  dischargeSupportGuidanceCategory: DischargeSupportGuidanceCategory;
  dischargeSupportTotalMinutes: number;
  firstVisitAfterDischarge: ApplicableType;
  timeSlots: VisitTimeSlotInput[];
};

export type DailyVisit = Omit<DailyVisitInput, "timeSlots"> & {
  id: number;
  timeSlots: VisitTimeSlot[];
  warnings: string[];
};

export type MonthlyEstimate = {
  id: number;
  patientName: string;
  facilityName: string;
  targetMonth: string;
  sameBuildingCategory: SameBuildingCategory;
  copaymentRate: CopaymentRate;
  basicFeeType: BasicFeeType;
  stationCategory: StationCategory;
  singleBuildingResidentCategory: SingleBuildingResidentCategory;
  specialManagementCategory: SpecialManagementCategory;
  dischargeJointGuidanceCountCategory: DischargeJointGuidanceCountCategory;
  specialManagementGuidanceApplicable: ApplicableType;
  highCostCareLimitCategory: HighCostCareLimitCategory;
  dailyVisits: DailyVisit[];
  updatedAt: string;
};

export type MedicalEstimate = MonthlyEstimate;

export type MonthlyEstimateInput = {
  id?: number;
  patientName: string;
  facilityName: string;
  targetMonth: string;
  sameBuildingCategory: SameBuildingCategory;
  copaymentRate: CopaymentRate;
  basicFeeType: BasicFeeType;
  stationCategory: StationCategory;
  singleBuildingResidentCategory: SingleBuildingResidentCategory;
  specialManagementCategory: SpecialManagementCategory;
  dischargeJointGuidanceCountCategory: DischargeJointGuidanceCountCategory;
  specialManagementGuidanceApplicable: ApplicableType;
  highCostCareLimitCategory: HighCostCareLimitCategory;
};

export type CalculationLine = {
  category: PricingCategory;
  serviceName: string;
  conditionSummary: string;
  targetDates: string[];
  quantity: number;
  unitPrice: number;
  unitType?: UnitType;
  subtotal: number;
  evidence?: string;
  warning?: string;
  includedInTotal?: boolean;
  note?: string;
};

export type CalculationTotals = {
    basic: number;
    management: number;
    additions: number;
    grandTotal: number;
    copaymentAmountBeforeLimit?: number;
    copaymentAmount?: number;
    highCostCareLimitAmount?: number;
    highCostCareLimitApplied?: boolean;
};

export type MonthlyCalculationResult = {
  insuranceType: "medical";
  periodStartDate?: string;
  periodEndDate?: string;
  targetMonth?: string;
  lines: CalculationLine[];
  totals: CalculationTotals;
  warnings: string[];
  usesSamplePricing: boolean;
  highCostCareLimitRuleLabel?: string;
  monthlyResults?: MonthlyCalculationPeriodResult[];
  rangeTotal?: CalculationTotals;
};

export type MonthlyCalculationPeriodResult = Omit<MonthlyCalculationResult, "monthlyResults" | "rangeTotal"> & {
  periodStartDate: string;
  periodEndDate: string;
  targetMonth: string;
};

export type CalculateMonthlyEstimatePayload = {
  monthlyEstimateId: number;
  startDate?: string;
  endDate?: string;
};

export type PricingRule = {
  id: number;
  itemCode: string;
  itemName: string;
  category: PricingCategory;
  effectiveFrom: string;
  effectiveTo?: string | null;
  profession?: Profession | "any" | null;
  sameBuildingCategory?: SameBuildingCategory | "any" | null;
  weeklyVisitCountCategory?: string | null;
  dailyVisitCountCategory?: string | null;
  timeZoneType?: TimeZoneType | "any" | null;
  additionType?: AdditionType | "none" | null;
  unitPrice: number;
  unitType: UnitType;
  roundingType: RoundingType;
  note?: string | null;
  enabled: boolean;
  samplePrice: boolean;
  feeFamily?: string | null;
  feeCode?: string | null;
  professionCategory?: ProfessionCategory | null;
  basicFeeType?: BasicFeeType | null;
  sameBuildingDailyCountCategory?: SameBuildingCategory | "one_to_two" | "any" | null;
  singleBuildingResidentCategory?: SingleBuildingResidentCategory | "any" | null;
  stationCategory?: StationCategory | "any" | null;
  weeklyVisitDayRange?: string | null;
  monthlyVisitDayRange?: string | null;
  dailyVisitCountRange?: string | null;
  timeZoneCategory?: "night_early" | "midnight" | "any" | null;
  companionCategory?: MultipleStaffCategory | "any" | null;
  maximumFrequencyType?: string | null;
  maximumFrequencyCount?: number | null;
  sourceNote?: string | null;
};

export type EligibilityRule = {
  id: number;
  ruleCode: string;
  feeCode: string;
  professionAllowList: ProfessionCategory[];
  requiredConditions: string[];
  frequencyLimitType?: string | null;
  frequencyLimitCount?: number | null;
  warningMessage?: string | null;
  errorMessage?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export type SaveDailyVisitPayload = {
  monthlyEstimateId: number;
  visit: DailyVisitInput;
};

export type SaveDailyVisitsPayload = {
  monthlyEstimateId: number;
  visits: DailyVisitInput[];
};

export type DeleteDailyVisitPayload = {
  monthlyEstimateId: number;
  visitDate: string;
};

export type ResetEstimatePayload = {
  monthlyEstimateId: number;
};

export type MonthlyReportExportPayload = {
  monthlyEstimateId: number;
};

export type MonthlyReportExportResult = {
  canceled: boolean;
  filePath?: string;
};

export type IconPreference = {
  hasCustomIcon: boolean;
  iconPath?: string;
  message: string;
};

export type IconOperationResult = {
  applied: boolean;
  message: string;
  iconPath?: string;
};

export type PricingVersion = {
  label: string;
  usesSamplePricing: boolean;
  ruleCount: number;
};

export type InsuranceType = "medical" | "care";
export type CareClassification = "care" | "support";
export type CareRegionalGrade = "grade_1" | "grade_2" | "grade_3" | "grade_4" | "grade_5" | "grade_6" | "grade_7" | "other";
export type CareSameBuildingCategory = "none" | "same_adjacent_under_50" | "same_adjacent_50_plus" | "other_building_20_plus";
export type CareInitialAddition = "none" | "type_1" | "type_2";
export type CareEmergencyAddition = "none" | "type_1" | "type_2";
export type CareSpecialManagementAddition = "none" | "type_1" | "type_2";
export type CareProfession =
  | "public_health_nurse"
  | "nurse"
  | "assistant_nurse"
  | "physical_therapist"
  | "occupational_therapist"
  | "speech_therapist";
export type CareServiceCategory = "under_20" | "under_30" | "under_60" | "under_90" | "long" | "rehab";
export type CareNursingBillingCategory = "under_20" | "under_30" | "under_60" | "under_90" | "long";
export type CareLineCategory = "basic" | "addition" | "deduction";

export type CareServiceEntryInput = {
  id?: number;
  sequence: number;
  profession: CareProfession;
  startTime: string;
  /** 旧形式の入力との互換用。新規入力では算定区分から自動計算する。 */
  endTime?: string;
  /** 旧形式の入力との互換用。新規入力では算定区分から自動計算する。 */
  endDayType?: EndDayType;
  unplannedEmergency: boolean;
  billingCategory?: CareNursingBillingCategory;
  rehabDurationMinutes?: 20 | 40;
};

export type CareServiceEntry = Omit<CareServiceEntryInput, "endTime" | "endDayType"> & {
  id: number;
  endTime: string;
  endDayType: EndDayType;
  durationMinutes: number;
  serviceCategory: CareServiceCategory;
  timeZoneType: TimeZoneType;
  timeZoneBreakdown: TimeZoneBreakdown[];
  warnings: string[];
};

export type CareServiceDay = {
  visitDate: string;
  services: CareServiceEntry[];
};

export type CareEstimateInput = {
  id?: number;
  patientName: string;
  facilityName: string;
  targetMonth: string;
  careClassification: CareClassification;
  copaymentRate: CopaymentRate;
  regionalGrade: CareRegionalGrade;
  sameBuildingCategory: CareSameBuildingCategory;
  initialAddition: CareInitialAddition;
  emergencyAddition: CareEmergencyAddition;
  specialManagementAddition: CareSpecialManagementAddition;
  dischargeJointGuidance: boolean;
  terminalCare: boolean;
  treatmentImprovement: boolean;
  rehabOver12Months: boolean;
  rehabFacilityReduction: boolean;
};

export type CareEstimate = Omit<CareEstimateInput, "id"> & {
  id: number;
  serviceDays: CareServiceDay[];
  updatedAt: string;
};

export type SaveCareDayPayload = {
  careEstimateId: number;
  visitDate: string;
  services: CareServiceEntryInput[];
};

export type CareServiceDayInput = {
  visitDate: string;
  services: CareServiceEntryInput[];
};

export type SaveCareDaysPayload = {
  careEstimateId: number;
  days: CareServiceDayInput[];
};

export type DeleteCareDayPayload = {
  careEstimateId: number;
  visitDate: string;
};

export type CalculateCareEstimatePayload = {
  careEstimateId: number;
};

export type ResetCareEstimatePayload = {
  careEstimateId: number;
};

export type CarePricingRule = {
  id: number;
  code: string;
  name: string;
  category: CareLineCategory;
  effectiveFrom: string;
  effectiveTo?: string | null;
  careClassification?: CareClassification | "any" | null;
  professionCategory?: "nurse" | "rehab" | "any" | null;
  serviceCategory?: CareServiceCategory | "any" | null;
  unitCount: number;
  percentage?: number | null;
  sourceNote: string;
};

export type CareCalculationLine = {
  category: CareLineCategory;
  serviceName: string;
  conditionSummary: string;
  targetDates: string[];
  quantity: number;
  unitCount: number;
  subtotalUnits: number;
  regionalUnitPrice: number;
  amount: number;
  includedInTotal: boolean;
  evidence?: string;
  warning?: string;
  note?: string;
};

export type CareCalculationResult = {
  insuranceType: "care";
  targetMonth: string;
  lines: CareCalculationLine[];
  totals: {
    basicUnits: number;
    additionUnits: number;
    deductionUnits: number;
    totalUnits: number;
    regionalUnitPrice: number;
    grandTotal: number;
    copaymentAmount?: number;
  };
  warnings: string[];
  usesSamplePricing: false;
};

export type InsuranceEstimate =
  | { insuranceType: "medical"; estimate: MedicalEstimate }
  | { insuranceType: "care"; estimate: CareEstimate };

export type InsuranceCalculationResult = MonthlyCalculationResult | CareCalculationResult;

export type CareReportExportPayload = {
  careEstimateId: number;
};

export type HokanApi = {
  getEstimate: () => Promise<MonthlyEstimate>;
  saveEstimate: (payload: MonthlyEstimateInput) => Promise<MonthlyEstimate>;
  saveDailyVisit: (payload: SaveDailyVisitPayload) => Promise<DailyVisit>;
  saveDailyVisits: (payload: SaveDailyVisitsPayload) => Promise<MonthlyEstimate>;
  deleteDailyVisit: (payload: DeleteDailyVisitPayload) => Promise<MonthlyEstimate>;
  calculateMonthlyEstimate: (payload: CalculateMonthlyEstimatePayload) => Promise<MonthlyCalculationResult>;
  resetEstimate: (payload: ResetEstimatePayload) => Promise<MonthlyEstimate>;
  getPricingVersion: () => Promise<PricingVersion>;
  previewMonthlyReport: (payload: MonthlyReportExportPayload) => Promise<void>;
  printMonthlyReport: (payload: MonthlyReportExportPayload) => Promise<MonthlyReportExportResult>;
  exportMonthlyReportPdf: (payload: MonthlyReportExportPayload) => Promise<MonthlyReportExportResult>;
  exportMonthlyReportExcel: (payload: MonthlyReportExportPayload) => Promise<MonthlyReportExportResult>;
  getIconPreference: () => Promise<IconPreference>;
  selectCustomIcon: () => Promise<IconOperationResult>;
  resetCustomIcon: () => Promise<IconOperationResult>;
  getCareEstimate: () => Promise<CareEstimate>;
  saveCareEstimate: (payload: CareEstimateInput) => Promise<CareEstimate>;
  saveCareDay: (payload: SaveCareDayPayload) => Promise<CareEstimate>;
  saveCareDays: (payload: SaveCareDaysPayload) => Promise<CareEstimate>;
  deleteCareDay: (payload: DeleteCareDayPayload) => Promise<CareEstimate>;
  calculateCareMonthlyEstimate: (payload: CalculateCareEstimatePayload) => Promise<CareCalculationResult>;
  resetCareEstimate: (payload: ResetCareEstimatePayload) => Promise<CareEstimate>;
  getCarePricingVersion: () => Promise<PricingVersion>;
  previewCareMonthlyReport: (payload: CareReportExportPayload) => Promise<void>;
  printCareMonthlyReport: (payload: CareReportExportPayload) => Promise<MonthlyReportExportResult>;
  exportCareMonthlyReportPdf: (payload: CareReportExportPayload) => Promise<MonthlyReportExportResult>;
  exportCareMonthlyReportExcel: (payload: CareReportExportPayload) => Promise<MonthlyReportExportResult>;
};

export const labels = {
  sameBuildingCategory: {
    one: "1人",
    two: "2人",
    one_or_two: "1人または2人（要確認）",
    three_to_nine: "3人以上9人以下",
    ten_to_nineteen: "10人以上19人以下",
    twenty_to_forty_nine: "20人以上49人以下",
    fifty_or_more: "50人以上"
  },
  copaymentRate: {
    unset: "未設定",
    "10": "1割",
    "20": "2割",
    "30": "3割"
  },
  profession: {
    public_health_nurse: "保健師",
    midwife: "助産師",
    nurse: "看護師",
    assistant_nurse: "准看護師",
    physical_therapist: "理学療法士",
    occupational_therapist: "作業療法士",
    speech_therapist: "言語聴覚士"
  },
  timeZone: {
    midnight: "深夜",
    early_morning: "早朝",
    daytime: "通常",
    night: "夜間",
    mixed: "時間帯またぎ"
  },
  stationCategory: {
    enhanced_1: "機能強化型1",
    enhanced_2: "機能強化型2",
    enhanced_3: "機能強化型3",
    enhanced_4: "機能強化型4",
    standard: "上記以外"
  },
  singleBuildingResidentCategory: {
    under_20: "20人未満",
    twenty_to_forty_nine: "20人以上49人以下",
    fifty_or_more: "50人以上"
  },
  specialManagementCategory: {
    none: "対象外",
    yen_2500: "2,500円区分",
    yen_5000: "5,000円区分"
  },
  dischargeJointGuidanceCountCategory: {
    none: "対象外",
    normal: "対象",
    two_times: "特定疾病等により2回対象"
  },
  multipleVisitEligibilityType: {
    none: "対象外",
    specified_disease: "厚生労働大臣が定める疾病等",
    special_instruction: "特別訪問看護指示書あり"
  },
  multipleStaffCategory: {
    none: "対象外",
    nurse_companion: "看護師等が同行",
    assistant_nurse_companion: "准看護師が同行",
    care_worker_normal: "その他職員が同行（通常）",
    care_worker_special: "その他職員が同行（特定要件）"
  },
  longVisitEligibilityType: {
    none: "対象外",
    under_15_severe_child: "15歳未満の超重症児・準超重症児",
    appendix_8: "別表第8対象",
    special_instruction: "特別訪問看護指示書等",
    other: "その他対象要件"
  },
  dischargeSupportGuidanceCategory: {
    none: "対象外",
    normal: "通常",
    long: "長時間指導"
  },
  highCostCareLimitCategory: {
    unset: "未設定",
    active_income_3: "現役並みⅢ",
    active_income_2: "現役並みⅡ",
    active_income_1: "現役並みⅠ",
    general: "一般",
    low_income_2: "住民税非課税Ⅱ",
    low_income_1: "住民税非課税Ⅰ"
  },
  unitType: {
    per_visit: "1回当たり",
    per_day: "1日当たり",
    per_month: "1月当たり",
    per_guidance: "1回当たり"
  }
} as const;
