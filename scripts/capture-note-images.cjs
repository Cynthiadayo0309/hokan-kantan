/* eslint-disable @typescript-eslint/no-require-imports -- Electron runs this file as a CommonJS main process. */
const { app, BrowserWindow, ipcMain } = require("electron");
const { mkdir, rm, writeFile } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const assetsDir = path.join(rootDir, "docs", "note-assets");
const tempUserDataDir = path.join(os.tmpdir(), `hokan-kantan-note-${Date.now()}`);
const rendererIndexPath = path.join(rootDir, "dist", "renderer", "index.html");
const preloadPath = path.join(rootDir, "dist-electron", "preload", "index.js");

if (!existsSync(rendererIndexPath) || !existsSync(preloadPath)) {
  console.error("ビルド済みファイルがありません。先に npm.cmd run build を実行してください。");
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
  await rm(path.join(assetsDir, "capture-note-error.log"), { force: true });

  const databaseManager = new DatabaseManager();
  const db = databaseManager.initialize();
  const medicalRepository = new EstimateRepository(db);
  const careRepository = new CareEstimateRepository(db);
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
      sandbox: true
    }
  });

  await appWindow.loadFile(rendererIndexPath);
  await waitForText(appWindow, "どちらの保険で計算しますか？");
  await delay(500);
  await capture(appWindow, "01-insurance-select.png");

  await navigate(appWindow, "/care");
  await waitFor(appWindow, ".header-grid");
  await waitForText(appWindow, "佐藤 花子");
  await delay(500);
  await capture(appWindow, "02-care-settings.png");

  await appWindow.webContents.executeJavaScript(`document.querySelector('.care-calendar')?.scrollIntoView({ block: 'start' });`);
  await delay(400);
  await capture(appWindow, "03-care-calendar.png");

  await appWindow.webContents.executeJavaScript(`
    const dayButton = [...document.querySelectorAll('.calendar-day')]
      .find((button) => button.querySelector('.day-number strong')?.textContent?.trim() === '15');
    if (!dayButton) throw new Error('15日のセルが見つかりません。');
    dayButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  `);
  await waitForVisibleOverlay(appWindow);
  await delay(1200);
  await capture(appWindow, "04-care-daily-services.png");

  await navigate(appWindow, "/care/detail");
  await reload(appWindow);
  await waitForText(appWindow, "介護保険 費用明細");
  await waitFor(appWindow, ".totals-grid");
  appWindow.showInactive();
  await delay(700);
  await capture(appWindow, "05-care-cost-detail.png");
  appWindow.hide();

  appWindow.destroy();
  db.close();
  await rm(tempUserDataDir, { recursive: true, force: true });
  console.log(`note用キャプチャを生成しました: ${assetsDir}`);
  app.quit();
}).catch(async (error) => {
  console.error(error);
  await mkdir(assetsDir, { recursive: true });
  await writeFile(path.join(assetsDir, "capture-note-error.log"), error?.stack ?? String(error));
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
  await rm(tempUserDataDir, { recursive: true, force: true });
  app.quit();
  process.exitCode = 1;
});

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

  repository.saveDay(saved.id, "2026-07-03", [service("nurse", "10:00", "10:25")]);
  repository.saveDay(saved.id, "2026-07-07", [service("physical_therapist", "10:00", "10:45")]);
  repository.saveDay(saved.id, "2026-07-15", [
    service("nurse", "09:00", "09:30", 1),
    service("occupational_therapist", "10:00", "10:40", 2)
  ]);
  repository.saveDay(saved.id, "2026-07-21", [service("assistant_nurse", "18:00", "18:25")]);
  repository.saveDay(saved.id, "2026-07-28", [service("nurse", "22:00", "22:30")]);
}

function service(profession, startTime, endTime, sequence = 1) {
  return { sequence, profession, startTime, endTime, endDayType: "same_day", unplannedEmergency: false };
}

async function navigate(window, route) {
  await window.webContents.executeJavaScript(`window.location.hash = ${JSON.stringify(`#${route}`)};`);
  await delay(300);
}

async function reload(window) {
  await new Promise((resolve, reject) => {
    const onFinished = () => {
      cleanup();
      resolve();
    };
    const onFailed = (_event, errorCode, errorDescription) => {
      cleanup();
      reject(new Error(`Reload failed (${errorCode}): ${errorDescription}`));
    };
    const cleanup = () => {
      window.webContents.off("did-finish-load", onFinished);
      window.webContents.off("did-fail-load", onFailed);
    };
    window.webContents.once("did-finish-load", onFinished);
    window.webContents.once("did-fail-load", onFailed);
    window.webContents.reload();
  });
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
          reject(new Error('Timeout: ${selector}'));
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
        if (document.body.innerText.includes(expected) || document.querySelector('input[value="' + expected + '"]')) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error('Timeout waiting for text: ' + expected));
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
        const visible = [...document.querySelectorAll('.v-overlay')].some((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && element.querySelector('.v-card');
        });
        if (visible) {
          clearInterval(timer);
          resolve(true);
        } else if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error('日別入力ダイアログが表示されませんでした。'));
        }
      }, 100);
    });
  `);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("exit", () => {
  ipcMain.removeAllListeners();
});
