# 設計

## 全体構成

- Electron main: DB、マイグレーション、料金マスター、検証、費用計算、IPCを担当する。
- preload: `window.hokanApi` のみを公開する。
- renderer: Vue/Vuetifyで2画面と日別入力ダイアログを表示する。
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

mainプロセス側で入力値を検証し、DB保存と計算を行う。

## 計算サービス

- `TimeZoneClassifier`: 時刻区分、時間帯またぎ、内訳分数を判定する。
- `DailyVisitCalculator`: 訪問時間、重複、保存不可エラー、警告を判定する。
- `PricingRuleResolver`: 料金マスターから該当単価を取得する。
- `EligibilityEvaluator`: 職種制限、依頼者条件、緊急訪問条件、退院関連の算定可否を判定する。
- `VisitDayCounters` / `WeeklyVisitDayCounter`: 月内・週内の訪問日数順位を判定する。
- `CopaymentCalculator`: 自己負担割合適用後の10円未満四捨五入を担当する。
- `HighCostCareLimitCalculator`: 70歳以上・外来個人ごとの高額療養費自己負担限度額を概算適用する。
- `MonthlyEstimateCalculator`: 明細、小計、総額、自己負担額を生成する。

正式単価は推測しない。2026-06-01適用開始の正式料金は `resources/pricing/formal-pricing.json` から登録し、既存サンプル料金は削除せず無効化する。今回の正式対応範囲外である訪問看護基本療養費（Ⅰ）は、警告を表示して合計に含めない。
