import { useEffect, useMemo, useState } from "react";

type SandboxField = {
  path: string;
  section: string;
  key: string;
  value: string;
  label: string | null;
  kind: "bool" | "number" | "string" | "other";
};

type SandboxSection = {
  id: string;
  label: string;
  isMod: boolean;
  fields: SandboxField[];
};

export function SandboxPage() {
  const [path, setPath] = useState("");
  const [sections, setSections] = useState<SandboxSection[]>([]);
  const [raw, setRaw] = useState("");
  const [mode, setMode] = useState<"sections" | "raw">("sections");
  const [activeSection, setActiveSection] = useState<string>("");
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await window.pz.readSandbox();
    setPath(res.path);
    setSections(res.sections ?? []);
    setRaw(res.raw);
    setDirty({});
    if (!res.exists) setErr(`File not found: ${res.path}`);
    else setErr(null);
    // Prefer first mod section if present, else general
    const mods = (res.sections ?? []).filter((s) => s.isMod);
    if (mods.length) setActiveSection(mods[0].id);
    else if (res.sections?.length) setActiveSection(res.sections[0].id);
  }

  useEffect(() => {
    void load();
  }, []);

  const current = useMemo(
    () => sections.find((s) => s.id === activeSection) ?? sections[0],
    [sections, activeSection]
  );

  const visibleFields = useMemo(() => {
    if (!current) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return current.fields;
    return current.fields.filter((f) => {
      const hay = `${f.key} ${f.label ?? ""} ${f.path} ${f.value}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [current, q]);

  function valueOf(field: SandboxField) {
    return dirty[field.path] ?? field.value;
  }

  function edit(pathKey: string, value: string) {
    setDirty((d) => ({ ...d, [pathKey]: value }));
    setSections((secs) =>
      secs.map((s) => ({
        ...s,
        fields: s.fields.map((f) =>
          f.path === pathKey ? { ...f, value } : f
        )
      }))
    );
  }

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
    const res = await window.pz.writeSandbox({ mode: "flat", flat: dirty });
    if (!res.ok) setErr(res.error);
    else {
      setMsg("Saved (previous file backed up as .bak). Restart server to apply.");
      await load();
    }
  }

  const modSections = sections.filter((s) => s.isMod);
  const vanillaSections = sections.filter((s) => !s.isMod);

  return (
    <div className="page">
      <h2>Sandbox</h2>
      <p className="sub">
        {path || "…"} — includes mod pages like Hot Brass / W900 (same data as in-game Edit
        Settings → Sandbox).
      </p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}

      <div className="row" style={{ marginBottom: 12 }}>
        <button
          className={`btn ${mode === "sections" ? "primary" : ""}`}
          onClick={() => setMode("sections")}
        >
          Sections
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
        <button
          className="btn primary"
          disabled={mode === "sections" && !Object.keys(dirty).length}
          onClick={() => void save()}
        >
          Save
        </button>
        {Object.keys(dirty).length ? (
          <span className="muted">{Object.keys(dirty).length} unsaved</span>
        ) : null}
      </div>

      {mode === "sections" ? (
        <div className="sandbox-layout">
          <aside className="sandbox-nav card">
            <h3>Vanilla</h3>
            {vanillaSections.map((s) => (
              <button
                key={s.id || "root"}
                className={`nav-btn ${activeSection === s.id ? "active" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
                <span className="muted"> {s.fields.length}</span>
              </button>
            ))}
            <h3 style={{ marginTop: 12 }}>Mods</h3>
            {modSections.length ? (
              modSections.map((s) => (
                <button
                  key={s.id}
                  className={`nav-btn ${activeSection === s.id ? "active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.label}
                  <span className="muted"> {s.fields.length}</span>
                </button>
              ))
            ) : (
              <p className="muted">
                No mod Sandbox tables in this file yet. Save options from the game’s Edit Settings
                screen once, then Reload.
              </p>
            )}
          </aside>

          <section className="card sandbox-panel">
            <div className="row" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, flex: 1 }}>
                {current?.label ?? "—"}
                {current?.isMod ? <span className="mod-badge">Mod</span> : null}
              </h3>
              <input
                style={{ minWidth: 180, flex: 1, maxWidth: 320 }}
                placeholder="Filter options…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {visibleFields.map((f) => {
              const val = valueOf(f);
              const dirtyMark = f.path in dirty ? " *" : "";
              if (f.kind === "bool") {
                return (
                  <div className="toggle-row" key={f.path}>
                    <label>
                      <div>{f.label || f.key}{dirtyMark}</div>
                      {f.label ? <div className="muted">{f.key}</div> : null}
                    </label>
                    <input
                      type="checkbox"
                      checked={val === "true"}
                      onChange={(e) => edit(f.path, e.target.checked ? "true" : "false")}
                    />
                  </div>
                );
              }
              return (
                <div className="field" key={f.path}>
                  <label>
                    {f.label || f.key}
                    {dirtyMark}
                    {f.label ? <span className="muted"> — {f.key}</span> : null}
                  </label>
                  <input
                    type={f.kind === "number" ? "number" : "text"}
                    step="any"
                    value={val}
                    onChange={(e) => edit(f.path, e.target.value)}
                  />
                </div>
              );
            })}
            {!visibleFields.length ? <p className="muted">No options in this section.</p> : null}
          </section>
        </div>
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
