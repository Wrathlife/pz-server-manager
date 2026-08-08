import { useEffect, useMemo, useState } from "react";
import { INI_GROUPS } from "../../shared/iniGroups";
import { PASSWORD_KEYS } from "../../shared/types";
import { joinIniList, splitIniList } from "../../shared/ini";
import { IdListEditor } from "../components/IdListEditor";

type Props = { onRestart: () => void };

const LIST_KEYS = new Set(["Mods", "WorkshopItems"]);

export function IniSettings({ onRestart }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [path, setPath] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<string, string>>({});

  async function load() {
    setMsg(null);
    const res = await window.pz.readIni();
    if (!res.ok) {
      setErr(res.error);
      setPath("");
      return;
    }
    setErr(null);
    setPath(res.path);
    setValues(res.values);
    setDirty({});
    setMsg(`Reloaded server settings from ${res.path}`);
  }

  useEffect(() => {
    void load();
  }, []);

  const known = useMemo(() => {
    const set = new Set<string>();
    for (const g of INI_GROUPS) for (const k of g.keys) set.add(k);
    return set;
  }, []);

  const miscKeys = useMemo(() => {
    return Object.keys(values)
      .filter((k) => !known.has(k))
      .sort();
  }, [values, known]);

  function match(key: string) {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      key.toLowerCase().includes(needle) ||
      (values[key] ?? "").toLowerCase().includes(needle)
    );
  }

  function edit(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setDirty((prev) => ({ ...prev, [key]: v }));
    setMsg(null);
  }

  async function save(restart: boolean) {
    const res = await window.pz.writeIni(dirty);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setValues(res.values);
    setDirty({});
    setMsg(restart ? "Saved. Restarting…" : "Saved.");
    if (restart) onRestart();
  }

  function renderListField(key: string) {
    if (!match(key)) return null;
    const items = splitIniList(values[key] ?? "");
    const dirtyMark = key in dirty ? " *" : "";
    return (
      <IdListEditor
        key={key}
        label={`${key}${dirtyMark}`}
        items={items}
        embedded
        onChange={(next) => edit(key, joinIniList(next))}
        hint={
          key === "WorkshopItems"
            ? "Steam Workshop IDs. Numbers show load order. Prefer the Mods page for title lookup."
            : "Mod IDs from each mod’s info.txt. Numbers show load order."
        }
      />
    );
  }

  function renderField(key: string) {
    if (LIST_KEYS.has(key)) return renderListField(key);
    if (!match(key)) return null;
    const val = values[key] ?? "";
    const isBool =
      val === "true" ||
      val === "false" ||
      key === "Public" ||
      key === "Open" ||
      key === "UPnP" ||
      key === "PVP" ||
      key === "PauseEmpty" ||
      key === "GlobalChat";
    const boolish = val === "true" || val === "false";
    if (boolish || (isBool && (val === "" || boolish))) {
      return (
        <div className="toggle-row" key={key}>
          <label>
            {key}
            {key in dirty ? " *" : ""}
          </label>
          <input
            type="checkbox"
            checked={val === "true"}
            onChange={(e) => edit(key, e.target.checked ? "true" : "false")}
          />
        </div>
      );
    }
    const multiline =
      val.length > 80 || key.includes("Message") || key.includes("Description");
    return (
      <div className="field" key={key}>
        <label>
          {key}
          {key in dirty ? " *" : ""}
        </label>
        {multiline ? (
          <textarea value={val} onChange={(e) => edit(key, e.target.value)} rows={3} />
        ) : (
          <input
            type={PASSWORD_KEYS.has(key) ? "password" : "text"}
            value={val}
            onChange={(e) => edit(key, e.target.value)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Server settings (INI)</h2>
      <p className="sub">
        {path || "Loading…"} — comments are preserved on save. Mods and WorkshopItems use ordered
        lists (↑/↓).
      </p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}

      <div className="row sticky-actions" style={{ marginBottom: 12 }}>
        <input
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search keys or values…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" onClick={() => void load()}>
          Reload
        </button>
        <button
          className="btn primary"
          disabled={!Object.keys(dirty).length}
          onClick={() => void save(false)}
        >
          Save
        </button>
        <button
          className="btn"
          disabled={!Object.keys(dirty).length}
          onClick={() => void save(true)}
        >
          Save & Restart
        </button>
      </div>

      {INI_GROUPS.map((g) => {
        const keys = g.id === "misc" ? [...g.keys, ...miscKeys] : g.keys;
        const visible = keys.filter((k) => values[k] !== undefined || g.keys.includes(k));
        const any = visible.some((k) => match(k));
        if (!any) return null;
        return (
          <section className="card group" key={g.id}>
            <h3>{g.label}</h3>
            {visible.map((k) => renderField(k))}
          </section>
        );
      })}
    </div>
  );
}
