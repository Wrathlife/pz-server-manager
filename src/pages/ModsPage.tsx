import { useEffect, useState } from "react";

function ChipEditor({
  label,
  items,
  onChange,
  hint
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  hint?: string;
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
        {items.map((id, i) => (
          <span className="chip" key={`${id}-${i}`}>
            {id}
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
        ))}
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
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const res = await window.pz.getMods();
    setMods(res.mods);
    setWorkshop(res.workshop);
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
    }
  }

  return (
    <div className="page">
      <h2>Mods</h2>
      <p className="sub">
        Edits <code>Mods</code> and <code>WorkshopItems</code> in the server INI. Workshop downloads
        are still done via Steam — this only configures IDs.
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
        onChange={setWorkshop}
        hint="Numeric IDs from the Steam Workshop URL."
      />

      <div className="row">
        <button className="btn" onClick={() => void load()}>
          Reload
        </button>
        <button className="btn primary" onClick={() => void save()}>
          Save
        </button>
        <a
          className="btn"
          href="https://steamcommunity.com/app/108600/workshop/"
          target="_blank"
          rel="noreferrer"
        >
          Open Workshop
        </a>
      </div>
    </div>
  );
}
