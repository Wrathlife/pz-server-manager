import { useEffect, useState } from "react";
import { IdListEditor, type WorkshopMeta } from "../components/IdListEditor";

type Props = { onRestart: () => void };

export function ModsPage({ onRestart }: Props) {
  const [mods, setMods] = useState<string[]>([]);
  const [workshop, setWorkshop] = useState<string[]>([]);
  const [path, setPath] = useState("");
  const [titles, setTitles] = useState<Record<string, WorkshopMeta>>({});
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadTitles(ids: string[], force = false, announce = false) {
    if (!ids.length) {
      setTitles({});
      return;
    }
    const cached = await window.pz.workshopCache(ids);
    setTitles(cached);
    const need = ids.filter((id) => !cached[id]?.title || force);
    if (!need.length && !force) return;
    setResolving(true);
    try {
      const resolved = await window.pz.workshopResolve({ ids, force });
      setTitles(resolved);
      if (announce) {
        const failed = Object.values(resolved).filter((t) => !t.title).length;
        if (failed) {
          setMsg(`Resolved titles (${ids.length - failed}/${ids.length}). Some failed.`);
        } else {
          setMsg(`Resolved ${ids.length} Workshop title(s) from Steam.`);
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  }

  async function load() {
    setMsg(null);
    const res = await window.pz.getMods();
    if (!res.ok) {
      setErr(res.error || "Failed to load mods from server INI");
      setPath(res.path || "");
      setMods([]);
      setWorkshop([]);
      setDirty(false);
      return;
    }
    setErr(null);
    setPath(res.path);
    setMods(res.mods);
    setWorkshop(res.workshop);
    setDirty(false);
    setMsg(
      `Loaded ${res.mods.length} mod id(s) and ${res.workshop.length} Workshop item(s) from server INI.`
    );
    void loadTitles(res.workshop);
  }

  useEffect(() => {
    void load();
  }, []);

  function changeMods(next: string[]) {
    setMods(next);
    setDirty(true);
    setMsg(null);
  }

  function changeWorkshop(next: string[]) {
    setWorkshop(next);
    setDirty(true);
    setMsg(null);
    void loadTitles(next);
  }

  async function save(restart: boolean) {
    setSaving(true);
    setMsg(null);
    const res = await window.pz.setMods({ mods, workshop });
    setSaving(false);
    if (!res.ok) {
      setErr(res.error || "Save failed");
      return;
    }
    setErr(null);
    setDirty(false);
    setMsg(restart ? "Mods saved. Restarting…" : "Mods saved to server INI.");
    void loadTitles(workshop);
    if (restart) onRestart();
  }

  return (
    <div className="page">
      <h2>Mods</h2>
      <p className="sub">
        {path || "Loading…"} — edits <code>Mods</code> and <code>WorkshopItems</code> in the server
        INI. Numbers are load order. Workshop downloads still happen via Steam.
      </p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}

      <div className="row sticky-actions" style={{ marginBottom: 12 }}>
        <button className="btn" disabled={saving} onClick={() => void load()}>
          Reload
        </button>
        <button
          className="btn primary"
          disabled={saving || !dirty}
          onClick={() => void save(false)}
        >
          Save
        </button>
        <button
          className="btn"
          disabled={saving || !dirty}
          onClick={() => void save(true)}
        >
          Save & Restart
        </button>
        <button
          className="btn"
          disabled={resolving || !workshop.length}
          onClick={() => void loadTitles(workshop, true, true)}
        >
          {resolving ? "Resolving…" : "Resolve names"}
        </button>
        <button
          className="btn"
          onClick={() =>
            void window.pz.openExternal("https://steamcommunity.com/app/108600/workshop/")
          }
        >
          Open Workshop
        </button>
        {dirty ? <span className="muted">Unsaved changes</span> : null}
      </div>

      <IdListEditor
        label="Mods (mod IDs)"
        items={mods}
        onChange={changeMods}
        hint="From each mod’s info.txt Mod ID field. Order matches load order."
      />
      <IdListEditor
        label="WorkshopItems (Steam Workshop IDs)"
        items={workshop}
        onChange={changeWorkshop}
        titles={titles}
        hint="Numeric IDs from the Steam Workshop URL. Numbers show load order."
      />
    </div>
  );
}
