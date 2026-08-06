import type { AppSettings, PathCheck } from "../shared/types";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SETTINGS_DIR = path.join(os.homedir(), "AppData", "Roaming", "pz-server-manager");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

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
    consoleFontSize: 12
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
  const candidates = [
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Project Zomboid Dedicated Server",
    "C:\\Program Files\\Steam\\steamapps\\common\\Project Zomboid Dedicated Server",
    path.join(os.homedir(), "Steam", "steamapps", "common", "Project Zomboid Dedicated Server")
  ];
  const installDir = candidates.find((p) => fs.existsSync(p));
  if (!installDir) return {};
  const bat = path.join(installDir, "StartServer64.bat");
  const nosteam = path.join(installDir, "StartServer64_nosteam.bat");
  return {
    installDir,
    startScript: fs.existsSync(bat) ? bat : fs.existsSync(nosteam) ? nosteam : bat
  };
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
    consoleLog: path.join(s.zomboidDir, "server-console.txt"),
    logsDir: path.join(s.zomboidDir, "Logs")
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
    backupDir: fs.existsSync(s.backupDir)
  };
}
