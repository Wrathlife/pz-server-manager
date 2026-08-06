import { useEffect, useState } from "react";

type WorkshopMeta = {
  id: string;
  title: string | null;
  error?: string;
  fetchedAt: number;
};

function IdListEditor({
  label,
  items,
  onChange,
  hint,
  titles
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  titles?: Record<string, WorkshopMeta>;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const parts = draft
      .split(/[;\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const set = new Set(items);
    for (const p of parts) set.add(p);
    onChange([...set]);
    setDraft("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <section className="card" style={{ marginBottom: 14 }}>
      <h3>{label}</h3>
      {hint ? <p className="muted">{hint}</p> : null}

      <ol className="mod-list">
        {items.map((id, i) => {
          const meta = titles?.[id];
          const title = meta?.title;
          return (
            <li className="mod-row" key={`${id}-${i}`} title={meta?.error || title || id}>
              <span className="mod-num">{i + 1}</span>
              <div className="mod-main">
                {title ? <div className="mod-title">{title}</div> : null}
                <div className={`mod-id ${title ? "" : "mod-id-solo"}`}>{id}</div>
              </div>
              <div className="mod-actions">
                {titles ? (
                  <button
                    type="button"
                    className="btn icon"
                    title="Open on Steam Workshop"
                    onClick={() =>
                      void window.pz.openExternal(
                        `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`
                      )
                    }
                  >
                    ↗
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn icon"
                  title="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn icon"
                  title="Move down"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn icon danger"
                  title="Remove"
                  onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
        {!items.length ? (
          <li className="muted" style={{ listStyle: "none", padding: "8px 0" }}>
            No entries yet.
          </li>
        ) : null}
      </ol>

      <div className="row">
        <input
          style={{ flex: 1 }}
          placeholder="Add id(s)…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button className="btn" onClick={add}>
          Add
        </button>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        Raw: {items.join(";") || "—"}
      </p>
    </section>
  );
}

export function ModsPage() {
  const [mods, setMods] = useState<string[]>([]);
  const [workshop, setWorkshop] = useState<string[]>([]);
  const [titles, setTitles] = useState<Record<string, WorkshopMeta>>({});
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function loadTitles(ids: string[], force = false) {
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
      const failed = Object.values(resolved).filter((t) => !t.title).length;
      if (failed) {
        setMsg(`Resolved titles (${ids.length - failed}/${ids.length}). Some failed.`);
      } else {
        setMsg(`Resolved ${ids.length} Workshop title(s) from Steam.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setResolving(false);
    }
  }

  async function load() {
    const res = await window.pz.getMods();
    setMods(res.mods);
    setWorkshop(res.workshop);
    void loadTitles(res.workshop);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    const res = await window.pz.setMods({ mods, workshop });
    if (!res.ok) setErr(res.error || "Save failed");
    else {
      setErr(null);
      setMsg("Mods saved to server INI.");
      void loadTitles(workshop);
    }
  }

  return (
    <div className="page">
      <h2>Mods</h2>
      <p className="sub">
        Edits <code>Mods</code> and <code>WorkshopItems</code> in the server INI. Workshop downloads
        are still done via Steam — this only configures IDs. Titles are fetched from Steam’s public
        Workshop API and cached locally.
      </p>
      {err ? <p className="err">{err}</p> : null}
      {msg ? <p className="ok-text">{msg}</p> : null}

      <IdListEditor
        label="Mods (mod IDs)"
        items={mods}
        onChange={setMods}
        hint="From each mod’s info.txt Mod ID field. Order matches load order."
      />
      <IdListEditor
        label="WorkshopItems (Steam Workshop IDs)"
        items={workshop}
        onChange={(next) => {
          setWorkshop(next);
          void loadTitles(next);
        }}
        titles={titles}
        hint="Numeric IDs from the Steam Workshop URL. Numbers show load order."
      />

      <div className="row">
        <button className="btn" onClick={() => void load()}>
          Reload
        </button>
        <button className="btn primary" onClick={() => void save()}>
          Save
        </button>
        <button
          className="btn"
          disabled={resolving || !workshop.length}
          onClick={() => void loadTitles(workshop, true)}
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
      </div>
    </div>
  );
}
