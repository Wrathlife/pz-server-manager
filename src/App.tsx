import { useCallback, useEffect, useState } from "react";
import type { AppSettings, ServerStatus } from "../shared/types";
import { Dashboard } from "./pages/Dashboard";
import { IniSettings } from "./pages/IniSettings";
import { SandboxPage } from "./pages/SandboxPage";
import { ModsPage } from "./pages/ModsPage";
import { BackupsPage } from "./pages/BackupsPage";
import { AppSettingsPage } from "./pages/AppSettingsPage";
import { AccountsPage } from "./pages/AccountsPage";

type Page =
  | "dashboard"
  | "ini"
  | "sandbox"
  | "mods"
  | "accounts"
  | "backups"
  | "settings";

const NAV: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "ini", label: "Settings (INI)" },
  { id: "sandbox", label: "Sandbox" },
  { id: "mods", label: "Mods" },
  { id: "accounts", label: "Accounts" },
  { id: "backups", label: "Backups" },
  { id: "settings", label: "App Settings" }
];

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!window.pz) return;
    setStatus(await window.pz.serverStatus());
  }, []);

  const refreshSettings = useCallback(async () => {
    if (!window.pz) return;
    setSettings(await window.pz.getSettings());
  }, []);

  useEffect(() => {
    void refreshSettings();
    void refreshStatus();
    const t = setInterval(() => void refreshStatus(), 2500);
    return () => clearInterval(t);
  }, [refreshSettings, refreshStatus]);

  useEffect(() => {
    if (settings?.consoleFontSize) {
      document.documentElement.style.setProperty(
        "--console-font",
        `${settings.consoleFontSize}px`
      );
    }
  }, [settings?.consoleFontSize]);

  async function onStart() {
    setBusy(true);
    setMsg(null);
    const res = await window.pz.serverStart();
    setBusy(false);
    if (!res.ok) setMsg(res.error || "Start failed");
    await refreshStatus();
  }

  async function onStop() {
    setBusy(true);
    setMsg(null);
    const res = await window.pz.serverStop();
    setBusy(false);
    if (!res.ok) setMsg(res.error || "Stop failed");
    else if (res.killed?.length) setMsg(`Stopped pid ${res.killed.join(", ")}`);
    await refreshStatus();
  }

  async function onRestart() {
    setBusy(true);
    setMsg(null);
    const res = await window.pz.serverRestart();
    setBusy(false);
    if (!res.ok) setMsg(res.error || "Restart failed");
    await refreshStatus();
  }

  const running = !!status?.running;

  return (
    <div className="app">
      <header className="topbar">
        <h1>PZ Server Manager</h1>
        <span className="muted">{settings?.serverName ?? "…"}</span>
        <span className={`status-pill ${running ? "running" : "stopped"}`}>
          {running ? "Running" : "Stopped"}
          {status?.pid ? ` · pid ${status.pid}` : ""}
          {status?.portsListening ? " · ports up" : ""}
        </span>
        <div className="spacer" />
        {msg ? <span className="err">{msg}</span> : null}
        <button className="btn ok" disabled={busy || running} onClick={() => void onStart()}>
          Start
        </button>
        <button className="btn danger" disabled={busy || !running} onClick={() => void onStop()}>
          Stop
        </button>
        <button className="btn" disabled={busy} onClick={() => void onRestart()}>
          Restart
        </button>
      </header>

      <nav className="sidebar">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={`nav-btn ${page === n.id ? "active" : ""}`}
            onClick={() => setPage(n.id)}
          >
            {n.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {!window.pz ? (
          <p className="err">Electron API missing — run via `npm run dev`.</p>
        ) : null}
        {page === "dashboard" && settings ? (
          <Dashboard settings={settings} status={status} onStatus={refreshStatus} />
        ) : null}
        {page === "ini" ? <IniSettings onRestart={() => void onRestart()} /> : null}
        {page === "sandbox" ? <SandboxPage /> : null}
        {page === "mods" ? <ModsPage onRestart={() => void onRestart()} /> : null}
        {page === "accounts" ? <AccountsPage running={running} /> : null}
        {page === "backups" ? <BackupsPage /> : null}
        {page === "settings" && settings ? (
          <AppSettingsPage
            settings={settings}
            onChange={async (next) => {
              const saved = await window.pz.saveSettings(next);
              setSettings(saved);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}
