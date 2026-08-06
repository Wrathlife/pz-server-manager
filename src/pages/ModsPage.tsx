import { useEffect, useState } from "react";

type WorkshopMeta = {
  id: string;
  title: string | null;
  error?: string;
  fetchedAt: number;
};

function ChipEditor({
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
      <div className="chips">
        {items.map((id, i) => {
          const meta = titles?.[id];
          const title = meta?.title;
          return (
            <span className="chip chip-tall" key={`${id}-${i}`} title={meta?.error || title || id}>
              <span className="chip-body">
                {title ? <span className="chip-title">{title}</span> : null}
                <span className="chip-id">{id}</span>
              </span>
              {title ? (
                <button
                  type="button"
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
              <button type="button" title="Up" onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" title="Down" onClick={() => move(i, 1)}>
                ↓
              </button>
              <button
                type="button"
                title="Remove"
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
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

      <ChipEditor
        label="Mods (mod IDs)"
        items={mods}
        onChange={setMods}
        hint="From each mod’s info.txt Mod ID field."
      />
      <ChipEditor
        label="WorkshopItems (Steam Workshop IDs)"
        items={workshop}
        onChange={(next) => {
          setWorkshop(next);
          void loadTitles(next);
        }}
        titles={titles}
        hint="Numeric IDs from the Steam Workshop URL. Titles resolve via Steam API."
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
