import type {
  ApplicableType,
  CopaymentRate,
  DischargeJointGuidanceCountCategory,
  DischargeSupportGuidanceCategory,
  LongVisitEligibilityType,
  MultipleStaffCategory,
  MultipleVisitEligibilityType,
  Profession,
  SameBuildingCategory,
  SingleBuildingResidentCategory,
  SpecialManagementCategory,
  StationCategory
} from "../../shared/types";
import { labels } from "../../shared/types";

const visibleSameBuildingCategories: SameBuildingCategory[] = ["one", "two", "three_to_nine", "ten_to_nineteen", "twenty_to_forty_nine", "fifty_or_more"];

export const sameBuildingOptions = visibleSameBuildingCategories.map((value) => ({ value, title: labels.sameBuildingCategory[value] }));
export const copaymentOptions = Object.entries(labels.copaymentRate).map(([value, title]) => ({ value: value as CopaymentRate, title }));
export const professionOptions = Object.entries(labels.profession).map(([value, title]) => ({ value: value as Profession, title }));
export const stationOptions = Object.entries(labels.stationCategory).map(([value, title]) => ({ value: value as StationCategory, title }));
export const singleBuildingResidentOptions = Object.entries(labels.singleBuildingResidentCategory).map(([value, title]) => ({
  value: value as SingleBuildingResidentCategory,
  title
}));
export const specialManagementCategoryOptions = Object.entries(labels.specialManagementCategory).map(([value, title]) => ({
  value: value as SpecialManagementCategory,
  title
}));
export const dischargeJointGuidanceCountOptions = Object.entries(labels.dischargeJointGuidanceCountCategory).map(([value, title]) => ({
  value: value as DischargeJointGuidanceCountCategory,
  title
}));
export const multipleVisitEligibilityOptions = Object.entries(labels.multipleVisitEligibilityType).map(([value, title]) => ({
  value: value as MultipleVisitEligibilityType,
  title
}));
export const multipleStaffCategoryOptions = Object.entries(labels.multipleStaffCategory).map(([value, title]) => ({
  value: value as MultipleStaffCategory,
  title
}));
export const longVisitEligibilityOptions = Object.entries(labels.longVisitEligibilityType).map(([value, title]) => ({
  value: value as LongVisitEligibilityType,
  title
}));
export const dischargeSupportGuidanceOptions = Object.entries(labels.dischargeSupportGuidanceCategory).map(([value, title]) => ({
  value: value as DischargeSupportGuidanceCategory,
  title
}));
export const applicableOptions: Array<{ value: ApplicableType; title: string }> = [
  { value: "applicable", title: "対象" },
  { value: "not_applicable", title: "対象外" }
];
export const notApplicableFirstOptions: Array<{ value: ApplicableType; title: string }> = [
  { value: "not_applicable", title: "対象外" },
  { value: "applicable", title: "対象" }
];

export const timeOptions = Array.from({ length: 24 * 12 }, (_, index) => {
  const minutes = index * 5;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
