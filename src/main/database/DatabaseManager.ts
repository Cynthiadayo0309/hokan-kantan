import Database from "better-sqlite3";
import { app } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const INITIAL_MIGRATION_ID = "001_initial_schema";
const FORMAL_PRICING_MIGRATION_ID = "002_formal_pricing";
const HIGH_COST_CARE_LIMIT_MIGRATION_ID = "003_high_cost_care_limit";
const CARE_INSURANCE_MIGRATION_ID = "004_care_insurance";

export class DatabaseManager {
  private db?: Database.Database;

  get connection(): Database.Database {
    if (!this.db) {
      throw new Error("データベースが初期化されていません。");
    }
    return this.db;
  }

  initialize(): Database.Database {
    const userDataPath = app.getPath("userData");
    mkdirSync(userDataPath, { recursive: true });
    const dbPath = path.join(userDataPath, "application.db");
    const existed = existsSync(dbPath);
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.ensureMigrationTable();
    const hasPendingMigration =
      !this.hasMigration(INITIAL_MIGRATION_ID) ||
      !this.hasMigration(FORMAL_PRICING_MIGRATION_ID) ||
      !this.hasMigration(HIGH_COST_CARE_LIMIT_MIGRATION_ID) ||
      !this.hasMigration(CARE_INSURANCE_MIGRATION_ID);
    if (existed && hasPendingMigration) {
      this.backupDatabase(dbPath);
    }

    this.runInitialMigration();
    this.runFormalPricingMigration();
    this.runHighCostCareLimitMigration();
    this.runCareInsuranceMigration();
    this.seedSamplePricingRules();
    this.seedFormalPricingRules();
    this.seedCarePricingRules();
    return this.db;
  }

  private ensureMigrationTable(): void {
    this.connection.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
  }

  private hasMigration(id: string): boolean {
    const row = this.connection.prepare("SELECT id FROM schema_migrations WHERE id = ?").get(id);
    return Boolean(row);
  }

  private backupDatabase(dbPath: string): void {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    copyFileSync(dbPath, `${dbPath}.${stamp}.bak`);
  }

  private runInitialMigration(): void {
    if (this.hasMigration(INITIAL_MIGRATION_ID)) {
      return;
    }

    const migrate = this.connection.transaction(() => {
      this.connection.exec(`
        CREATE TABLE monthly_estimates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_name TEXT NOT NULL DEFAULT '',
          facility_name TEXT NOT NULL DEFAULT '',
          target_month TEXT NOT NULL,
          same_building_category TEXT NOT NULL,
          copayment_rate TEXT NOT NULL,
          basic_fee_type TEXT NOT NULL DEFAULT 'type_2',
          station_category TEXT NOT NULL DEFAULT 'standard',
          single_building_resident_category TEXT NOT NULL DEFAULT 'under_20',
          special_management_category TEXT NOT NULL DEFAULT 'none',
          discharge_joint_guidance_count_category TEXT NOT NULL DEFAULT 'none',
          special_management_guidance_applicable TEXT NOT NULL DEFAULT 'not_applicable',
          high_cost_care_limit_category TEXT NOT NULL DEFAULT 'unset',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE daily_visits (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          monthly_estimate_id INTEGER NOT NULL,
          visit_date TEXT NOT NULL,
          basic_fee_applicable TEXT NOT NULL,
          management_fee_applicable TEXT NOT NULL,
          profession TEXT NOT NULL,
          visit_count INTEGER NOT NULL,
          long_visit_type TEXT NOT NULL,
          multiple_staff_type TEXT NOT NULL,
          emergency_type TEXT NOT NULL,
          special_management_type TEXT NOT NULL,
          discharge_joint_guidance_type TEXT NOT NULL,
          discharge_support_guidance_type TEXT NOT NULL,
          time_visit_requested_by_patient_or_family TEXT NOT NULL DEFAULT 'not_applicable',
          multiple_visit_eligibility_type TEXT NOT NULL DEFAULT 'none',
          multiple_staff_category TEXT NOT NULL DEFAULT 'none',
          single_person_visit_difficult TEXT NOT NULL DEFAULT 'not_applicable',
          multiple_staff_consent TEXT NOT NULL DEFAULT 'not_applicable',
          simultaneous_multiple_staff_visit TEXT NOT NULL DEFAULT 'not_applicable',
          long_visit_eligibility_type TEXT NOT NULL DEFAULT 'none',
          emergency_unplanned TEXT NOT NULL DEFAULT 'not_applicable',
          emergency_requested_by_patient_or_family TEXT NOT NULL DEFAULT 'not_applicable',
          emergency_physician_instruction TEXT NOT NULL DEFAULT 'not_applicable',
          discharge_support_guidance_category TEXT NOT NULL DEFAULT 'none',
          discharge_support_total_minutes INTEGER NOT NULL DEFAULT 0,
          first_visit_after_discharge TEXT NOT NULL DEFAULT 'not_applicable',
          warnings_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(monthly_estimate_id, visit_date),
          FOREIGN KEY(monthly_estimate_id) REFERENCES monthly_estimates(id) ON DELETE CASCADE
        );

        CREATE TABLE visit_time_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          daily_visit_id INTEGER NOT NULL,
          sequence INTEGER NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          end_day_type TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          time_zone_type TEXT NOT NULL,
          time_zone_breakdown_json TEXT NOT NULL,
          FOREIGN KEY(daily_visit_id) REFERENCES daily_visits(id) ON DELETE CASCADE
        );

        CREATE TABLE pricing_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_code TEXT NOT NULL UNIQUE,
          item_name TEXT NOT NULL,
          category TEXT NOT NULL,
          effective_from TEXT NOT NULL,
          effective_to TEXT,
          profession TEXT,
          same_building_category TEXT,
          weekly_visit_count_category TEXT,
          daily_visit_count_category TEXT,
          time_zone_type TEXT,
          addition_type TEXT,
          unit_price INTEGER NOT NULL,
          unit_type TEXT NOT NULL,
          rounding_type TEXT NOT NULL,
          note TEXT,
          enabled INTEGER NOT NULL,
          sample_price INTEGER NOT NULL,
          is_sample INTEGER NOT NULL DEFAULT 1,
          fee_family TEXT,
          fee_code TEXT,
          profession_category TEXT,
          basic_fee_type TEXT,
          same_building_daily_count_category TEXT,
          single_building_resident_category TEXT,
          station_category TEXT,
          weekly_visit_day_range TEXT,
          monthly_visit_day_range TEXT,
          daily_visit_count_range TEXT,
          time_zone_category TEXT,
          companion_category TEXT,
          maximum_frequency_type TEXT,
          maximum_frequency_count INTEGER,
          source_note TEXT
        );
      `);
      this.markMigrationApplied(INITIAL_MIGRATION_ID);
    });

    migrate();
  }

  private runFormalPricingMigration(): void {
    if (this.hasMigration(FORMAL_PRICING_MIGRATION_ID)) {
      return;
    }

    const migrate = this.connection.transaction(() => {
      this.addColumnIfMissing("monthly_estimates", "basic_fee_type", "TEXT NOT NULL DEFAULT 'type_2'");
      this.addColumnIfMissing("monthly_estimates", "station_category", "TEXT NOT NULL DEFAULT 'standard'");
      this.addColumnIfMissing("monthly_estimates", "single_building_resident_category", "TEXT NOT NULL DEFAULT 'under_20'");
      this.addColumnIfMissing("monthly_estimates", "special_management_category", "TEXT NOT NULL DEFAULT 'none'");
      this.addColumnIfMissing("monthly_estimates", "discharge_joint_guidance_count_category", "TEXT NOT NULL DEFAULT 'none'");
      this.addColumnIfMissing("monthly_estimates", "special_management_guidance_applicable", "TEXT NOT NULL DEFAULT 'not_applicable'");

      this.addColumnIfMissing("daily_visits", "time_visit_requested_by_patient_or_family", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "multiple_visit_eligibility_type", "TEXT NOT NULL DEFAULT 'none'");
      this.addColumnIfMissing("daily_visits", "multiple_staff_category", "TEXT NOT NULL DEFAULT 'none'");
      this.addColumnIfMissing("daily_visits", "single_person_visit_difficult", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "multiple_staff_consent", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "simultaneous_multiple_staff_visit", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "long_visit_eligibility_type", "TEXT NOT NULL DEFAULT 'none'");
      this.addColumnIfMissing("daily_visits", "emergency_unplanned", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "emergency_requested_by_patient_or_family", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "emergency_physician_instruction", "TEXT NOT NULL DEFAULT 'not_applicable'");
      this.addColumnIfMissing("daily_visits", "discharge_support_guidance_category", "TEXT NOT NULL DEFAULT 'none'");
      this.addColumnIfMissing("daily_visits", "discharge_support_total_minutes", "INTEGER NOT NULL DEFAULT 0");
      this.addColumnIfMissing("daily_visits", "first_visit_after_discharge", "TEXT NOT NULL DEFAULT 'not_applicable'");

      this.addColumnIfMissing("pricing_rules", "is_sample", "INTEGER NOT NULL DEFAULT 1");
      this.addColumnIfMissing("pricing_rules", "fee_family", "TEXT");
      this.addColumnIfMissing("pricing_rules", "fee_code", "TEXT");
      this.addColumnIfMissing("pricing_rules", "profession_category", "TEXT");
      this.addColumnIfMissing("pricing_rules", "basic_fee_type", "TEXT");
      this.addColumnIfMissing("pricing_rules", "same_building_daily_count_category", "TEXT");
      this.addColumnIfMissing("pricing_rules", "single_building_resident_category", "TEXT");
      this.addColumnIfMissing("pricing_rules", "station_category", "TEXT");
      this.addColumnIfMissing("pricing_rules", "weekly_visit_day_range", "TEXT");
      this.addColumnIfMissing("pricing_rules", "monthly_visit_day_range", "TEXT");
      this.addColumnIfMissing("pricing_rules", "daily_visit_count_range", "TEXT");
      this.addColumnIfMissing("pricing_rules", "time_zone_category", "TEXT");
      this.addColumnIfMissing("pricing_rules", "companion_category", "TEXT");
      this.addColumnIfMissing("pricing_rules", "maximum_frequency_type", "TEXT");
      this.addColumnIfMissing("pricing_rules", "maximum_frequency_count", "INTEGER");
      this.addColumnIfMissing("pricing_rules", "source_note", "TEXT");

      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS eligibility_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rule_code TEXT NOT NULL UNIQUE,
          fee_code TEXT NOT NULL,
          profession_allow_list_json TEXT NOT NULL DEFAULT '[]',
          required_conditions_json TEXT NOT NULL DEFAULT '[]',
          frequency_limit_type TEXT,
          frequency_limit_count INTEGER,
          warning_message TEXT,
          error_message TEXT,
          effective_from TEXT NOT NULL,
          effective_to TEXT
        );
      `);

      this.connection.prepare("UPDATE pricing_rules SET enabled = 0, sample_price = 1, is_sample = 1 WHERE sample_price = 1 OR is_sample = 1").run();
      this.markMigrationApplied(FORMAL_PRICING_MIGRATION_ID);
    });

    migrate();
  }

  private runHighCostCareLimitMigration(): void {
    if (this.hasMigration(HIGH_COST_CARE_LIMIT_MIGRATION_ID)) {
      return;
    }

    const migrate = this.connection.transaction(() => {
      this.addColumnIfMissing("monthly_estimates", "high_cost_care_limit_category", "TEXT NOT NULL DEFAULT 'unset'");
      this.markMigrationApplied(HIGH_COST_CARE_LIMIT_MIGRATION_ID);
    });

    migrate();
  }

  private runCareInsuranceMigration(): void {
    if (this.hasMigration(CARE_INSURANCE_MIGRATION_ID)) {
      return;
    }

    const migrate = this.connection.transaction(() => {
      this.connection.exec(`
        CREATE TABLE IF NOT EXISTS care_monthly_estimates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_name TEXT NOT NULL DEFAULT '',
          facility_name TEXT NOT NULL DEFAULT '',
          target_month TEXT NOT NULL,
          care_classification TEXT NOT NULL DEFAULT 'care',
          copayment_rate TEXT NOT NULL DEFAULT 'unset',
          regional_grade TEXT NOT NULL DEFAULT 'other',
          same_building_category TEXT NOT NULL DEFAULT 'none',
          initial_addition TEXT NOT NULL DEFAULT 'none',
          emergency_addition TEXT NOT NULL DEFAULT 'none',
          special_management_addition TEXT NOT NULL DEFAULT 'none',
          discharge_joint_guidance INTEGER NOT NULL DEFAULT 0,
          terminal_care INTEGER NOT NULL DEFAULT 0,
          treatment_improvement INTEGER NOT NULL DEFAULT 0,
          rehab_over_12_months INTEGER NOT NULL DEFAULT 0,
          rehab_facility_reduction INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS care_service_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          care_monthly_estimate_id INTEGER NOT NULL,
          visit_date TEXT NOT NULL,
          sequence INTEGER NOT NULL,
          profession TEXT NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          end_day_type TEXT NOT NULL,
          unplanned_emergency INTEGER NOT NULL DEFAULT 0,
          duration_minutes INTEGER NOT NULL,
          service_category TEXT NOT NULL,
          time_zone_type TEXT NOT NULL,
          time_zone_breakdown_json TEXT NOT NULL DEFAULT '[]',
          warnings_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(care_monthly_estimate_id) REFERENCES care_monthly_estimates(id) ON DELETE CASCADE,
          UNIQUE(care_monthly_estimate_id, visit_date, sequence)
        );

        CREATE TABLE IF NOT EXISTS care_pricing_rules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          effective_from TEXT NOT NULL,
          effective_to TEXT,
          care_classification TEXT,
          profession_category TEXT,
          service_category TEXT,
          unit_count INTEGER NOT NULL,
          percentage REAL,
          source_note TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS care_regional_rates (
          grade TEXT PRIMARY KEY,
          unit_price REAL NOT NULL,
          effective_from TEXT NOT NULL,
          effective_to TEXT,
          source_note TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_care_services_estimate_date
          ON care_service_entries(care_monthly_estimate_id, visit_date);
      `);
      this.markMigrationApplied(CARE_INSURANCE_MIGRATION_ID);
    });

    migrate();
  }

  private seedSamplePricingRules(): void {
    const count = this.connection.prepare("SELECT COUNT(*) as count FROM pricing_rules").get() as { count: number };
    if (count.count > 0) {
      return;
    }
    const pricingPath = this.resolvePricingPath("sample-pricing.json");
    const items = JSON.parse(readFileSync(pricingPath, "utf-8")) as Array<Record<string, string | number>>;
    const insert = this.buildPricingInsertStatement();

    const transaction = this.connection.transaction(() => {
      for (const item of items) {
        insert.run(this.toPricingParams(item, true));
      }
    });

    transaction();
  }

  private seedFormalPricingRules(): void {
    const pricingPath = this.resolvePricingPath("formal-pricing.json");
    const items = JSON.parse(readFileSync(pricingPath, "utf-8")) as Array<Record<string, string | number | null>>;
    const insert = this.buildPricingInsertStatement();
    const existing = this.connection.prepare("SELECT item_code FROM pricing_rules WHERE item_code = ?");

    const transaction = this.connection.transaction(() => {
      this.connection.prepare("UPDATE pricing_rules SET enabled = 0 WHERE is_sample = 1 OR sample_price = 1").run();
      for (const item of items) {
        if (existing.get(item.itemCode as string)) {
          this.connection
            .prepare(
              `UPDATE pricing_rules SET enabled = 1, sample_price = 0, is_sample = 0, unit_price = ?, source_note = ?
               WHERE item_code = ?`
            )
            .run(item.unitPrice, item.sourceNote ?? null, item.itemCode);
        } else {
          insert.run(this.toPricingParams(item, false));
        }
      }
      this.seedEligibilityRules();
    });

    transaction();
  }

  private seedCarePricingRules(): void {
    const pricingPath = this.resolvePricingPath("care-pricing.json");
    const pricing = JSON.parse(readFileSync(pricingPath, "utf-8")) as {
      source: string;
      defaultRuleSourceId?: string;
      regionalRateSourceId?: string;
      sources?: Array<{ id: string; name: string; url: string }>;
      regionalRates: Array<{ grade: string; unitPrice: number }>;
      rules: Array<Record<string, string | number | null>>;
    };
    const sources = new Map((pricing.sources ?? []).map((source) => [source.id, `${source.name} ${source.url}`]));
    const defaultRuleSource = sources.get(pricing.defaultRuleSourceId ?? "") ?? pricing.source;
    const regionalRateSource = sources.get(pricing.regionalRateSourceId ?? "") ?? pricing.source;
    const upsertRule = this.connection.prepare(`
      INSERT INTO care_pricing_rules (
        code, name, category, effective_from, effective_to, care_classification,
        profession_category, service_category, unit_count, percentage, source_note, enabled
      ) VALUES (@code, @name, @category, @effectiveFrom, @effectiveTo, @careClassification,
        @professionCategory, @serviceCategory, @unitCount, @percentage, @sourceNote, 1)
      ON CONFLICT(code) DO UPDATE SET
        name = excluded.name, category = excluded.category, effective_from = excluded.effective_from,
        effective_to = excluded.effective_to, care_classification = excluded.care_classification,
        profession_category = excluded.profession_category, service_category = excluded.service_category,
        unit_count = excluded.unit_count, percentage = excluded.percentage,
        source_note = excluded.source_note, enabled = 1
    `);
    const upsertRate = this.connection.prepare(`
      INSERT INTO care_regional_rates (grade, unit_price, effective_from, effective_to, source_note)
      VALUES (?, ?, '2024-04-01', NULL, ?)
      ON CONFLICT(grade) DO UPDATE SET unit_price = excluded.unit_price, source_note = excluded.source_note
    `);
    const transaction = this.connection.transaction(() => {
      for (const rule of pricing.rules) {
        upsertRule.run({
          code: rule.code,
          name: rule.name,
          category: rule.category,
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo ?? null,
          careClassification: rule.careClassification ?? "any",
          professionCategory: rule.professionCategory ?? "any",
          serviceCategory: rule.serviceCategory ?? "any",
          unitCount: rule.unitCount,
          percentage: rule.percentage ?? null,
          sourceNote: sources.get(String(rule.sourceId ?? "")) ?? defaultRuleSource
        });
      }
      for (const rate of pricing.regionalRates) {
        upsertRate.run(rate.grade, rate.unitPrice, regionalRateSource);
      }
    });
    transaction();
  }

  private seedEligibilityRules(): void {
    const rows = [
      {
        ruleCode: "no_assistant_nurse_discharge_joint",
        feeCode: "discharge_joint_guidance",
        professionAllowList: ["nurse_group"],
        requiredConditions: ["first_visit_after_discharge"],
        errorMessage: "准看護師は退院時共同指導加算を算定できません。"
      },
      {
        ruleCode: "no_assistant_nurse_discharge_support",
        feeCode: "discharge_support_guidance",
        professionAllowList: ["nurse_group"],
        requiredConditions: ["discharge_support_guidance_category"],
        errorMessage: "准看護師は退院支援指導加算を算定できません。"
      }
    ];
    const insert = this.connection.prepare(`
      INSERT OR IGNORE INTO eligibility_rules (
        rule_code, fee_code, profession_allow_list_json, required_conditions_json,
        frequency_limit_type, frequency_limit_count, warning_message, error_message,
        effective_from, effective_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of rows) {
      insert.run(
        row.ruleCode,
        row.feeCode,
        JSON.stringify(row.professionAllowList),
        JSON.stringify(row.requiredConditions),
        null,
        null,
        null,
        row.errorMessage,
        "2026-06-01",
        null
      );
    }
  }

  private buildPricingInsertStatement(): Database.Statement {
    return this.connection.prepare(`
      INSERT INTO pricing_rules (
        item_code, item_name, category, effective_from, effective_to, profession,
        same_building_category, weekly_visit_count_category, daily_visit_count_category,
        time_zone_type, addition_type, unit_price, unit_type, rounding_type,
        note, enabled, sample_price, is_sample, fee_family, fee_code, profession_category,
        basic_fee_type, same_building_daily_count_category, single_building_resident_category,
        station_category, weekly_visit_day_range, monthly_visit_day_range, daily_visit_count_range,
        time_zone_category, companion_category, maximum_frequency_type, maximum_frequency_count,
        source_note
      ) VALUES (
        @itemCode, @itemName, @category, @effectiveFrom, @effectiveTo, @profession,
        @sameBuildingCategory, @weeklyVisitCountCategory, @dailyVisitCountCategory,
        @timeZoneType, @additionType, @unitPrice, @unitType, @roundingType,
        @note, @enabled, @samplePrice, @isSample, @feeFamily, @feeCode, @professionCategory,
        @basicFeeType, @sameBuildingDailyCountCategory, @singleBuildingResidentCategory,
        @stationCategory, @weeklyVisitDayRange, @monthlyVisitDayRange, @dailyVisitCountRange,
        @timeZoneCategory, @companionCategory, @maximumFrequencyType, @maximumFrequencyCount,
        @sourceNote
      )
    `);
  }

  private toPricingParams(item: Record<string, string | number | null>, isSample: boolean): Record<string, string | number | null> {
    return {
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      effectiveFrom: isSample ? "2026-01-01" : "2026-06-01",
      effectiveTo: null,
      profession: item.profession ?? "any",
      sameBuildingCategory: item.sameBuildingCategory ?? "any",
      weeklyVisitCountCategory: item.weeklyVisitCountCategory ?? null,
      dailyVisitCountCategory: item.dailyVisitCountCategory ?? "any",
      timeZoneType: item.timeZoneType ?? "any",
      additionType: item.additionType ?? "none",
      unitPrice: item.unitPrice,
      unitType: item.unitType,
      roundingType: item.roundingType ?? "none",
      note: item.note ?? item.sourceNote ?? null,
      enabled: isSample ? 0 : 1,
      samplePrice: isSample ? 1 : 0,
      isSample: isSample ? 1 : 0,
      feeFamily: item.feeFamily ?? null,
      feeCode: item.feeCode ?? item.itemCode,
      professionCategory: item.professionCategory ?? null,
      basicFeeType: item.basicFeeType ?? null,
      sameBuildingDailyCountCategory: item.sameBuildingDailyCountCategory ?? null,
      singleBuildingResidentCategory: item.singleBuildingResidentCategory ?? null,
      stationCategory: item.stationCategory ?? null,
      weeklyVisitDayRange: item.weeklyVisitDayRange ?? null,
      monthlyVisitDayRange: item.monthlyVisitDayRange ?? null,
      dailyVisitCountRange: item.dailyVisitCountRange ?? null,
      timeZoneCategory: item.timeZoneCategory ?? null,
      companionCategory: item.companionCategory ?? null,
      maximumFrequencyType: item.maximumFrequencyType ?? null,
      maximumFrequencyCount: item.maximumFrequencyCount ?? null,
      sourceNote: item.sourceNote ?? null
    };
  }

  private addColumnIfMissing(tableName: string, columnName: string, definition: string): void {
    const rows = this.connection.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!rows.some((row) => row.name === columnName)) {
      this.connection.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
  }

  private markMigrationApplied(id: string): void {
    this.connection.prepare("INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(id, new Date().toISOString());
  }

  private resolvePricingPath(fileName: string): string {
    const packagedPath = path.join(process.resourcesPath, "pricing", fileName);
    if (app.isPackaged && existsSync(packagedPath)) {
      return packagedPath;
    }
    return path.join(app.getAppPath(), "resources", "pricing", fileName);
  }
}
