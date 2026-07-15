import { app, BrowserWindow } from "electron";
import path from "node:path";
import { DatabaseManager } from "./database/DatabaseManager";
import { registerIpcHandlers } from "./ipc/registerIpcHandlers";
import { EstimateRepository } from "./repositories/EstimateRepository";
import { CareEstimateRepository } from "./repositories/CareEstimateRepository";
import { getCustomIconPathIfExists } from "./services/CustomIconService";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const iconPath = getCustomIconPathIfExists(app.getPath("userData"));
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: "訪看かんたん計算",
    ...(iconPath ? { icon: iconPath } : {}),
    backgroundColor: "#f6faf8",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/renderer/index.html"));
  }
}

app.whenReady().then(() => {
  app.setName("訪看かんたん計算");
  const databaseManager = new DatabaseManager();
  const db = databaseManager.initialize();
  registerIpcHandlers(new EstimateRepository(db), new CareEstimateRepository(db), () => mainWindow);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
