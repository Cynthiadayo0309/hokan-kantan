# 設計

## 全体構成

- Electron main: DB、マイグレーション、料金マスター、検証、費用計算、IPCを担当する。
- preload: `window.hokanApi` のみを公開する。
- renderer: Vue/Vuetifyで保険選択画面と、医療・介護それぞれの月間入力・費用明細・日別入力ダイアログを表示する。
- SQLite: `app.getPath("userData")/application.db` に保存する。

## セキュリティ

BrowserWindowは `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` を使用する。rendererからNode.js API、SQLite、任意ファイルパス、SQL文は扱わせない。

## IPC

公開APIは次に限定する。

- `getEstimate()`
- `saveEstimate(payload)`
- `saveDailyVisit(payload)`
- `deleteDailyVisit(payload)`
- `calculateMonthlyEstimate(payload)`
- `resetEstimate(payload)`
- `getPricingVersion()`

既存医療IPCは変更せず、介護専用として次を追加する。

- `getCareEstimate()` / `saveCareEstimate(payload)`
- `saveCareDay(payload)` / `deleteCareDay(payload)`
- `calculateCareMonthlyEstimate(payload)` / `resetCareEstimate(payload)`
- `getCarePricingVersion()`
- `previewCareMonthlyReport(payload)` / `printCareMonthlyReport(payload)`
- `exportCareMonthlyReportPdf(payload)` / `exportCareMonthlyReportExcel(payload)`

mainプロセス側で入力値を検証し、DB保存と計算を行う。

## 計算サービス

- `TimeZoneClassifier`: 時刻区分、時間帯またぎ、内訳分数を判定する。
- `DailyVisitCalculator`: 訪問時間、重複、保存不可エラー、警告を判定する。
- `PricingRuleResolver`: 料金マスターから該当単価を取得する。
- `EligibilityEvaluator`: 職種制限、依頼者条件、緊急訪問条件、退院関連の算定可否を判定する。
- `VisitDayCounters` / `WeeklyVisitDayCounter`: 月内・週内の訪問日数順位を判定する。
- `CopaymentCalculator`: 自己負担割合適用後の10円未満四捨五入を担当する。
- `HighCostCareLimitCalculator`: `high_cost_care_limit_rules` から対象年月・所得区分に一致する期間別ルールを解決し、70歳以上・外来個人ごとの高額療養費自己負担限度額を概算適用する。一致なし・複数一致の場合は上限を適用せず警告する。
- `MonthlyEstimateCalculator`: 明細、小計、総額、自己負担額を生成する。

正式単価は推測しない。2026-06-01適用開始の正式料金は `resources/pricing/formal-pricing.json` から登録し、既存サンプル料金は削除せず無効化する。今回の正式対応範囲外である訪問看護基本療養費（Ⅰ）は、警告を表示して合計に含めない。

高額療養費ルールは `resources/pricing/high-cost-care-limit-rules.json` からマイグレーション `005_high_cost_care_limit_rules` で登録する。2026年8月改定の月額上限は適用するが、年間上限、世帯合算、多数回該当、公費、他医療機関・薬局分は自動計算せず、画面と帳票に対象外であることを表示する。

## 介護保険データと計算

既存医療データを変更せず、`care_monthly_estimates`、`care_service_entries`、`care_pricing_rules`、`care_regional_rates` に分離する。マイグレーション `004_care_insurance` は再実行可能とし、未適用DBでは実行前に `application.db.<日時>.bak` を作成する。

- `CareDailyServiceCalculator`: 訪問時間、時間区分、端数、同日重複を検証する。
- `CarePricingRuleResolver`: 対象日・要介護/要支援・職種・時間区分から正式単位を解決する。
- `CareMonthlyEstimateCalculator`: 基本単位、加減算、処遇改善、地域単価、自己負担を計算する。

加減算は単位段階で整数化し、月間合計単位に地域単価を乗じて1円未満を切り捨てる。利用者負担額は「総費用－保険給付額（切り捨て）」で算出する。介護料金は `resources/pricing/care-pricing.json` に適用日、単位、算定区分、公式資料名・URLを保持する。
