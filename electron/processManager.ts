import { spawn, execFile, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AppSettings, ServerStatus } from "../shared/types";
import { resolvedPaths } from "./settingsStore";
import { parseIni, getIniValue } from "../shared/ini";

let child: ChildProcess | null = null;
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

function execFileText(
  file: string,
  args: string[],
  maxBuffer = 4 * 1024 * 1024
): Promise<string> {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, maxBuffer }, (err, stdout) => {
      if (err || !stdout) resolve("");
      else resolve(stdout.toString());
    });
  });
}

function readServerPorts(settings: AppSettings): { defaultPort: number; udpPort: number } {
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
  return { defaultPort, udpPort };
}

/** PIDs of java processes running zombie.network.GameServer (any launcher). */
export async function findGameServerPids(): Promise<number[]> {
  const stdout = await execFileText("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-CimInstance Win32_Process -Filter \"Name = 'java.exe'\" | " +
      "Where-Object { $_.CommandLine -and ($_.CommandLine -like '*zombie.network.GameServer*') } | " +
      "Select-Object -ExpandProperty ProcessId"
  ]);
  const pids = stdout
    .split(/\r?\n/)
    .map((l) => Number(l.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(pids)];
}

/** PIDs owning the dedicated-server UDP ports (covers odd launches). */
export async function findPidsOnUdpPorts(ports: number[]): Promise<number[]> {
  if (!ports.length) return [];
  const stdout = await execFileText("netstat", ["-ano", "-p", "udp"]);
  const found = new Set<number>();
  const portSet = new Set(ports);
  for (const line of stdout.split(/\r?\n/)) {
    // UDP    0.0.0.0:16261           *:*                                    12345
    const m = line.match(/^\s*UDP\s+\S+:(\d+)\s+\S+\s+(\d+)\s*$/i);
    if (!m) continue;
    const port = Number(m[1]);
    const pid = Number(m[2]);
    if (portSet.has(port) && Number.isFinite(pid) && pid > 0) found.add(pid);
  }
  return [...found];
}

export async function portsListening(defaultPort: number, udpPort: number): Promise<boolean> {
  const pids = await findPidsOnUdpPorts([defaultPort, udpPort]);
  return pids.length > 0;
}

/** All PIDs that look like this dedicated server (tracked + GameServer + port owners). */
export async function discoverServerPids(settings: AppSettings): Promise<number[]> {
  const { defaultPort, udpPort } = readServerPorts(settings);
  const found = new Set<number>();
  if (trackedPid && isProcessAlive(trackedPid)) found.add(trackedPid);
  for (const pid of await findGameServerPids()) found.add(pid);
  for (const pid of await findPidsOnUdpPorts([defaultPort, udpPort])) found.add(pid);
  return [...found];
}

/**
 * Prefer launching java.exe directly (stdin reaches GameServer).
 * Heap / flags are taken from StartServer64.bat when present.
 */
function buildJavaLaunch(
  settings: AppSettings,
  serverArgs: string[]
): { exe: string; args: string[] } | null {
  const java = path.join(settings.installDir, "jre64", "bin", "java.exe");
  if (!fs.existsSync(java)) return null;

  let xms = "-Xms16g";
  let xmx = "-Xmx16g";
  let steam = "1";
  try {
    if (fs.existsSync(settings.startScript)) {
      const bat = fs.readFileSync(settings.startScript, "utf8");
      const mXms = bat.match(/-Xms\S+/i);
      const mXmx = bat.match(/-Xmx\S+/i);
      const mSteam = bat.match(/-Dzomboid\.steam=(\d+)/i);
      if (mXms) xms = mXms[0];
      if (mXmx) xmx = mXmx[0];
      if (mSteam) steam = mSteam[1];
    }
  } catch {
    /* use defaults */
  }

  return {
    exe: java,
    args: [
      "-Djava.awt.headless=true",
      `-Dzomboid.steam=${steam}`,
      "-Dzomboid.znetlog=1",
      "-XX:+UseZGC",
      "-XX:-CreateCoredumpOnCrash",
      "-XX:-OmitStackTraceInFastThrow",
      xms,
      xmx,
      "-Djava.library.path=natives/",
      "-cp",
      "java/;java/projectzomboid.jar",
      "zombie.network.GameServer",
      "-statistic",
      "0",
      ...serverArgs
    ]
  };
}

export async function getServerStatus(settings: AppSettings): Promise<ServerStatus> {
  const { defaultPort, udpPort } = readServerPorts(settings);

  if (!isProcessAlive(trackedPid)) {
    trackedPid = null;
    child = null;
  }

  const portPids = await findPidsOnUdpPorts([defaultPort, udpPort]);
  const listening = portPids.length > 0;

  // Only scan java command lines when ports aren't bound yet (startup / odd state)
  let gamePids: number[] = [];
  if (!listening && !trackedPid) {
    gamePids = await findGameServerPids();
  }

  const pid = trackedPid ?? portPids[0] ?? gamePids[0] ?? null;
  const running = !!trackedPid || listening || gamePids.length > 0;

  return {
    running,
    pid,
    portsListening: listening,
    defaultPort,
    udpPort
  };
}

export async function startServer(
  settings: AppSettings
): Promise<{ ok: boolean; error?: string; pid?: number }> {
  const existing = await discoverServerPids(settings);
  if (existing.length) {
    return {
      ok: false,
      error: `Server already running (pid ${existing.join(", ")}). Stop it first.`
    };
  }
  if (!fs.existsSync(settings.startScript)) {
    return { ok: false, error: `Start script not found: ${settings.startScript}` };
  }
  if (!fs.existsSync(settings.installDir)) {
    return { ok: false, error: `Install dir not found: ${settings.installDir}` };
  }

  const serverArgs: string[] = [];
  if (settings.serverName && settings.serverName !== "servertest") {
    serverArgs.push("-servername", settings.serverName);
  }

  try {
    const spawnOpts = {
      cwd: settings.installDir,
      windowsHide: true,
      env: { ...process.env },
      stdio: ["pipe", "ignore", "ignore"] as ["pipe", "ignore", "ignore"]
    };

    const javaLaunch = buildJavaLaunch(settings, serverArgs);
    const proc = javaLaunch
      ? spawn(javaLaunch.exe, javaLaunch.args, spawnOpts)
      : settings.startScript.toLowerCase().endsWith(".bat")
        ? spawn("cmd.exe", ["/c", settings.startScript, ...serverArgs], spawnOpts)
        : spawn(settings.startScript, serverArgs, spawnOpts);

    child = proc;
    trackedPid = proc.pid ?? null;
    if (proc.stdin) {
      proc.stdin.setDefaultEncoding("utf8");
    }
    proc.on("exit", () => {
      child = null;
      trackedPid = null;
    });
    return { ok: true, pid: trackedPid ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Send a line to the dedicated server console (stdin). Only works if started from this app. */
export function sendConsoleCommand(line: string): { ok: boolean; error?: string } {
  const cmd = line.replace(/\r?\n/g, "").trim();
  if (!cmd) return { ok: false, error: "Empty command" };
  if (!child?.stdin || child.killed || !isProcessAlive(trackedPid)) {
    return {
      ok: false,
      error:
        "Console input needs a server started from this app (Stop + Start if it was already running)."
    };
  }
  try {
    const writable = child.stdin.write(`${cmd}\r\n`);
    if (!writable) {
      child.stdin.once("drain", () => {});
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Delete Multiplayer world save for the configured server profile. Server must be stopped. */
export async function resetWorldSave(settings: AppSettings): Promise<{
  ok: boolean;
  error?: string;
  path?: string;
}> {
  const running = await discoverServerPids(settings);
  if (running.length) {
    return { ok: false, error: "Stop the server before resetting the world save." };
  }
  const world = resolvedPaths(settings).worldDir;
  if (!fs.existsSync(world)) {
    return { ok: true, path: world };
  }
  try {
    fs.rmSync(world, { recursive: true, force: true });
    return { ok: true, path: world };
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

/** Stop tracked process and any external GameServer / port-bound server. */
export async function stopServer(
  settings: AppSettings
): Promise<{ ok: boolean; error?: string; killed?: number[] }> {
  const pids = await discoverServerPids(settings);
  if (!pids.length) {
    child = null;
    trackedPid = null;
    return { ok: true, killed: [] };
  }
  try {
    await Promise.all(pids.map((pid) => killTree(pid)));
    child = null;
    trackedPid = null;
    // Brief wait so ports release before status poll
    await new Promise((r) => setTimeout(r, 400));
    const leftover = await discoverServerPids(settings);
    if (leftover.length) {
      return {
        ok: false,
        error: `Could not stop pid(s): ${leftover.join(", ")}`,
        killed: pids
      };
    }
    return { ok: true, killed: pids };
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
