import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  net
} from "electron";
import path from "node:path";
import fs from "node:fs";
import type { AppSettings } from "../shared/types";
import {
  loadSettings,
  saveSettings,
  detectSteamPaths,
  resolvedPaths,
  checkPaths,
  defaultSettings
} from "./settingsStore";
import { parseIni, applyIniUpdates, serializeIni, getIniValue } from "../shared/ini";
import {
  startServer,
  stopServer,
  getServerStatus,
  readConsoleTail,
  openInExplorer,
  getLanIp
} from "./processManager";
import { createBackup, listBackups, restoreBackup } from "./backup";
import { readSandboxFile, writeSandboxFile, applySandboxUpdates } from "./sandbox";
import { getCachedWorkshopTitles, resolveWorkshopTitles } from "./steamWorkshop";

let mainWindow: BrowserWindow | null = null;
let settingsCache = loadSettings();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0f1218",
    title: "PZ Server Manager",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function getSettings(): AppSettings {
  return settingsCache;
}

ipcMain.handle("settings:get", () => getSettings());
ipcMain.handle("settings:save", (_e, next: AppSettings) => {
  settingsCache = next;
  saveSettings(next);
  return settingsCache;
});
ipcMain.handle("settings:defaults", () => defaultSettings());
ipcMain.handle("settings:detect", () => {
  const detected = detectSteamPaths();
  settingsCache = { ...settingsCache, ...detected };
  if (!settingsCache.zomboidDir) {
    /* keep */
  }
  saveSettings(settingsCache);
  return settingsCache;
});
ipcMain.handle("settings:checkPaths", () => checkPaths(getSettings()));
ipcMain.handle("settings:resolved", () => resolvedPaths(getSettings()));

ipcMain.handle("dialog:pickDirectory", async () => {
  const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return res.canceled ? null : res.filePaths[0] ?? null;
});
ipcMain.handle("dialog:pickFile", async (_e, filters?: Electron.FileFilter[]) => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: filters ?? [{ name: "All", extensions: ["*"] }]
  });
  return res.canceled ? null : res.filePaths[0] ?? null;
});

ipcMain.handle("shell:openPath", async (_e, p: string) => shell.openPath(p));
ipcMain.handle("shell:showItem", (_e, p: string) => {
  openInExplorer(p);
});

ipcMain.handle("ini:read", () => {
  const s = getSettings();
  const p = resolvedPaths(s).serverIni;
  if (!fs.existsSync(p)) return { ok: false as const, error: `Missing ${p}` };
  const doc = parseIni(fs.readFileSync(p, "utf8"));
  return { ok: true as const, path: p, values: doc.values, text: serializeIni(doc) };
});

ipcMain.handle("ini:write", (_e, updates: Record<string, string>) => {
  const s = getSettings();
  const p = resolvedPaths(s).serverIni;
  if (!fs.existsSync(p)) return { ok: false as const, error: `Missing ${p}` };
  const doc = parseIni(fs.readFileSync(p, "utf8"));
  const next = applyIniUpdates(doc, updates);
  fs.writeFileSync(p, serializeIni(next), "utf8");
  return { ok: true as const, values: next.values };
});

ipcMain.handle("sandbox:read", () => {
  const p = resolvedPaths(getSettings()).sandboxLua;
  const { flat, raw } = readSandboxFile(p);
  return { path: p, exists: fs.existsSync(p), flat, raw };
});

ipcMain.handle(
  "sandbox:write",
  (_e, payload: { mode: "flat" | "raw"; flat?: Record<string, string>; raw?: string }) => {
    const p = resolvedPaths(getSettings()).sandboxLua;
    if (!fs.existsSync(p) && payload.mode === "flat") {
      return { ok: false as const, error: `Missing ${p}` };
    }
    if (payload.mode === "raw" && typeof payload.raw === "string") {
      writeSandboxFile(p, payload.raw);
      return { ok: true as const };
    }
    const current = readSandboxFile(p);
    const next = applySandboxUpdates(current.raw, payload.flat ?? {});
    writeSandboxFile(p, next);
    return { ok: true as const };
  }
);

ipcMain.handle("server:status", () => getServerStatus(getSettings()));
ipcMain.handle("server:start", () => startServer(getSettings()));
ipcMain.handle("server:stop", () => stopServer());
ipcMain.handle("server:restart", async () => {
  await stopServer();
  await new Promise((r) => setTimeout(r, 1500));
  return startServer(getSettings());
});
ipcMain.handle("console:tail", () => readConsoleTail(getSettings()));

ipcMain.handle("join:info", async () => {
  const status = await getServerStatus(getSettings());
  let publicIp: string | null = null;
  try {
    publicIp = await new Promise<string | null>((resolve) => {
      const req = net.request("https://api.ipify.org");
      let data = "";
      req.on("response", (res) => {
        res.on("data", (chunk) => {
          data += chunk.toString();
        });
        res.on("end", () => resolve(data.trim() || null));
      });
      req.on("error", () => resolve(null));
      req.end();
    });
  } catch {
    publicIp = null;
  }
  return {
    loopback: "127.0.0.1",
    lanIp: getLanIp(),
    publicIp,
    port: status.defaultPort
  };
});

ipcMain.handle("backup:list", () => listBackups(getSettings()));
ipcMain.handle(
  "backup:create",
  (_e, opts: { includeWorld: boolean; includeLogs: boolean }) =>
    createBackup(getSettings(), opts)
);
ipcMain.handle("backup:restore", async (_e, zipPath: string) => {
  const res = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Cancel", "Restore"],
    defaultId: 0,
    cancelId: 0,
    title: "Restore backup",
    message:
      "This will overwrite server config (and world if present in the zip). Continue?"
  });
  if (res.response !== 1) return { ok: false as const, error: "Cancelled" };
  return restoreBackup(getSettings(), zipPath);
});

ipcMain.handle("mods:get", () => {
  const p = resolvedPaths(getSettings()).serverIni;
  if (!fs.existsSync(p)) return { mods: [], workshop: [] };
  const doc = parseIni(fs.readFileSync(p, "utf8"));
  const split = (v: string) =>
    v
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
  return {
    mods: split(getIniValue(doc, "Mods")),
    workshop: split(getIniValue(doc, "WorkshopItems"))
  };
});

ipcMain.handle(
  "mods:set",
  (_e, payload: { mods: string[]; workshop: string[] }) => {
    const p = resolvedPaths(getSettings()).serverIni;
    if (!fs.existsSync(p)) return { ok: false as const, error: `Missing ${p}` };
    const doc = parseIni(fs.readFileSync(p, "utf8"));
    const next = applyIniUpdates(doc, {
      Mods: payload.mods.join(";"),
      WorkshopItems: payload.workshop.join(";")
    });
    fs.writeFileSync(p, serializeIni(next), "utf8");
    return { ok: true as const };
  }
);

ipcMain.handle("workshop:cache", (_e, ids: string[]) => getCachedWorkshopTitles(ids));
ipcMain.handle(
  "workshop:resolve",
  (_e, payload: { ids: string[]; force?: boolean }) =>
    resolveWorkshopTitles(payload.ids ?? [], { force: payload.force })
);

ipcMain.handle("shell:openExternal", (_e, url: string) => shell.openExternal(url));
