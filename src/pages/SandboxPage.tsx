import { useEffect, useMemo, useState } from "react";
import { alignSandboxModSections } from "../../shared/sandboxAlign";

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

function fieldMatches(f: SandboxField, needle: string): boolean {
  if (!needle) return true;
  return `${f.key} ${f.label ?? ""} ${f.path} ${f.value}`.toLowerCase().includes(needle);
}

function sectionMatches(s: SandboxSection, needle: string): boolean {
  if (!needle) return true;
  if (s.label.toLowerCase().includes(needle) || s.id.toLowerCase().includes(needle)) {
    return true;
  }
  return s.fields.some((f) => fieldMatches(f, needle));
}

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
  const [iniMods, setIniMods] = useState<string[]>([]);
  const [alignToIni, setAlignToIni] = useState(true);

  async function load() {
    const res = await window.pz.readSandbox();
    setPath(res.path);
    setSections(res.sections ?? []);
    setRaw(res.raw);
    setDirty({});
    if (!res.exists) setErr(`File not found: ${res.path}`);
    else setErr(null);
    const ini = await window.pz.getMods();
    const loadedIni = ini.ok ? ini.mods : [];
    setIniMods(loadedIni);
    const mods = (res.sections ?? []).filter((s) => s.isMod);
    const aligned = alignToIni
      ? alignSandboxModSections(mods, loadedIni).aligned
      : mods;
    if (aligned.length) setActiveSection(aligned[0].id);
    else if (mods.length) setActiveSection(mods[0].id);
    else if (res.sections?.length) setActiveSection(res.sections[0].id);
  }

  useEffect(() => {
    void load();
  }, []);

  const needle = q.trim().toLowerCase();

  const groupedMods = useMemo(() => {
    const all = sections.filter((s) => s.isMod);
    if (!alignToIni) {
      return {
        aligned: all.filter((s) => sectionMatches(s, needle)),
        orphans: [] as SandboxSection[],
        missing: [] as string[]
      };
    }
    const { aligned, orphans, missing } = alignSandboxModSections(all, iniMods);
    return {
      aligned: aligned.filter((s) => sectionMatches(s, needle)),
      orphans: orphans.filter((s) => sectionMatches(s, needle)),
      missing: needle
        ? missing.filter((id) => id.toLowerCase().includes(needle))
        : missing
    };
  }, [sections, iniMods, alignToIni, needle]);

  const nav = useMemo(() => {
    const vanilla = sections.filter((s) => !s.isMod && sectionMatches(s, needle));
    return { vanilla, mods: groupedMods.aligned };
  }, [sections, needle, groupedMods]);

  useEffect(() => {
    if (!needle) return;
    const visible = [...nav.vanilla, ...nav.mods, ...groupedMods.orphans];
    if (!visible.length) return;
    if (!visible.some((s) => s.id === activeSection)) {
      setActiveSection(visible[0].id);
    }
  }, [needle, nav, activeSection]);

  const current = useMemo(
    () => sections.find((s) => s.id === activeSection) ?? sections[0],
    [sections, activeSection]
  );

  const visibleFields = useMemo(() => {
    if (!current) return [];
    if (!needle) return current.fields;
    const hits = current.fields.filter((f) => fieldMatches(f, needle));
    if (hits.length) return hits;
    if (sectionMatches(current, needle)) return current.fields;
    return [];
  }, [current, needle]);

  function matchCount(s: SandboxSection): number {
    if (!needle) return s.fields.length;
    const hits = s.fields.filter((f) => fieldMatches(f, needle)).length;
    if (hits) return hits;
    return sectionMatches(s, needle) ? s.fields.length : 0;
  }

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

  const noSearchHits = Boolean(needle) && !nav.vanilla.length && !nav.mods.length;

  return (
    <div className="page">
      <h2>Sandbox</h2>
      <p className="sub">
        {path || "…"} — includes mod pages like Hot Brass / W900 (same data as in-game Edit
        Settings → Sandbox). Mod pages follow <code>Mods=</code> in the server INI when alignment
        is on.
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
        <label className="preview-keep" style={{ marginLeft: "auto" }}>
          <input
            type="checkbox"
            checked={alignToIni}
            onChange={(e) => setAlignToIni(e.target.checked)}
          />
          Align to server INI
        </label>
      </div>

      {mode === "sections" ? (
        <div className="sandbox-layout">
          <aside className="sandbox-nav card">
            <input
              className="sandbox-search"
              placeholder="Search sandbox…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <h3>Vanilla</h3>
            {nav.vanilla.map((s) => (
              <button
                key={s.id || "root"}
                className={`nav-btn ${activeSection === s.id ? "active" : ""}`}
                onClick={() => setActiveSection(s.id)}
              >
                {s.label}
                <span className="muted">
                  {" "}
                  {needle ? `${matchCount(s)}/${s.fields.length}` : s.fields.length}
                </span>
              </button>
            ))}
            {!nav.vanilla.length ? (
              <p className="muted">{needle ? "No matching vanilla pages." : "None."}</p>
            ) : null}
            <h3 style={{ marginTop: 12 }}>Mods</h3>
            {alignToIni && !iniMods.length ? (
              <p className="warn">
                servertest.ini has an empty <code>Mods=</code> list. Save mods on the Mods page,
                then Reload here. Showing every table in SandboxVars.lua.
              </p>
            ) : null}
            {nav.mods.length ? (
              nav.mods.map((s) => (
                <button
                  key={s.id}
                  className={`nav-btn ${activeSection === s.id ? "active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.label}
                  <span className="muted">
                    {" "}
                    {needle ? `${matchCount(s)}/${s.fields.length}` : s.fields.length}
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">
                {needle
                  ? "No matching mod pages."
                  : "No mod Sandbox tables in this file yet. Save options from the game’s Edit Settings screen once, then Reload."}
              </p>
            )}
            {alignToIni && groupedMods.missing.length ? (
              <>
                <h3 style={{ marginTop: 12 }}>In INI, no sandbox table</h3>
                {groupedMods.missing.map((id) => (
                  <p className="muted" key={id} style={{ margin: "4px 0" }}>
                    {id}
                  </p>
                ))}
              </>
            ) : null}
            {alignToIni && groupedMods.orphans.length ? (
              <>
                <h3 style={{ marginTop: 12 }}>Not in server INI</h3>
                {groupedMods.orphans.map((s) => (
                  <button
                    key={s.id}
                    className={`nav-btn ${activeSection === s.id ? "active" : ""}`}
                    onClick={() => setActiveSection(s.id)}
                  >
                    {s.label}
                    <span className="muted"> {s.fields.length}</span>
                  </button>
                ))}
              </>
            ) : null}
          </aside>

          <section className="card sandbox-panel">
            <div className="row" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0, flex: 1 }}>
                {current?.label ?? "—"}
                {current?.isMod ? <span className="mod-badge">Mod</span> : null}
              </h3>
            </div>

            {noSearchHits ? (
              <p className="muted">No matches for “{q.trim()}” across vanilla and mods.</p>
            ) : (
              <>
                {visibleFields.map((f) => {
                  const val = valueOf(f);
                  const dirtyMark = f.path in dirty ? " *" : "";
                  if (f.kind === "bool") {
                    return (
                      <div className="toggle-row" key={f.path}>
                        <label>
                          <div>
                            {f.label || f.key}
                            {dirtyMark}
                          </div>
                          {f.label ? <div className="muted">{f.key}</div> : null}
                        </label>
                        <input
                          type="checkbox"
                          checked={val === "true"}
                          onChange={(e) =>
                            edit(f.path, e.target.checked ? "true" : "false")
                          }
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
                {!visibleFields.length ? (
                  <p className="muted">No options in this section.</p>
                ) : null}
              </>
            )}
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
