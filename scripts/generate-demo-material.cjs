/* eslint-disable @typescript-eslint/no-require-imports -- Electron runs this file as a CommonJS main process. */
const electron = require("electron");
if (typeof electron === "string") {
  const { spawnSync } = require("node:child_process");
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electron, [__filename], { env: environment, stdio: "inherit" });
  process.exit(result.status ?? 1);
}
const { app, BrowserWindow, ipcMain } = electron;
const { mkdir, rm, writeFile } = require("node:fs/promises");
const { existsSync, readFileSync } = require("node:fs");
const { pathToFileURL } = require("node:url");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs", "demo-material");
const assetsDir = path.join(docsDir, "assets");
const tempUserDataDir = path.join(os.tmpdir(), `hokan-kantan-demo-${Date.now()}`);
const rendererIndexPath = path.join(rootDir, "dist", "renderer", "index.html");
const preloadPath = path.join(rootDir, "dist-electron", "preload", "index.js");
const captureFiles = [
  "insurance-select.png",
  "medical-monthly.png",
  "medical-daily.png",
  "medical-cost-detail.png",
  "care-settings.png",
  "care-calendar.png",
  "care-daily-services.png",
  "care-copy.png",
  "care-cost-detail.png"
];

if (!existsSync(rendererIndexPath) || !existsSync(preloadPath)) {
  console.error("dist/renderer と dist-electron が見つかりません。先に npm run build を実行してください。");
  process.exit(1);
}

app.setName("訪看かんたん計算");
app.setPath("userData", tempUserDataDir);
app.getAppPath = () => rootDir;

const { DatabaseManager } = require(path.join(rootDir, "dist-electron", "main", "database", "DatabaseManager.js"));
const { EstimateRepository } = require(path.join(rootDir, "dist-electron", "main", "repositories", "EstimateRepository.js"));
const { CareEstimateRepository } = require(path.join(rootDir, "dist-electron", "main", "repositories", "CareEstimateRepository.js"));
const { registerIpcHandlers } = require(path.join(rootDir, "dist-electron", "main", "ipc", "registerIpcHandlers.js"));

app.whenReady().then(async () => {
  await mkdir(assetsDir, { recursive: true });

  const databaseManager = new DatabaseManager();
  const db = databaseManager.initialize();
  const medicalRepository = new EstimateRepository(db);
  const careRepository = new CareEstimateRepository(db);
  seedMedicalDemoData(medicalRepository);
  seedCareDemoData(careRepository);

  let appWindow = null;
  registerIpcHandlers(medicalRepository, careRepository, () => appWindow);

  appWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    show: false,
    backgroundColor: "#f6faf8",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      offscreen: true
    }
  });

  await appWindow.loadFile(rendererIndexPath);
  await appWindow.webContents.insertCSS("* { transition: none !important; animation: none !important; }");

  await waitForText(appWindow, "どちらの保険で計算しますか？");
  await delay(500);
  await capture(appWindow, "insurance-select.png");

  await navigate(appWindow, "/medical");
  await waitFor(appWindow, ".calendar-grid");
  await waitForText(appWindow, "山田 花子");
  await scrollTo(appWindow, ".calendar-grid", "center");
  await delay(600);
  await capture(appWindow, "medical-monthly.png");

  await clickCalendarDay(appWindow, ".calendar-day", ".calendar-date span", "10");
  await waitForVisibleOverlay(appWindow);
  await delay(900);
  await capture(appWindow, "medical-daily.png");

  await navigate(appWindow, "/medical/detail");
  await waitFor(appWindow, ".detail-table");
  await delay(900);
  await capture(appWindow, "medical-cost-detail.png");

  await navigate(appWindow, "/care");
  await reload(appWindow);
  await waitFor(appWindow, ".header-grid");
  await waitForText(appWindow, "佐藤 花子");
  await scrollToTop(appWindow);
  await delay(500);
  await capture(appWindow, "care-settings.png");

  await scrollTo(appWindow, ".care-calendar", "start");
  await delay(500);
  await capture(appWindow, "care-calendar.png");

  await clickCalendarDay(appWindow, ".calendar-day", ".day-number strong", "15");
  await waitForVisibleOverlay(appWindow);
  await delay(900);
  await capture(appWindow, "care-daily-services.png");

  await openCareCopyCalendar(appWindow);
  appWindow.webContents.setZoomFactor(0.8);
  await appWindow.webContents.executeJavaScript(`
    (() => {
      const calendar = document.querySelector(".copy-calendar-wrap");
      const scrollArea = calendar?.closest(".v-card-text");
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    })();
  `);
  await delay(700);
  await capture(appWindow, "care-copy.png");
  appWindow.webContents.setZoomFactor(1);

  await navigate(appWindow, "/care/detail");
  await reload(appWindow);
  await waitForText(appWindow, "介護保険 費用明細");
  await waitFor(appWindow, ".totals-grid");
  await delay(900);
  await capture(appWindow, "care-cost-detail.png");

  const pdfWindow = new BrowserWindow({
    width: 1240,
    height: 1754,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const inlinedHtmlPath = path.join(tempUserDataDir, "demo-material.html");
  await writeFile(inlinedHtmlPath, buildInlinedHtml(), "utf-8");
  await pdfWindow.loadURL(pathToFileURL(inlinedHtmlPath).toString());
  await waitForImages(pdfWindow);
  const pageCount = await pdfWindow.webContents.executeJavaScript("document.querySelectorAll('.page').length");
  if (pageCount !== 9) throw new Error(`紹介資料のページ数が不正です: ${pageCount}`);
  const overflowingPages = await pdfWindow.webContents.executeJavaScript(`
    [...document.querySelectorAll(".page")]
      .map((page, index) => ({
        page: index + 1,
        vertical: page.scrollHeight - page.clientHeight,
        horizontal: page.scrollWidth - page.clientWidth
      }))
      .filter((page) => page.vertical > 1 || page.horizontal > 1)
  `);
  if (overflowingPages.length) {
    throw new Error(`紹介資料の内容がページ内に収まっていません: ${JSON.stringify(overflowingPages)}`);
  }

  const pdf = await pdfWindow.webContents.printToPDF({
    pageSize: "A4",
    printBackground: true,
    landscape: false,
    margins: { marginType: "none" }
  });
  const physicalPageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
  if (physicalPageCount !== 9) throw new Error(`生成PDFのページ数が不正です: ${physicalPageCount}`);
  const pdfPath = path.join(docsDir, "訪看かんたん計算_紹介資料.pdf");
  await writeFile(pdfPath, pdf);

  pdfWindow.destroy();
  appWindow.destroy();
  db.close();
  await rm(tempUserDataDir, { recursive: true, force: true });
  console.log(`9ページの紹介資料を生成しました: ${pdfPath}`);
  app.quit();
}).catch(async (error) => {
  console.error(error);
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  await rm(tempUserDataDir, { recursive: true, force: true });
  process.exit(1);
});

function seedMedicalDemoData(repository) {
  const estimate = repository.getOrCreateCurrentEstimate();
  const saved = repository.saveEstimate({
    id: estimate.id,
    patientName: "山田 花子",
    facilityName: "ひだまりホーム",
    targetMonth: "2026-06",
    sameBuildingCategory: "three_to_nine",
    copaymentRate: "10",
    basicFeeType: "type_2",
    stationCategory: "standard",
    singleBuildingResidentCategory: "under_20",
    specialManagementCategory: "yen_2500",
    dischargeJointGuidanceCountCategory: "normal",
    specialManagementGuidanceApplicable: "not_applicable",
    highCostCareLimitCategory: "unset"
  });

  const visits = [
    medicalVisit("2026-06-03", [{ sequence: 1, startTime: "10:00", endTime: "10:30", endDayType: "same_day" }]),
    medicalVisit("2026-06-06", [{ sequence: 1, startTime: "17:45", endTime: "18:15", endDayType: "same_day" }], {
      timeVisitRequestedByPatientOrFamily: "applicable"
    }),
    medicalVisit("2026-06-10", [
      { sequence: 1, startTime: "10:00", endTime: "10:30", endDayType: "same_day" },
      { sequence: 2, startTime: "19:00", endTime: "19:30", endDayType: "same_day" }
    ], {
      visitCount: 2,
      multipleVisitEligibilityType: "specified_disease",
      multipleStaffCategory: "nurse_companion",
      singlePersonVisitDifficult: "applicable",
      multipleStaffConsent: "applicable",
      simultaneousMultipleStaffVisit: "applicable"
    }),
    medicalVisit("2026-06-17", [{ sequence: 1, startTime: "23:30", endTime: "00:10", endDayType: "next_day" }], {
      timeVisitRequestedByPatientOrFamily: "applicable"
    }),
    medicalVisit("2026-06-24", [{ sequence: 1, startTime: "09:30", endTime: "10:15", endDayType: "same_day" }], {
      dischargeJointGuidanceType: "applicable",
      dischargeSupportGuidanceCategory: "normal",
      dischargeSupportTotalMinutes: 60,
      firstVisitAfterDischarge: "applicable"
    })
  ];

  for (const visit of visits) repository.saveDailyVisit(saved.id, visit);
}

function medicalVisit(visitDate, timeSlots, overrides = {}) {
  return {
    visitDate,
    basicFeeApplicable: "applicable",
    managementFeeApplicable: "applicable",
    profession: "nurse",
    visitCount: timeSlots.length,
    longVisitType: "not_applicable",
    multipleStaffType: "not_applicable",
    emergencyType: "not_applicable",
    specialManagementType: "none",
    dischargeJointGuidanceType: "not_applicable",
    dischargeSupportGuidanceType: "not_applicable",
    timeVisitRequestedByPatientOrFamily: "not_applicable",
    multipleVisitEligibilityType: "none",
    multipleStaffCategory: "none",
    singlePersonVisitDifficult: "not_applicable",
    multipleStaffConsent: "not_applicable",
    simultaneousMultipleStaffVisit: "not_applicable",
    longVisitEligibilityType: "none",
    emergencyUnplanned: "not_applicable",
    emergencyRequestedByPatientOrFamily: "not_applicable",
    emergencyPhysicianInstruction: "not_applicable",
    dischargeSupportGuidanceCategory: "none",
    dischargeSupportTotalMinutes: 0,
    firstVisitAfterDischarge: "not_applicable",
    timeSlots,
    ...overrides
  };
}

function seedCareDemoData(repository) {
  const estimate = repository.getOrCreateCurrentEstimate();
  const saved = repository.saveEstimate({
    id: estimate.id,
    patientName: "佐藤 花子",
    facilityName: "ひだまりホーム",
    targetMonth: "2026-07",
    careClassification: "care",
    copaymentRate: "10",
    regionalGrade: "grade_1",
    sameBuildingCategory: "same_adjacent_under_50",
    initialAddition: "type_2",
    emergencyAddition: "type_2",
    specialManagementAddition: "type_1",
    dischargeJointGuidance: false,
    terminalCare: false,
    treatmentImprovement: true,
    rehabOver12Months: false,
    rehabFacilityReduction: false
  });

  repository.saveDay(saved.id, "2026-07-03", [careService("nurse", "10:00", "10:25")]);
  repository.saveDay(saved.id, "2026-07-07", [careService("physical_therapist", "10:00", "10:45")]);
  repository.saveDay(saved.id, "2026-07-15", [
    careService("nurse", "09:00", "09:30", 1, "under_30"),
    careService("occupational_therapist", "10:00", "10:40", 2)
  ]);
  repository.saveDay(saved.id, "2026-07-21", [careService("assistant_nurse", "18:00", "18:25")]);
  repository.saveDay(saved.id, "2026-07-28", [careService("nurse", "22:00", "22:30")]);
}

function careService(profession, startTime, endTime, sequence = 1, billingCategory) {
  return {
    sequence,
    profession,
    startTime,
    endTime,
    endDayType: "same_day",
    unplannedEmergency: false,
    ...(billingCategory ? { billingCategory } : {})
  };
}

async function navigate(window, route) {
  await window.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(`#${route}`)};`);
  await delay(350);
}

async function reload(window) {
  await new Promise((resolve, reject) => {
    const onFinished = () => { cleanup(); resolve(); };
    const onFailed = (_event, errorCode, errorDescription) => { cleanup(); reject(new Error(`Reload failed (${errorCode}): ${errorDescription}`)); };
    const cleanup = () => {
      window.webContents.off("did-finish-load", onFinished);
      window.webContents.off("did-fail-load", onFailed);
    };
    window.webContents.once("did-finish-load", onFinished);
    window.webContents.once("did-fail-load", onFailed);
    window.webContents.reload();
  });
}

async function clickCalendarDay(window, daySelector, numberSelector, dayNumber) {
  await window.webContents.executeJavaScript(`
    (() => {
      const dayButton = [...document.querySelectorAll(${JSON.stringify(daySelector)})]
        .find((button) => button.querySelector(${JSON.stringify(numberSelector)})?.textContent?.trim() === ${JSON.stringify(dayNumber)});
      if (!dayButton) throw new Error(${JSON.stringify(`${dayNumber}日のセルが見つかりません。`)});
      dayButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    })();
  `);
}

async function openCareCopyCalendar(window) {
  await window.webContents.executeJavaScript(`
    (() => {
      const title = [...document.querySelectorAll(".v-expansion-panel-title")]
        .find((element) => element.textContent?.includes("この日の内容をコピー"));
      if (!title) throw new Error("コピー欄が見つかりません。");
      title.click();
    })();
  `);
  await waitFor(window, ".copy-selection-summary");
  await window.webContents.executeJavaScript(`
    (() => {
      const radio = document.querySelector('input[value="selected_dates"]');
      if (!radio) throw new Error("日付選択ラジオが見つかりません。");
      radio.click();
    })();
  `);
  await waitFor(window, ".copy-calendar");
  await window.webContents.executeJavaScript(`
    (() => {
      for (const dayNumber of [7, 22, 30]) {
        const button = [...document.querySelectorAll(".copy-day:not(:disabled)")]
          .find((element) => element.querySelector("strong")?.textContent?.trim() === String(dayNumber));
        if (!button) throw new Error(dayNumber + "日のコピー先が見つかりません。");
        button.click();
      }
      const calendar = document.querySelector(".copy-calendar-wrap");
      const scrollArea = calendar?.closest(".v-card-text");
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    })();
  `);
  await waitForText(window, "選択中：3日");
  await delay(300);
}

async function scrollTo(window, selector, block) {
  await window.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: ${JSON.stringify(block)} });`);
}

async function scrollToTop(window) {
  await window.webContents.executeJavaScript("window.scrollTo({ top: 0, behavior: 'instant' });");
}

async function capture(window, fileName) {
  const image = await window.webContents.capturePage();
  if (image.isEmpty()) throw new Error(`キャプチャが空です: ${fileName}`);
  await writeFile(path.join(assetsDir, fileName), image.toPNG());
}

async function waitFor(window, selector) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (document.querySelector(${JSON.stringify(selector)})) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error("Timeout waiting for selector: ${selector}"));
        }
      }, 100);
    });
  `);
}

async function waitForText(window, text) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const expected = ${JSON.stringify(text)};
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (document.body.innerText.includes(expected) || document.querySelector("input[value='" + expected + "']")) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error("Timeout waiting for text: " + expected));
        }
      }, 100);
    });
  `);
}

async function waitForVisibleOverlay(window) {
  await window.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const visible = [...document.querySelectorAll(".v-overlay")].some((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && element.querySelector(".v-card, .v-sheet");
        });
        if (visible) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error("日別入力ダイアログが表示されませんでした。"));
        }
      }, 100);
    });
  `);
}

async function waitForImages(window) {
  await window.webContents.executeJavaScript(`
    Promise.all([...document.images].map((image) => {
      if (image.complete && image.naturalWidth > 0) return true;
      return new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error("画像を読み込めません: " + image.src)), { once: true });
      });
    }));
  `);
}

function buildInlinedHtml() {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf-8"));
  const css = readFileSync(path.join(docsDir, "styles.css"), "utf-8");
  let html = readFileSync(path.join(docsDir, "index.html"), "utf-8")
    .replace('<link rel="stylesheet" href="./styles.css" />', `<style>${css}</style>`)
    .replaceAll("{{APP_VERSION}}", packageJson.version);

  for (const name of captureFiles) {
    const imagePath = path.join(assetsDir, name);
    if (!existsSync(imagePath)) throw new Error(`紹介資料用画像がありません: ${name}`);
    const data = readFileSync(imagePath).toString("base64");
    html = html.replaceAll(`./assets/${name}`, `data:image/png;base64,${data}`);
  }
  return html;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("exit", () => {
  ipcMain.removeAllListeners();
});
