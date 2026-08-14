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
    sections: {
      id: string;
      label: string;
      isMod: boolean;
      fields: {
        path: string;
        section: string;
        key: string;
        value: string;
        label: string | null;
        kind: "bool" | "number" | "string" | "other";
      }[];
    }[];
    raw: string;
  }>;
  writeSandbox: (payload: {
    mode: "flat" | "raw";
    flat?: Record<string, string>;
    raw?: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  serverStatus: () => Promise<import("../shared/types").ServerStatus>;
  serverStart: () => Promise<{ ok: boolean; error?: string; pid?: number }>;
  serverStop: () => Promise<{ ok: boolean; error?: string; killed?: number[] }>;
  serverRestart: () => Promise<{ ok: boolean; error?: string; pid?: number }>;
  consoleTail: () => Promise<string>;
  consoleSend: (line: string) => Promise<{ ok: boolean; error?: string }>;
  resetWorldSave: () => Promise<{ ok: boolean; error?: string; path?: string }>;
  joinInfo: () => Promise<import("../shared/types").JoinInfo>;
  listBackups: () => Promise<import("../shared/types").BackupEntry[]>;
  createBackup: (opts: {
    includeWorld: boolean;
    includeLogs: boolean;
  }) => Promise<{ ok: boolean; path?: string; error?: string }>;
  restoreBackup: (
    zipPath: string
  ) => Promise<{ ok: boolean; error?: string }>;
  getMods: () => Promise<
    | { ok: true; path: string; mods: string[]; workshop: string[] }
    | { ok: false; error: string; path?: string }
  >;
  setMods: (payload: {
    mods: string[];
    workshop: string[];
  }) => Promise<{ ok: boolean; error?: string; path?: string }>;
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
  workshopModIds: (
    ids: string[]
  ) => Promise<import("../shared/types").WorkshopModMapping[]>;
  workshopSubscribed: () => Promise<
    | { ok: true; path: string; items: import("../shared/types").WorkshopModMapping[] }
    | { ok: false; error: string; path: string }
  >;
  listClientPresets: () => Promise<
    | {
        ok: true;
        path: string;
        presets: import("../shared/types").ClientModPresetResolved[];
      }
    | { ok: false; error: string; path: string }
  >;
  openExternal: (url: string) => Promise<void>;
  listAccounts: () => Promise<{
    ok: boolean;
    path: string;
    exists: boolean;
    accounts: {
      id: number;
      username: string;
      role: string | null;
      roleId?: number | null;
      steamid: string | null;
      lastConnection: string | null;
      displayName: string | null;
      hasPassword: boolean;
      world: string | null;
    }[];
    error?: string;
  }>;
  resetAccountPassword: (payload: {
    username: string;
    newPassword?: string;
  }) => Promise<{ ok: boolean; error?: string; method?: string; backup?: string }>;
  wipeAccount: (
    username: string
  ) => Promise<{ ok: boolean; error?: string; method?: string; backup?: string }>;
  wipeAllAccounts: (payload: {
    keepAdmin: boolean;
  }) => Promise<{ ok: boolean; error?: string; deleted?: number; backup?: string }>;
  clearAccountPasswords: (
    usernames: string[]
  ) => Promise<{ ok: boolean; error?: string; cleared?: number; backup?: string }>;
};

declare global {
  interface Window {
    pz: PzApi;
  }
}
