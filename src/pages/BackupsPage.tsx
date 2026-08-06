import { useEffect, useState } from "react";
import type { BackupEntry } from "../../shared/types";

export function BackupsPage() {
  const [list, setList] = useState<BackupEntry[]>([]);
  const [includeWorld, setIncludeWorld] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setList(await window.pz.listBackups());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function create() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await window.pz.createBackup({ includeWorld, includeLogs });
    setBusy(false);
    if (!res.ok) setErr(res.error || "Backup failed");
    else {
      setMsg(`Created ${res.path}`);
      await refresh();
    }
  }

  async function restore(path: string) {
    setBusy(true);
    setErr(null);
    const res = await window.pz.restoreBackup(path);
    setBusy(false);
    if (!res.ok) setErr(res.error || "Restore failed");
    else setMsg("Restore complete. Restart the server to apply.");
  }

  function fmtSize(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="page">
      <h2>Backups</h2>
      <p className="sub">Zip server config and optional world/logs into your backup folder.</p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}

      <section className="card" style={{ marginBottom: 14 }}>
        <h3>Create backup</h3>
        <label className="toggle-row">
          <span>Include world save</span>
          <input
            type="checkbox"
            checked={includeWorld}
            onChange={(e) => setIncludeWorld(e.target.checked)}
          />
        </label>
        <label className="toggle-row">
          <span>Include logs</span>
          <input
            type="checkbox"
            checked={includeLogs}
            onChange={(e) => setIncludeLogs(e.target.checked)}
          />
        </label>
        <button className="btn primary" disabled={busy} onClick={() => void create()}>
          Create backup
        </button>
      </section>

      <section className="card">
        <h3>Recent backups</h3>
        <button className="btn" style={{ marginBottom: 10 }} onClick={() => void refresh()}>
          Refresh
        </button>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Size</th>
              <th>Modified</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.path}>
                <td>{b.name}</td>
                <td>{fmtSize(b.size)}</td>
                <td>{new Date(b.mtimeMs).toLocaleString()}</td>
                <td className="row">
                  <button className="btn" onClick={() => void window.pz.showItem(b.path)}>
                    Show
                  </button>
                  <button
                    className="btn danger"
                    disabled={busy}
                    onClick={() => void restore(b.path)}
                  >
                    Restore
                  </button>
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={4} className="muted">
                  No backups yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
