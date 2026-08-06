import { useEffect, useState } from "react";
import type { AppSettings, PathCheck } from "../../shared/types";

type Props = {
  settings: AppSettings;
  onChange: (next: AppSettings) => Promise<void>;
};

export function AppSettingsPage({ settings, onChange }: Props) {
  const [draft, setDraft] = useState(settings);
  const [checks, setChecks] = useState<PathCheck | null>(null);
  const [resolved, setResolved] = useState<Record<string, string> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setDraft(settings), [settings]);

  async function refreshChecks() {
    setChecks(await window.pz.checkPaths());
    setResolved(await window.pz.resolvedPaths());
  }

  useEffect(() => {
    void refreshChecks();
  }, [settings]);

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function browseDir(key: keyof AppSettings) {
    const p = await window.pz.pickDirectory();
    if (p) set(key, p as never);
  }

  async function browseFile(key: "startScript") {
    const p = await window.pz.pickFile([
      { name: "Batch / executable", extensions: ["bat", "cmd", "exe"] }
    ]);
    if (p) set(key, p);
  }

  async function save() {
    await onChange(draft);
    setMsg("Settings saved.");
    await refreshChecks();
  }

  async function detect() {
    const next = await window.pz.detectPaths();
    setDraft(next);
    setMsg("Detected Steam dedicated server paths (saved).");
    await refreshChecks();
  }

  async function resetDefaults() {
    const d = await window.pz.defaultSettings();
    setDraft(d);
  }

  const mark = (ok: boolean | undefined) =>
    ok === undefined ? "" : ok ? (
      <span className="path-ok">OK</span>
    ) : (
      <span className="path-bad">Missing</span>
    );

  return (
    <div className="page">
      <h2>App settings</h2>
      <p className="sub">
        All paths are editable — they persist under %APPDATA%\pz-server-manager\settings.json
      </p>
      {msg ? <p className="ok-text">{msg}</p> : null}

      <section className="card">
        <h3>Paths</h3>
        {(
          [
            ["installDir", "Dedicated server install", true],
            ["startScript", "Start script", false],
            ["zomboidDir", "Zomboid user data", true],
            ["backupDir", "Backup folder", true]
          ] as const
        ).map(([key, label, isDir]) => (
          <div className="field" key={key}>
            <label>
              {label}{" "}
              {key === "installDir"
                ? mark(checks?.installDir)
                : key === "startScript"
                  ? mark(checks?.startScript)
                  : key === "zomboidDir"
                    ? mark(checks?.zomboidDir)
                    : mark(checks?.backupDir)}
            </label>
            <div className="row">
              <input
                style={{ flex: 1 }}
                value={String(draft[key])}
                onChange={(e) => set(key, e.target.value as never)}
              />
              <button
                className="btn"
                onClick={() => void (isDir ? browseDir(key) : browseFile("startScript"))}
              >
                Browse
              </button>
            </div>
          </div>
        ))}

        <div className="field">
          <label>
            Server profile name {mark(checks?.serverIni)}
          </label>
          <input
            value={draft.serverName}
            onChange={(e) => set("serverName", e.target.value)}
            placeholder="servertest"
          />
          <p className="muted">
            Resolves to Server\{`{name}`}.ini and Saves\Multiplayer\{`{name}`}
          </p>
        </div>

        <div className="field">
          <label>Console font size</label>
          <input
            type="number"
            min={10}
            max={22}
            value={draft.consoleFontSize}
            onChange={(e) => set("consoleFontSize", Number(e.target.value) || 12)}
          />
        </div>

        <div className="row">
          <button className="btn primary" onClick={() => void save()}>
            Save
          </button>
          <button className="btn" onClick={() => void detect()}>
            Detect Steam paths
          </button>
          <button className="btn" onClick={() => void resetDefaults()}>
            Reset defaults
          </button>
          <button
            className="btn"
            onClick={() => void window.pz.openPath(draft.installDir)}
          >
            Open install
          </button>
          <button
            className="btn"
            onClick={() => void window.pz.openPath(draft.zomboidDir)}
          >
            Open Zomboid folder
          </button>
        </div>
      </section>

      {resolved ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h3>Resolved paths</h3>
          <ul className="muted">
            {Object.entries(resolved).map(([k, v]) => (
              <li key={k}>
                <strong>{k}</strong>: {v}{" "}
                {k === "serverIni"
                  ? mark(checks?.serverIni)
                  : k === "sandboxLua"
                    ? mark(checks?.sandboxLua)
                    : k === "worldDir"
                      ? mark(checks?.worldDir)
                      : k === "consoleLog"
                        ? mark(checks?.consoleLog)
                        : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
