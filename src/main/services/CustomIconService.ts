import { app, BrowserWindow, dialog, nativeImage, shell, type OpenDialogOptions, type OpenDialogReturnValue } from "electron";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { buildIcoBuffer, type IcoImageEntry } from "./IcoEncoder";
import type { IconOperationResult, IconPreference } from "../../shared/types";

const allowedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".ico"]);
const icoSizes = [16, 24, 32, 48, 64, 128, 256];

export function customIconDirectory(userDataPath: string): string {
  return path.join(userDataPath, "custom-icon");
}

export function customIconPath(userDataPath: string): string {
  return path.join(customIconDirectory(userDataPath), "app-icon.ico");
}

export function getCustomIconPathIfExists(userDataPath: string): string | undefined {
  const iconPath = customIconPath(userDataPath);
  return existsSync(iconPath) ? iconPath : undefined;
}

export function isAllowedIconSource(filePath: string): boolean {
  return allowedExtensions.has(path.extname(filePath).toLowerCase());
}

export class CustomIconService {
  getPreference(): IconPreference {
    const iconPath = getCustomIconPathIfExists(app.getPath("userData"));
    return {
      hasCustomIcon: Boolean(iconPath),
      iconPath,
      message: iconPath ? "カスタムアイコンを使用しています。" : "標準のアイコンを使用しています。"
    };
  }

  async selectCustomIcon(window: BrowserWindow | null): Promise<IconOperationResult> {
    const result = await showOpenDialog(window, {
      title: "アイコンにする画像を選択",
      properties: ["openFile"],
      filters: [
        { name: "画像ファイル", extensions: ["png", "jpg", "jpeg", "webp", "ico"] },
        { name: "すべてのファイル", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { applied: false, message: "アイコン変更をキャンセルしました。" };
    }

    return this.applyIconFromPath(result.filePaths[0], window);
  }

  async applyIconFromPath(sourcePath: string, window: BrowserWindow | null): Promise<IconOperationResult> {
    if (!isAllowedIconSource(sourcePath)) {
      throw new Error("PNG、JPG、WEBP、ICO形式の画像を選択してください。");
    }

    const destination = customIconPath(app.getPath("userData"));
    await mkdir(path.dirname(destination), { recursive: true });

    if (path.extname(sourcePath).toLowerCase() === ".ico") {
      await copyFile(sourcePath, destination);
    } else {
      await writeFile(destination, imageFileToIcoBuffer(sourcePath));
    }

    applyWindowIcon(window, destination);
    const shortcutMessage = updateWindowsShortcuts(destination);
    return {
      applied: true,
      iconPath: destination,
      message: `アイコンを変更しました。反映されない場合はアプリを再起動してください。${shortcutMessage}`
    };
  }

  async resetCustomIcon(): Promise<IconOperationResult> {
    const destination = customIconPath(app.getPath("userData"));
    await rm(destination, { force: true });
    updateWindowsShortcuts("");
    return {
      applied: true,
      message: "標準のアイコンに戻しました。反映されない場合はアプリを再起動してください。"
    };
  }
}

export function imageFileToIcoBuffer(sourcePath: string): Buffer {
  const source = nativeImage.createFromPath(sourcePath);
  if (source.isEmpty()) {
    throw new Error("画像を読み込めませんでした。別の画像を選択してください。");
  }

  const entries: IcoImageEntry[] = icoSizes.map((size) => ({
    width: size,
    height: size,
    png: source.resize({ width: size, height: size, quality: "best" }).toPNG()
  }));
  return buildIcoBuffer(entries);
}

function applyWindowIcon(window: BrowserWindow | null, iconPath: string): void {
  if (!window || !iconPath) return;
  window.setIcon(iconPath);
}

function updateWindowsShortcuts(iconPath: string): string {
  if (process.platform !== "win32") return "";

  const shortcutPaths = [
    path.join(app.getPath("desktop"), `${app.getName()}.lnk`),
    path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs", `${app.getName()}.lnk`)
  ];
  let updatedCount = 0;

  shortcutPaths.forEach((shortcutPath) => {
    if (!existsSync(shortcutPath)) return;
    try {
      const details = shell.readShortcutLink(shortcutPath);
      if (shell.writeShortcutLink(shortcutPath, "update", { ...details, icon: iconPath, iconIndex: 0 })) {
        updatedCount += 1;
      }
    } catch {
      // ショートカット更新に失敗しても、アプリ内のアイコン変更は有効にする。
    }
  });

  if (updatedCount === 0) return " デスクトップやスタートメニューのアイコンは次回インストール後に反映される場合があります。";
  return " デスクトップやスタートメニューのショートカットにも反映しました。";
}

function showOpenDialog(window: BrowserWindow | null, options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
  return window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options);
}
