import { useState } from "react";

export type WorkshopMeta = {
  id: string;
  title: string | null;
  error?: string;
  fetchedAt: number;
};

export function IdListEditor({
  label,
  items,
  onChange,
  hint,
  titles,
  embedded = false
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  titles?: Record<string, WorkshopMeta>;
  embedded?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  function add() {
    const parts = draft
      .split(/[;\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...items];
    const seen = new Set(next);
    for (const p of parts) {
      if (seen.has(p)) continue;
      seen.add(p);
      next.push(p);
    }
    onChange(next);
    setDraft("");
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
    if (editing === i) setEditing(j);
    else if (editing === j) setEditing(i);
  }

  function commitEdit(i: number) {
    const trimmed = editValue.trim();
    setEditing(null);
    if (!trimmed || trimmed === items[i]) return;
    if (items.some((id, idx) => idx !== i && id === trimmed)) return;
    const next = [...items];
    next[i] = trimmed;
    onChange(next);
  }

  const Tag = embedded ? "div" : "section";

  return (
    <Tag
      className={embedded ? "ini-list-field" : "card"}
      style={{ marginBottom: 14 }}
    >
      {embedded ? (
        <label className="ini-list-label">{label}</label>
      ) : (
        <h3>{label}</h3>
      )}
      {hint ? <p className="muted">{hint}</p> : null}

      <ol className="mod-list">
        {items.map((id, i) => {
          const meta = titles?.[id];
          const title = meta?.title;
          const isEditing = editing === i;
          return (
            <li className="mod-row" key={`${id}-${i}`} title={meta?.error || title || id}>
              <span className="mod-num">{i + 1}</span>
              <div className="mod-main">
                {isEditing ? (
                  <input
                    className="mod-edit-input"
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitEdit(i)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit(i);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <>
                    {title ? <div className="mod-title">{title}</div> : null}
                    <div className={`mod-id ${title ? "" : "mod-id-solo"}`}>{id}</div>
                  </>
                )}
              </div>
              <div className="mod-actions">
                <button
                  type="button"
                  className="btn icon"
                  title="Edit id"
                  onClick={() => {
                    setEditing(i);
                    setEditValue(id);
                  }}
                >
                  ✎
                </button>
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
                  onClick={() => {
                    if (editing === i) setEditing(null);
                    onChange(items.filter((_, idx) => idx !== i));
                  }}
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
    </Tag>
  );
}

