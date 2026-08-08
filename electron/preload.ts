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
  consoleSend: (line: string) =>
    ipcRenderer.invoke("console:send", line) as Promise<{ ok: boolean; error?: string }>,
  resetWorldSave: () =>
    ipcRenderer.invoke("world:reset") as Promise<{
      ok: boolean;
      error?: string;
      path?: string;
    }>,
  joinInfo: () => ipcRenderer.invoke("join:info"),
  listBackups: () => ipcRenderer.invoke("backup:list"),
  createBackup: (opts: { includeWorld: boolean; includeLogs: boolean }) =>
    ipcRenderer.invoke("backup:create", opts),
  restoreBackup: (zipPath: string) => ipcRenderer.invoke("backup:restore", zipPath),
  getMods: () => ipcRenderer.invoke("mods:get"),
  setMods: (payload: { mods: string[]; workshop: string[] }) =>
    ipcRenderer.invoke("mods:set", payload),
  workshopCache: (ids: string[]) => ipcRenderer.invoke("workshop:cache", ids),
  workshopResolve: (payload: { ids: string[]; force?: boolean }) =>
    ipcRenderer.invoke("workshop:resolve", payload),
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  listAccounts: () => ipcRenderer.invoke("accounts:list"),
  resetAccountPassword: (payload: { username: string; newPassword?: string }) =>
    ipcRenderer.invoke("accounts:resetPassword", payload),
  wipeAccount: (username: string) => ipcRenderer.invoke("accounts:wipe", username),
  wipeAllAccounts: (payload: { keepAdmin: boolean }) =>
    ipcRenderer.invoke("accounts:wipeAll", payload),
  clearAccountPasswords: (usernames: string[]) =>
    ipcRenderer.invoke("accounts:clearPasswords", usernames)
};

contextBridge.exposeInMainWorld("pz", api);

export type PzApi = typeof api;
