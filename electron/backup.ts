import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";
import extractZip from "extract-zip";
import type { AppSettings, BackupEntry } from "../shared/types";
import { resolvedPaths } from "./settingsStore";

function listConfigFiles(settings: AppSettings): string[] {
  const r = resolvedPaths(settings);
  const dir = r.serverDir;
  if (!fs.existsSync(dir)) return [];
  const prefix = settings.serverName;
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && (f.endsWith(".ini") || f.endsWith(".lua")))
    .map((f) => path.join(dir, f));
}

export function listBackups(settings: AppSettings): BackupEntry[] {
  const dir = settings.backupDir;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => {
      const full = path.join(dir, f);
      const st = fs.statSync(full);
      return { name: f, path: full, size: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export async function createBackup(
  settings: AppSettings,
  opts: { includeWorld: boolean; includeLogs: boolean }
): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    fs.mkdirSync(settings.backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(
      settings.backupDir,
      `${settings.serverName}-${stamp}.zip`
    );
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    const done = new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      archive.on("error", reject);
    });

    archive.pipe(output);

    for (const file of listConfigFiles(settings)) {
      archive.file(file, { name: path.join("Server", path.basename(file)) });
    }

    const world = resolvedPaths(settings).worldDir;
    if (opts.includeWorld && fs.existsSync(world)) {
      archive.directory(world, path.join("Saves", "Multiplayer", settings.serverName));
    }

    const logsDir = resolvedPaths(settings).logsDir;
    if (opts.includeLogs && fs.existsSync(logsDir)) {
      archive.directory(logsDir, "Logs");
    }

    const consoleLog = resolvedPaths(settings).consoleLog;
    if (opts.includeLogs && fs.existsSync(consoleLog)) {
      archive.file(consoleLog, { name: "server-console.txt" });
    }

    await archive.finalize();
    await done;
    return { ok: true, path: outPath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function restoreBackup(
  settings: AppSettings,
  zipPath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!fs.existsSync(zipPath)) return { ok: false, error: "Backup zip not found" };
    const tmp = path.join(settings.backupDir, `_restore_${Date.now()}`);
    fs.mkdirSync(tmp, { recursive: true });
    await extractZip(zipPath, { dir: tmp });

    const serverSrc = path.join(tmp, "Server");
    const serverDst = path.join(settings.zomboidDir, "Server");
    if (fs.existsSync(serverSrc)) {
      fs.mkdirSync(serverDst, { recursive: true });
      for (const f of fs.readdirSync(serverSrc)) {
        fs.copyFileSync(path.join(serverSrc, f), path.join(serverDst, f));
      }
    }

    const worldSrc = path.join(tmp, "Saves", "Multiplayer", settings.serverName);
    const worldDst = resolvedPaths(settings).worldDir;
    if (fs.existsSync(worldSrc)) {
      fs.mkdirSync(path.dirname(worldDst), { recursive: true });
      fs.cpSync(worldSrc, worldDst, { recursive: true, force: true });
    }

    fs.rmSync(tmp, { recursive: true, force: true });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
