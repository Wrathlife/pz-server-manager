import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings } from "../shared/types";

const api = {
  getSettings: () => ipcRenderer.invoke("settings:get") as Promise<AppSettings>,
  saveSettings: (s: AppSettings) =>
    ipcRenderer.invoke("settings:save", s) as Promise<AppSettings>,
  defaultSettings: () => ipcRenderer.invoke("settings:defaults") as Promise<AppSettings>,
  detectPaths: () => ipcRenderer.invoke("settings:detect") as Promise<AppSettings>,
  checkPaths: () => ipcRenderer.invoke("settings:checkPaths"),
  resolvedPaths: () => ipcRenderer.invoke("settings:resolved"),
  pickDirectory: () => ipcRenderer.invoke("dialog:pickDirectory") as Promise<string | null>,
  pickFile: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke("dialog:pickFile", filters) as Promise<string | null>,
  openPath: (p: string) => ipcRenderer.invoke("shell:openPath", p),
  showItem: (p: string) => ipcRenderer.invoke("shell:showItem", p),
  readIni: () => ipcRenderer.invoke("ini:read"),
  writeIni: (updates: Record<string, string>) => ipcRenderer.invoke("ini:write", updates),
  readSandbox: () => ipcRenderer.invoke("sandbox:read"),
  writeSandbox: (payload: {
    mode: "flat" | "raw";
    flat?: Record<string, string>;
    raw?: string;
  }) => ipcRenderer.invoke("sandbox:write", payload),
  serverStatus: () => ipcRenderer.invoke("server:status"),
  serverStart: () => ipcRenderer.invoke("server:start"),
  serverStop: () => ipcRenderer.invoke("server:stop"),
  serverRestart: () => ipcRenderer.invoke("server:restart"),
  consoleTail: () => ipcRenderer.invoke("console:tail") as Promise<string>,
  joinInfo: () => ipcRenderer.invoke("join:info"),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  createBackup: (opts: { includeWorld: boolean; includeLogs: boolean }) =>
    ipcRenderer.invoke("backup:create", opts),
  restoreBackup: (zipPath: string) => ipcRenderer.invoke("backup:restore", zipPath),
  getMods: () => ipcRenderer.invoke("mods:get"),
  setMods: (payload: { mods: string[]; workshop: string[] }) =>
    ipcRenderer.invoke("mods:set", payload)
};

contextBridge.exposeInMainWorld("pz", api);

export type PzApi = typeof api;
