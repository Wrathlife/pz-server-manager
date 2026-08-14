import type { AppSettings, PathCheck } from "../shared/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SETTINGS_DIR = path.join(os.homedir(), "AppData", "Roaming", "pz-server-manager");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");
export const PZ_WORKSHOP_APPID = "108600";

export function defaultClientWorkshopCandidates(): string[] {
  return [
    `C:\\Program Files (x86)\\Steam\\steamapps\\workshop\\content\\${PZ_WORKSHOP_APPID}`,
    `C:\\Program Files\\Steam\\steamapps\\workshop\\content\\${PZ_WORKSHOP_APPID}`
  ];
}

export function detectClientWorkshopDir(): string | undefined {
  return defaultClientWorkshopCandidates().find((p) => fs.existsSync(p));
}

export function resolveClientWorkshopDir(s: AppSettings): string {
  const override = s.clientWorkshopDir?.trim();
  if (override) return override;
  return detectClientWorkshopDir() ?? defaultClientWorkshopCandidates()[0];
}

export function resolveServerWorkshopDir(s: AppSettings): string {
  return path.join(
    s.installDir,
    "steamapps",
    "workshop",
    "content",
    PZ_WORKSHOP_APPID
  );
}

export function defaultSettings(): AppSettings {
  const home = os.homedir();
  const installDir =
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Project Zomboid Dedicated Server";
  const zomboidDir = path.join(home, "Zomboid");
  return {
    installDir,
    startScript: path.join(installDir, "StartServer64.bat"),
    zomboidDir,
    serverName: "servertest",
    backupDir: path.join(zomboidDir, "backups", "pz-server-manager"),
    consoleFontSize: 12,
    clientWorkshopDir: ""
  };
}

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return defaultSettings();
    const raw = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) as Partial<AppSettings>;
    return { ...defaultSettings(), ...raw };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
}

export function detectSteamPaths(): Partial<AppSettings> {
  const out: Partial<AppSettings> = {};
  const candidates = [
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Project Zomboid Dedicated Server",
    "C:\\Program Files\\Steam\\steamapps\\common\\Project Zomboid Dedicated Server",
    path.join(os.homedir(), "Steam", "steamapps", "common", "Project Zomboid Dedicated Server")
  ];
  const installDir = candidates.find((p) => fs.existsSync(p));
  if (installDir) {
    const bat = path.join(installDir, "StartServer64.bat");
    const nosteam = path.join(installDir, "StartServer64_nosteam.bat");
    out.installDir = installDir;
    out.startScript = fs.existsSync(bat) ? bat : fs.existsSync(nosteam) ? nosteam : bat;
  }
  const client = detectClientWorkshopDir();
  if (client) out.clientWorkshopDir = client;
  return out;
}

export function resolvedPaths(s: AppSettings) {
  const serverDir = path.join(s.zomboidDir, "Server");
  const name = s.serverName || "servertest";
  return {
    serverDir,
    serverIni: path.join(serverDir, `${name}.ini`),
    sandboxLua: path.join(serverDir, `${name}_SandboxVars.lua`),
    spawnpoints: path.join(serverDir, `${name}_spawnpoints.lua`),
    spawnregions: path.join(serverDir, `${name}_spawnregions.lua`),
    worldDir: path.join(s.zomboidDir, "Saves", "Multiplayer", name),
    accountsDb: path.join(s.zomboidDir, "db", `${name}.db`),
    consoleLog: path.join(s.zomboidDir, "server-console.txt"),
    logsDir: path.join(s.zomboidDir, "Logs"),
    serverWorkshopDir: resolveServerWorkshopDir(s),
    clientWorkshopDir: resolveClientWorkshopDir(s),
    clientModlist: path.join(s.zomboidDir, "Lua", "pz_modlist_settings.cfg")
  };
}

export function checkPaths(s: AppSettings): PathCheck {
  const r = resolvedPaths(s);
  return {
    installDir: fs.existsSync(s.installDir),
    startScript: fs.existsSync(s.startScript),
    zomboidDir: fs.existsSync(s.zomboidDir),
    serverIni: fs.existsSync(r.serverIni),
    sandboxLua: fs.existsSync(r.sandboxLua),
    worldDir: fs.existsSync(r.worldDir),
    consoleLog: fs.existsSync(r.consoleLog),
    backupDir: fs.existsSync(s.backupDir),
    clientWorkshopDir: fs.existsSync(r.clientWorkshopDir)
  };
}
