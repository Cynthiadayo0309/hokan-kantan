/* eslint-disable @typescript-eslint/no-require-imports -- Electron is run with this script as a CommonJS main process. */
const { app, BrowserWindow, ipcMain } = require("electron");
const { mkdir, writeFile } = require("node:fs/promises");
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

if (!existsSync(rendererIndexPath) || !existsSync(preloadPath)) {
  console.error("dist/renderer と dist-electron が見つかりません。先に npm run build を実行してください。");
  process.exit(1);
}

app.setName("訪看かんたん計算");
app.setPath("userData", tempUserDataDir);
app.getAppPath = () => rootDir;

const { DatabaseManager } = require(path.join(rootDir, "dist-electron", "main", "database", "DatabaseManager.js"));
const { EstimateRepository } = require(path.join(rootDir, "dist-electron", "main", "repositories", "EstimateRepository.js"));
const { registerIpcHandlers } = require(path.join(rootDir, "dist-electron", "main", "ipc", "registerIpcHandlers.js"));

app.whenReady().then(async () => {
  await mkdir(assetsDir, { recursive: true });

  const databaseManager = new DatabaseManager();
  const db = databaseManager.initialize();
  const repository = new EstimateRepository(db);
  seedDemoData(repository);

  let appWindow = null;
  registerIpcHandlers(repository, () => appWindow);

  appWindow = new BrowserWindow({
    width: 1366,
    height: 900,
    show: false,
    backgroundColor: "#f6faf8",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await appWindow.loadFile(rendererIndexPath);
  await appWindow.webContents.insertCSS("* { transition: none !important; animation: none !important; }");
  await waitFor(appWindow, ".calendar-grid");
  await waitForText(appWindow, "山田 花子");
  await delay(700);
  await capture(appWindow, "monthly-input.png");

  await appWindow.webContents.executeJavaScript(`
    const dayButton = [...document.querySelectorAll(".calendar-day")]
      .find((button) => button.querySelector(".calendar-date span")?.textContent?.trim() === "10");
    if (!dayButton) throw new Error("10日のセルが見つかりません。");
    dayButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  `);
  await waitForVisibleOverlay(appWindow);
  await delay(1200);
  await capture(appWindow, "daily-dialog.png");

  await appWindow.webContents.executeJavaScript(`window.location.hash = "#/detail";`);
  await waitFor(appWindow, ".detail-table");
  await delay(900);
  await capture(appWindow, "cost-detail.png");

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
  const pdf = await pdfWindow.webContents.printToPDF({
    pageSize: "A4",
    printBackground: true,
    landscape: false,
    margins: { marginType: "none" }
  });
  const pdfPath = path.join(docsDir, "訪看かんたん計算_紹介資料.pdf");
  await writeFile(pdfPath, pdf);
  pdfWindow.destroy();
  appWindow.destroy();

  console.log(`生成しました: ${pdfPath}`);
  app.quit();
}).catch((error) => {
  console.error(error);
  app.quit();
  process.exit(1);
});

function seedDemoData(repository) {
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
    demoVisit("2026-06-03", [{ sequence: 1, startTime: "10:00", endTime: "10:30", endDayType: "same_day" }]),
    demoVisit("2026-06-06", [{ sequence: 1, startTime: "17:45", endTime: "18:15", endDayType: "same_day" }], {
      timeVisitRequestedByPatientOrFamily: "applicable"
    }),
    demoVisit("2026-06-10", [
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
    demoVisit("2026-06-17", [{ sequence: 1, startTime: "23:30", endTime: "00:10", endDayType: "next_day" }], {
      timeVisitRequestedByPatientOrFamily: "applicable"
    }),
    demoVisit("2026-06-24", [{ sequence: 1, startTime: "09:30", endTime: "10:15", endDayType: "same_day" }], {
      dischargeJointGuidanceType: "applicable",
      dischargeSupportGuidanceCategory: "normal",
      dischargeSupportTotalMinutes: 60,
      firstVisitAfterDischarge: "applicable"
    })
  ];

  for (const visit of visits) {
    repository.saveDailyVisit(saved.id, visit);
  }
}

function demoVisit(visitDate, timeSlots, overrides = {}) {
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

async function capture(window, fileName) {
  const image = await window.webContents.capturePage();
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
        if (document.body.innerText.includes(expected) || document.body.querySelector("input[value='" + expected + "']")) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > 10000) {
          const visibleText = document.body.innerText.slice(0, 500);
          clearInterval(timer);
          reject(new Error("Timeout waiting for text: " + expected + "\\n" + visibleText));
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
        const visible = [...document.querySelectorAll(".v-overlay")]
          .some((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && element.querySelector(".v-sheet");
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInlinedHtml() {
  const htmlPath = path.join(docsDir, "index.html");
  const cssPath = path.join(docsDir, "styles.css");
  const css = readFileSync(cssPath, "utf-8");
  let html = readFileSync(htmlPath, "utf-8").replace('<link rel="stylesheet" href="./styles.css" />', `<style>${css}</style>`);
  for (const name of ["monthly-input.png", "daily-dialog.png", "cost-detail.png"]) {
    const imagePath = path.join(assetsDir, name);
    const data = readFileSync(imagePath).toString("base64");
    html = html.replace(`./assets/${name}`, `data:image/png;base64,${data}`);
  }
  return html;
}

process.on("exit", () => {
  ipcMain.removeAllListeners();
});
