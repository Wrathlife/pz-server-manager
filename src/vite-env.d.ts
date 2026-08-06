export {};

type PzApi = {
  getSettings: () => Promise<import("../shared/types").AppSettings>;
  saveSettings: (
    s: import("../shared/types").AppSettings
  ) => Promise<import("../shared/types").AppSettings>;
  defaultSettings: () => Promise<import("../shared/types").AppSettings>;
  detectPaths: () => Promise<import("../shared/types").AppSettings>;
  checkPaths: () => Promise<import("../shared/types").PathCheck>;
  resolvedPaths: () => Promise<Record<string, string>>;
  pickDirectory: () => Promise<string | null>;
  pickFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
  openPath: (p: string) => Promise<string>;
  showItem: (p: string) => Promise<void>;
  readIni: () => Promise<
    | { ok: true; path: string; values: Record<string, string>; text: string }
    | { ok: false; error: string }
  >;
  writeIni: (
    updates: Record<string, string>
  ) => Promise<{ ok: true; values: Record<string, string> } | { ok: false; error: string }>;
  readSandbox: () => Promise<{
    path: string;
    exists: boolean;
    flat: Record<string, string>;
    raw: string;
  }>;
  writeSandbox: (payload: {
    mode: "flat" | "raw";
    flat?: Record<string, string>;
    raw?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  serverStatus: () => Promise<import("../shared/types").ServerStatus>;
  serverStart: () => Promise<{ ok: boolean; error?: string; pid?: number }>;
  serverStop: () => Promise<{ ok: boolean; error?: string }>;
  serverRestart: () => Promise<{ ok: boolean; error?: string; pid?: number }>;
  consoleTail: () => Promise<string>;
  joinInfo: () => Promise<import("../shared/types").JoinInfo>;
  listBackups: () => Promise<import("../shared/types").BackupEntry[]>;
  createBackup: (opts: {
    includeWorld: boolean;
    includeLogs: boolean;
  }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  restoreBackup: (
    zipPath: string
  ) => Promise<{ ok: boolean; error?: string }>;
  getMods: () => Promise<{ mods: string[]; workshop: string[] }>;
  setMods: (payload: {
    mods: string[];
    workshop: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  workshopCache: (
    ids: string[]
  ) => Promise<
    Record<string, { id: string; title: string | null; error?: string; fetchedAt: number }>
  >;
  workshopResolve: (payload: {
    ids: string[];
    force?: boolean;
  }) => Promise<
    Record<string, { id: string; title: string | null; error?: string; fetchedAt: number }>
  >;
  openExternal: (url: string) => Promise<void>;
};

declare global {
  interface Window {
    pz: PzApi;
  }
}
