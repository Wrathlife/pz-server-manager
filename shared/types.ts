export type AppSettings = {
  installDir: string;
  startScript: string;
  zomboidDir: string;
  serverName: string;
  backupDir: string;
  consoleFontSize: number;
  /** Client game Workshop content folder (`…/workshop/content/108600`). Empty = auto-detect. */
  clientWorkshopDir: string;
};

export type ModIdSource = "client" | "server" | "steam" | "none";

export type WorkshopModMapping = {
  id: string;
  title: string | null;
  modIds: string[];
  source: ModIdSource;
  error?: string;
};

export type ClientModPreset = {
  name: string;
  mods: string[];
};

export type ClientModPresetResolved = ClientModPreset & {
  workshop: string[];
  items: WorkshopModMapping[];
  unmatched: string[];
};

export type IniDocument = {
  /** Original lines including comments and blanks */
  lines: string[];
  /** key -> last value (case-sensitive as written in file) */
  values: Record<string, string>;
  /** key -> line index of assignment */
  keyLines: Record<string, number>;
};

export type ServerStatus = {
  running: boolean;
  pid: number | null;
  portsListening: boolean;
  defaultPort: number;
  udpPort: number;
};

export type JoinInfo = {
  loopback: string;
  lanIp: string | null;
  publicIp: string | null;
  port: number;
};

export type BackupEntry = {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
};

export type PathCheck = {
  installDir: boolean;
  startScript: boolean;
  zomboidDir: boolean;
  serverIni: boolean;
  sandboxLua: boolean;
  worldDir: boolean;
  consoleLog: boolean;
  backupDir: boolean;
  clientWorkshopDir: boolean;
};

export const PASSWORD_KEYS = new Set(["Password", "RCONPassword"]);

export type IniGroupId =
  | "network"
  | "access"
  | "gameplay"
  | "chat"
  | "safehouse"
  | "rcon"
  | "misc";

export type IniGroup = {
  id: IniGroupId;
  label: string;
  keys: string[];
};
