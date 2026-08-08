import { useEffect, useRef, useState } from "react";
import type { AppSettings, JoinInfo, ServerStatus } from "../../shared/types";
import { PASSWORD_KEYS } from "../../shared/types";
import { QUICK_DASHBOARD_KEYS } from "../../shared/iniGroups";

type Props = {
  settings: AppSettings;
  status: ServerStatus | null;
  onStatus: () => Promise<void>;
};

export function Dashboard({ settings, status, onStatus }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [consoleText, setConsoleText] = useState("");
  const [filter, setFilter] = useState("");
  const [command, setCommand] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [join, setJoin] = useState<JoinInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cmdRef = useRef<HTMLInputElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const running = !!status?.running;
  const canSendCommands = running && !!status?.pid;

  async function loadIni() {
    const res = await window.pz.readIni();
    if (!res.ok) {
      setWarn(res.error);
      return;
    }
    setValues(res.values);
    const pub = res.values.Public === "true";
    const pw = res.values.Password ?? "";
    if (pub && !pw) setWarn("Public=true with empty Password — anyone can join.");
    else setWarn(null);
  }

  useEffect(() => {
    void loadIni();
    void window.pz.joinInfo().then(setJoin);
  }, [settings.serverName, settings.zomboidDir]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const t = await window.pz.consoleTail();
      if (alive) setConsoleText(t);
    };
    void tick();
    const id = setInterval(() => void tick(), 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [settings.zomboidDir]);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleText, autoScroll]);

  async function saveQuick() {
    const updates: Record<string, string> = {};
    for (const k of QUICK_DASHBOARD_KEYS) {
      if (k in values) updates[k] = values[k];
    }
    const res = await window.pz.writeIni(updates);
    if (!res.ok) setNotice(res.error);
    else {
      setNotice("Saved quick settings.");
      setValues(res.values);
      await onStatus();
      void window.pz.joinInfo().then(setJoin);
    }
  }

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function sendCommand() {
    const line = command.trim();
    if (!line) return;
    setNotice(null);
    const res = await window.pz.consoleSend(line);
    if (!res.ok) {
      setNotice(res.error || "Failed to send command");
      return;
    }
    setCmdHistory((h) => {
      const next = [...h.filter((x) => x !== line), line].slice(-40);
      return next;
    });
    setHistIdx(-1);
    setCommand("");
    setNotice(`Sent: ${line}`);
    setTimeout(() => void window.pz.consoleTail().then(setConsoleText), 400);
  }

  function onCmdKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void sendCommand();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!cmdHistory.length) return;
      const next = histIdx < 0 ? cmdHistory.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setCommand(cmdHistory[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const next = histIdx + 1;
      if (next >= cmdHistory.length) {
        setHistIdx(-1);
        setCommand("");
      } else {
        setHistIdx(next);
        setCommand(cmdHistory[next] ?? "");
      }
    }
  }

  async function onResetWorld() {
    setNotice(null);
    if (running) {
      setNotice("Stop the server before resetting the world save.");
      return;
    }
    const res = await window.pz.resetWorldSave();
    if (!res.ok) {
      if (res.error !== "Cancelled") setNotice(res.error || "Reset failed");
      return;
    }
    setNotice(
      res.path
        ? `World save deleted: ${res.path}. Start the server to generate a fresh map.`
        : "World save reset."
    );
  }

  const filtered = filter
    ? consoleText
        .split("\n")
        .filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
        .join("\n")
    : consoleText;

  const port = status?.defaultPort ?? Number(values.DefaultPort || 16261);
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setNotice(`Copied ${text}`);
  };

  return (
    <div className="page">
      <h2>Dashboard</h2>
      <p className="sub">Quick controls, join info, and live server console.</p>
      {warn ? <p className="warn">{warn}</p> : null}
      {notice ? <p className="ok-text">{notice}</p> : null}

      <div className="grid-2">
        <section className="card">
          <h3>Quick settings</h3>
          {QUICK_DASHBOARD_KEYS.map((key) => {
            const isBool = values[key] === "true" || values[key] === "false";
            const isPw = PASSWORD_KEYS.has(key);
            if (isBool) {
              return (
                <div className="toggle-row" key={key}>
                  <label>{key}</label>
                  <input
                    type="checkbox"
                    checked={values[key] === "true"}
                    onChange={(e) => setVal(key, e.target.checked ? "true" : "false")}
                  />
                </div>
              );
            }
            return (
              <div className="field" key={key}>
                <label>{key}</label>
                <input
                  type={isPw ? "password" : "text"}
                  value={values[key] ?? ""}
                  onChange={(e) => setVal(key, e.target.value)}
                />
              </div>
            );
          })}
          <div className="row">
            <button className="btn primary" onClick={() => void saveQuick()}>
              Save
            </button>
            <button className="btn" onClick={() => void loadIni()}>
              Reload
            </button>
          </div>
        </section>

        <section className="card">
          <h3>Join info</h3>
          <p className="muted">Share these with players on your LAN or internet.</p>
          <div className="field">
            <label>Local</label>
            <div className="row">
              <input readOnly value={`127.0.0.1:${port}`} />
              <button className="btn" onClick={() => void copy(`127.0.0.1:${port}`)}>
                Copy
              </button>
            </div>
          </div>
          <div className="field">
            <label>LAN</label>
            <div className="row">
              <input
                readOnly
                value={join?.lanIp ? `${join.lanIp}:${port}` : "—"}
              />
              <button
                className="btn"
                disabled={!join?.lanIp}
                onClick={() => join?.lanIp && void copy(`${join.lanIp}:${port}`)}
              >
                Copy
              </button>
            </div>
          </div>
          <div className="field">
            <label>Public</label>
            <div className="row">
              <input
                readOnly
                value={join?.publicIp ? `${join.publicIp}:${port}` : "—"}
              />
              <button
                className="btn"
                disabled={!join?.publicIp}
                onClick={() => join?.publicIp && void copy(`${join.publicIp}:${port}`)}
              >
                Copy
              </button>
            </div>
          </div>
          <p className="muted">
            UDP game ports: {status?.defaultPort ?? "16261"} / {status?.udpPort ?? "16262"}. Forward
            both if friends join over the internet.
          </p>
          <button className="btn" onClick={() => void window.pz.joinInfo().then(setJoin)}>
            Refresh IPs
          </button>
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>Console</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Filter lines…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <label className="muted">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />{" "}
            Auto-scroll
          </label>
          <button className="btn" onClick={() => setConsoleText("")}>
            Clear view
          </button>
          <button
            className="btn danger"
            disabled={running}
            title={
              running
                ? "Stop the server first"
                : "Delete Multiplayer world save (keeps INI / Sandbox)"
            }
            onClick={() => void onResetWorld()}
          >
            Reset world save…
          </button>
        </div>
        <div
          className="console"
          onClick={() => cmdRef.current?.focus()}
          role="log"
          aria-label="Server console output"
        >
          {filtered || <span className="muted">No console output yet.</span>}
          <div ref={bottomRef} />
        </div>
        <div className="console-cmd-row">
          <span className="console-prompt" aria-hidden>
            ›
          </span>
          <input
            ref={cmdRef}
            className="console-cmd"
            placeholder={
              canSendCommands
                ? "Type a server command (help, players, setaccesslevel …) and press Enter"
                : running
                  ? "Server running outside this app — Stop + Start here to enable commands"
                  : "Start the server to send console commands"
            }
            value={command}
            disabled={!canSendCommands}
            onChange={(e) => {
              setCommand(e.target.value);
              setHistIdx(-1);
            }}
            onKeyDown={onCmdKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            className="btn primary"
            disabled={!canSendCommands || !command.trim()}
            onClick={() => void sendCommand()}
          >
            Send
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Commands go to the process started by this app. Examples:{" "}
          <code>help</code>, <code>players</code>,{" "}
          <code>setaccesslevel &quot;Name&quot; admin</code>, <code>save</code>, <code>quit</code>.
        </p>
      </section>
    </div>
  );
}
