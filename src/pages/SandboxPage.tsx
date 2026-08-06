import { useEffect, useMemo, useState } from "react";

export function SandboxPage() {
  const [path, setPath] = useState("");
  const [flat, setFlat] = useState<Record<string, string>>({});
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<"flat" | "raw">("flat");
  const [q, setQ] = useState("");
  const [dirtyFlat, setDirtyFlat] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await window.pz.readSandbox();
    setPath(res.path);
    setFlat(res.flat);
    setRaw(res.raw);
    setDirtyFlat({});
    if (!res.exists) setErr(`File not found: ${res.path}`);
    else setErr(null);
  }

  useEffect(() => {
    void load();
  }, []);

  const keys = useMemo(() => {
    return Object.keys(flat)
      .filter((k) => {
        if (!q.trim()) return true;
        const n = q.toLowerCase();
        return k.toLowerCase().includes(n) || (flat[k] ?? "").toLowerCase().includes(n);
      })
      .sort();
  }, [flat, q]);

  async function save() {
    setMsg(null);
    if (mode === "raw") {
      const res = await window.pz.writeSandbox({ mode: "raw", raw });
      if (!res.ok) setErr(res.error);
      else {
        setMsg("Saved (previous file backed up as .bak).");
        await load();
      }
      return;
    }
    const res = await window.pz.writeSandbox({ mode: "flat", flat: dirtyFlat });
    if (!res.ok) setErr(res.error);
    else {
      setMsg("Saved (previous file backed up as .bak).");
      await load();
    }
  }

  return (
    <div className="page">
      <h2>Sandbox</h2>
      <p className="sub">{path || "…"}</p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}

      <div className="row" style={{ marginBottom: 12 }}>
        <button
          className={`btn ${mode === "flat" ? "primary" : ""}`}
          onClick={() => setMode("flat")}
        >
          Structured
        </button>
        <button
          className={`btn ${mode === "raw" ? "primary" : ""}`}
          onClick={() => setMode("raw")}
        >
          Raw Lua
        </button>
        <button className="btn" onClick={() => void load()}>
          Reload
        </button>
        <button className="btn primary" onClick={() => void save()}>
          Save
        </button>
      </div>

      {mode === "flat" ? (
        <>
          <input
            style={{ width: "100%", marginBottom: 12 }}
            placeholder="Search sandbox vars…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <section className="card">
            {keys.map((k) => (
              <div className="field" key={k}>
                <label>
                  {k}
                  {k in dirtyFlat ? " *" : ""}
                </label>
                <input
                  value={dirtyFlat[k] ?? flat[k] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFlat((p) => ({ ...p, [k]: v }));
                    setDirtyFlat((p) => ({ ...p, [k]: v }));
                  }}
                />
              </div>
            ))}
            {!keys.length ? <p className="muted">No matching keys.</p> : null}
          </section>
        </>
      ) : (
        <div className="field">
          <label>Raw SandboxVars.lua</label>
          <textarea
            style={{ minHeight: 480 }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
