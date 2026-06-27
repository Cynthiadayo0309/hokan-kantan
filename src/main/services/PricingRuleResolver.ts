import type {
  AdditionType,
  BasicFeeType,
  MultipleStaffCategory,
  PricingCategory,
  PricingRule,
  Profession,
  ProfessionCategory,
  SameBuildingCategory,
  SingleBuildingResidentCategory,
  StationCategory,
  TimeZoneType
} from "../../shared/types";

type ResolveInput = {
  category: PricingCategory;
  feeCode?: string;
  targetDate: string;
  profession?: Profession;
  professionCategory?: ProfessionCategory;
  sameBuildingCategory?: SameBuildingCategory;
  sameBuildingDailyCountCategory?: SameBuildingCategory | "one_to_two";
  singleBuildingResidentCategory?: SingleBuildingResidentCategory;
  stationCategory?: StationCategory;
  basicFeeType?: BasicFeeType;
  weeklyVisitDay?: number;
  monthlyVisitDay?: number;
  dailyVisitCount?: number;
  timeZoneType?: TimeZoneType;
  additionType?: AdditionType;
  companionCategory?: MultipleStaffCategory;
  dailyVisitCountCategory?: string;
};

export type PricingResolveResult =
  | { ok: true; rule: PricingRule }
  | { ok: false; message: string; matches: PricingRule[] };

export class PricingRuleResolver {
  constructor(private readonly rules: PricingRule[]) {}

  resolve(input: ResolveInput): PricingResolveResult {
    const matches = this.rules.filter((rule) => this.isMatch(rule, input));
    if (matches.length === 0) {
      return { ok: false, message: "算定条件に一致する正式料金が見つかりません。", matches };
    }
    if (matches.length > 1) {
      return { ok: false, message: "算定条件に一致する正式料金が複数あります。料金マスターを確認してください。", matches };
    }
    return { ok: true, rule: matches[0] };
  }

  private isMatch(rule: PricingRule, input: ResolveInput): boolean {
    if (!rule.enabled || rule.category !== input.category) return false;
    if (input.feeCode && rule.feeCode !== input.feeCode) return false;
    if (rule.effectiveFrom > input.targetDate) return false;
    if (rule.effectiveTo && rule.effectiveTo < input.targetDate) return false;
    if (!this.matches(rule.profession, input.profession)) return false;
    if (!this.matches(rule.sameBuildingCategory, input.sameBuildingCategory)) return false;
    if (!this.matches(rule.professionCategory, input.professionCategory)) return false;
    if (!this.matches(rule.basicFeeType, input.basicFeeType)) return false;
    if (!this.matchesSameBuilding(rule.sameBuildingDailyCountCategory, input.sameBuildingDailyCountCategory)) return false;
    if (!this.matches(rule.singleBuildingResidentCategory, input.singleBuildingResidentCategory)) return false;
    if (!this.matches(rule.stationCategory, input.stationCategory)) return false;
    if (!this.matchesRange(rule.weeklyVisitDayRange, input.weeklyVisitDay)) return false;
    if (!this.matchesRange(rule.monthlyVisitDayRange, input.monthlyVisitDay)) return false;
    if (!this.matchesRange(rule.dailyVisitCountRange, input.dailyVisitCount)) return false;
    if (!this.matches(rule.weeklyVisitCountCategory, input.weeklyVisitDay ? String(input.weeklyVisitDay) : undefined)) return false;
    if (!this.matches(rule.dailyVisitCountCategory, input.dailyVisitCountCategory)) return false;
    if (!this.matches(rule.timeZoneType, input.timeZoneType)) return false;
    if (!this.matches(rule.additionType, input.additionType)) return false;
    if (!this.matches(rule.companionCategory, input.companionCategory)) return false;
    return true;
  }

  private matches(ruleValue: string | null | undefined, inputValue: string | undefined): boolean {
    return !ruleValue || ruleValue === "any" || (ruleValue === "none" && !inputValue) || ruleValue === inputValue;
  }

  private matchesSameBuilding(ruleValue: string | null | undefined, inputValue: string | undefined): boolean {
    if (!ruleValue || ruleValue === "any") return true;
    if (ruleValue === "one_to_two") return inputValue === "one" || inputValue === "two";
    return ruleValue === inputValue;
  }

  private matchesRange(ruleValue: string | null | undefined, inputValue: number | undefined): boolean {
    if (!ruleValue || inputValue === undefined) return true;
    const [minText, maxText] = ruleValue.split("-");
    const min = Number(minText);
    const max = Number(maxText);
    return inputValue >= min && inputValue <= max;
  }
}
