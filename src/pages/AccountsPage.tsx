import { useEffect, useMemo, useState } from "react";

type AccountRow = {
  id: number;
  username: string;
  role: string | null;
  roleId?: number | null;
  steamid: string | null;
  lastConnection: string | null;
  displayName: string | null;
  hasPassword: boolean;
  world: string | null;
};

type Props = {
  running: boolean;
};

export function AccountsPage({ running }: Props) {
  const [path, setPath] = useState("");
  const [exists, setExists] = useState(false);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [newPwUser, setNewPwUser] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    const res = await window.pz.listAccounts();
    setPath(res.path);
    setExists(res.exists);
    setAccounts(res.accounts ?? []);
    if (!res.ok) setErr(res.error || "Failed to read accounts DB");
  }

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((a) => {
      const hay = `${a.username} ${a.role ?? ""} ${a.steamid ?? ""} ${a.displayName ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [accounts, q]);

  const selectedNames = useMemo(
    () => Object.keys(selected).filter((k) => selected[k]),
    [selected]
  );

  function toggle(name: string) {
    setSelected((s) => ({ ...s, [name]: !s[name] }));
  }

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    if (on) for (const a of visible) next[a.username] = true;
    setSelected(next);
  }

  async function onReset(username: string, withPassword?: string) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await window.pz.resetAccountPassword({
      username,
      newPassword: withPassword
    });
    setBusy(false);
    setNewPwUser(null);
    setNewPw("");
    if (!res.ok) {
      if (res.error !== "Cancelled") setErr(res.error || "Reset failed");
      return;
    }
    setMsg(
      res.method === "console:setpassword"
        ? `Password set for ${username} via console.`
        : res.method === "console:removeuserfromwhitelist"
          ? `${username} removed from whitelist — they can set a new password on join.`
          : `Password cleared for ${username}${res.backup ? ` (backup: ${res.backup})` : ""}.`
    );
    await load();
  }

  async function onWipe(username: string) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await window.pz.wipeAccount(username);
    setBusy(false);
    if (!res.ok) {
      if (res.error !== "Cancelled") setErr(res.error || "Wipe failed");
      return;
    }
    setMsg(`Wiped account ${username}.`);
    setSelected((s) => {
      const n = { ...s };
      delete n[username];
      return n;
    });
    await load();
  }

  async function onClearSelected() {
    if (!selectedNames.length) return;
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await window.pz.clearAccountPasswords(selectedNames);
    setBusy(false);
    if (!res.ok) {
      if (res.error !== "Cancelled") setErr(res.error || "Clear failed");
      return;
    }
    setMsg(`Cleared ${res.cleared ?? 0} password(s).`);
    await load();
  }

  async function onWipeAll(keepAdmin: boolean) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await window.pz.wipeAllAccounts({ keepAdmin });
    setBusy(false);
    if (!res.ok) {
      if (res.error !== "Cancelled") setErr(res.error || "Wipe-all failed");
      return;
    }
    setMsg(`Deleted ${res.deleted ?? 0} account(s).`);
    setSelected({});
    await load();
  }

  return (
    <div className="page">
      <h2>Accounts</h2>
      <p className="sub">
        Whitelist logins in {path || "…"} — reset passwords, wipe users, or wipe all. Separate from the
        shared server <code>Password=</code> in Settings (INI).
      </p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}
      {!exists ? (
        <p className="warn">No accounts database yet — start the server once to create it.</p>
      ) : null}

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          style={{ flex: 1, minWidth: 160 }}
          placeholder="Filter accounts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" disabled={busy} onClick={() => void load()}>
          Reload
        </button>
        <button
          className="btn"
          disabled={busy || running || !selectedNames.length}
          title={running ? "Stop the server to clear DB password hashes" : undefined}
          onClick={() => void onClearSelected()}
        >
          Clear passwords ({selectedNames.length})
        </button>
        <button
          className="btn danger"
          disabled={busy || running}
          title={running ? "Stop the server first" : undefined}
          onClick={() => void onWipeAll(true)}
        >
          Wipe all except admin…
        </button>
        <button
          className="btn danger"
          disabled={busy || running}
          onClick={() => void onWipeAll(false)}
        >
          Wipe all…
        </button>
      </div>

      <p className="muted" style={{ marginTop: 0 }}>
        {running
          ? "Server running: Reset with a new password uses console setpassword; Reset without a password removes them from the whitelist."
          : "Server stopped: Reset clears the password hash; Wipe deletes the whitelist row. A .db backup is created first."}
      </p>

      <section className="card" style={{ overflowX: "auto" }}>
        <table className="accounts-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={!!visible.length && visible.every((a) => selected[a.username])}
                  onChange={(e) => toggleAll(e.target.checked)}
                  aria-label="Select all"
                />
              </th>
              <th>Username</th>
              <th>Role</th>
              <th>Password</th>
              <th>Steam ID</th>
              <th>Last connection</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!selected[a.username]}
                    onChange={() => toggle(a.username)}
                  />
                </td>
                <td>
                  <strong>{a.username}</strong>
                  {a.displayName && a.displayName !== a.username ? (
                    <div className="muted">{a.displayName}</div>
                  ) : null}
                </td>
                <td>{a.role || "—"}</td>
                <td>{a.hasPassword ? "Set" : "Empty"}</td>
                <td className="mono-cell">{a.steamid || "—"}</td>
                <td>{a.lastConnection || "—"}</td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {newPwUser === a.username ? (
                      <>
                        <input
                          type="password"
                          placeholder="New password"
                          value={newPw}
                          style={{ width: 140 }}
                          onChange={(e) => setNewPw(e.target.value)}
                          disabled={!running}
                          title={
                            running
                              ? undefined
                              : "Setting a new password requires the server running"
                          }
                        />
                        <button
                          className="btn primary"
                          disabled={busy || !running || !newPw}
                          onClick={() => void onReset(a.username, newPw)}
                        >
                          Set
                        </button>
                        <button className="btn" disabled={busy} onClick={() => setNewPwUser(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={() => {
                            if (running) {
                              setNewPwUser(a.username);
                              setNewPw("");
                            } else {
                              void onReset(a.username);
                            }
                          }}
                        >
                          {running ? "Set password…" : "Clear password…"}
                        </button>
                        {running ? (
                          <button
                            className="btn"
                            disabled={busy}
                            title="Remove from whitelist so they pick a new password on join"
                            onClick={() => void onReset(a.username)}
                          >
                            Force re-register…
                          </button>
                        ) : null}
                        <button
                          className="btn danger"
                          disabled={busy}
                          onClick={() => void onWipe(a.username)}
                        >
                          Wipe…
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={7} className="muted">
                  No accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
