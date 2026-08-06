import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import type { AppSettings, ServerStatus } from "../shared/types";
import { resolvedPaths } from "./settingsStore";
import { parseIni, getIniValue } from "../shared/ini";

let child: ChildProcessWithoutNullStreams | null = null;
let trackedPid: number | null = null;

export function getTrackedPid(): number | null {
  return trackedPid;
}

export function isProcessAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function portsListening(defaultPort: number, udpPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("netstat", ["-ano", "-p", "udp"], { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
        return;
      }
      const hasDefault = stdout.includes(`:${defaultPort}`);
      const hasUdp = stdout.includes(`:${udpPort}`);
      resolve(hasDefault || hasUdp);
    });
  });
}

export async function getServerStatus(settings: AppSettings): Promise<ServerStatus> {
  const paths = resolvedPaths(settings);
  let defaultPort = 16261;
  let udpPort = 16262;
  try {
    if (fs.existsSync(paths.serverIni)) {
      const doc = parseIni(fs.readFileSync(paths.serverIni, "utf8"));
      defaultPort = Number(getIniValue(doc, "DefaultPort", "16261")) || 16261;
      udpPort = Number(getIniValue(doc, "UDPPort", "16262")) || 16262;
    }
  } catch {
    /* ignore */
  }

  const alive = isProcessAlive(trackedPid);
  if (!alive) {
    trackedPid = null;
    child = null;
  }
  const listening = await portsListening(defaultPort, udpPort);
  return {
    running: alive || listening,
    pid: trackedPid,
    portsListening: listening,
    defaultPort,
    udpPort
  };
}

export function startServer(settings: AppSettings): { ok: boolean; error?: string; pid?: number } {
  if (isProcessAlive(trackedPid)) {
    return { ok: false, error: "Server already running" };
  }
  if (!fs.existsSync(settings.startScript)) {
    return { ok: false, error: `Start script not found: ${settings.startScript}` };
  }
  if (!fs.existsSync(settings.installDir)) {
    return { ok: false, error: `Install dir not found: ${settings.installDir}` };
  }

  const args: string[] = [];
  if (settings.serverName && settings.serverName !== "servertest") {
    args.push("-servername", settings.serverName);
  }

  const isBat = settings.startScript.toLowerCase().endsWith(".bat");
  try {
    child = isBat
      ? spawn("cmd.exe", ["/c", settings.startScript, ...args], {
          cwd: settings.installDir,
          windowsHide: false,
          env: { ...process.env }
        })
      : spawn(settings.startScript, args, {
          cwd: settings.installDir,
          windowsHide: false,
          env: { ...process.env }
        });

    trackedPid = child.pid ?? null;
    child.on("exit", () => {
      child = null;
      trackedPid = null;
    });
    child.stdout?.on("data", () => {});
    child.stderr?.on("data", () => {});
    return { ok: true, pid: trackedPid ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function killTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {
      resolve();
    });
  });
}

export async function stopServer(): Promise<{ ok: boolean; error?: string }> {
  const pid = trackedPid;
  if (!pid || !isProcessAlive(pid)) {
    child = null;
    trackedPid = null;
    return { ok: true };
  }
  try {
    await killTree(pid);
    child = null;
    trackedPid = null;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function readConsoleTail(
  settings: AppSettings,
  maxBytes = 256_000
): Promise<string> {
  const logPath = resolvedPaths(settings).consoleLog;
  if (!fs.existsSync(logPath)) return "";
  const stat = fs.statSync(logPath);
  const start = Math.max(0, stat.size - maxBytes);
  const fh = await fs.promises.open(logPath, "r");
  try {
    const len = stat.size - start;
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, start);
    return buf.toString("utf8");
  } finally {
    await fh.close();
  }
}

export function openInExplorer(target: string): void {
  if (!fs.existsSync(target)) return;
  spawn("explorer.exe", [target], { detached: true, stdio: "ignore" }).unref();
}

export function getLanIp(): string | null {
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    if (!entries) continue;
    for (const net of entries) {
      const family = String(net.family);
      if ((family === "IPv4" || family === "4") && !net.internal) return net.address;
    }
  }
  return null;
}
