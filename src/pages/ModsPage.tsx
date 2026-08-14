import { useEffect, useState } from "react";
import type { ClientModPresetResolved, ModIdSource, WorkshopModMapping } from "../../shared/types";
import { splitModIdList } from "../../shared/modIdParse";
import { IdListEditor, type WorkshopMeta } from "../components/IdListEditor";

type Props = { onRestart: () => void };

type PreviewMode = "fill" | "import" | "preset";

type PreviewRow = WorkshopModMapping & {
  checked: boolean;
  draft: string;
};

function sourceLabel(source: ModIdSource): string {
  if (source === "client") return "client";
  if (source === "server") return "server";
  if (source === "steam") return "steam";
  return "missing";
}

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
  const [previewMode, setPreviewMode] = useState<PreviewMode | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewPath, setPreviewPath] = useState("");
  const [keepOrphans, setKeepOrphans] = useState(true);
  const [busyPreview, setBusyPreview] = useState(false);
  const [presets, setPresets] = useState<ClientModPresetResolved[]>([]);
  const [presetName, setPresetName] = useState("");

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
    setPreviewMode(null);
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

  function rowsFromItems(items: WorkshopModMapping[], checked: (item: WorkshopModMapping) => boolean) {
    return items.map((item) => ({
      ...item,
      checked: checked(item),
      draft: item.modIds.join(";")
    }));
  }

  function workshopApiMissing(
    extra?: "workshopModIds" | "workshopSubscribed" | "listClientPresets"
  ): string | null {
    const pz = window.pz as Window["pz"] & Record<string, unknown>;
    const need = extra
      ? [extra]
      : (["workshopModIds", "workshopSubscribed", "listClientPresets"] as const);
    if (need.some((name) => typeof pz?.[name] !== "function")) {
      return "Workshop import APIs are not loaded. Fully quit PZ Server Manager and run npm run dev again (a page refresh is not enough).";
    }
    return null;
  }

  async function fillModIds() {
    const missing = workshopApiMissing("workshopModIds");
    if (missing) {
      setErr(missing);
      return;
    }
    setBusyPreview(true);
    setErr(null);
    setMsg(null);
    try {
      const items = await window.pz.workshopModIds(workshop);
      setPreviewRows(rowsFromItems(items, () => true));
      setPreviewPath("");
      setPreviewMode("fill");
      const found = items.filter((i) => i.modIds.length).length;
      setMsg(
        `Looked up ${items.length} Workshop item(s); found Mod IDs for ${found}. Review and Apply.`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPreview(false);
    }
  }

  async function importSubscribed() {
    const missing = workshopApiMissing("workshopSubscribed");
    if (missing) {
      setErr(missing);
      return;
    }
    setBusyPreview(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await window.pz.workshopSubscribed();
      setPreviewPath(res.path);
      if (!res.ok) {
        setPreviewRows([]);
        setPreviewMode("import");
        setErr(res.error);
        return;
      }
      const have = new Set(workshop);
      setPreviewRows(rowsFromItems(res.items, (item) => !have.has(item.id)));
      setPreviewMode("import");
      const newCount = res.items.filter((i) => !have.has(i.id)).length;
      setMsg(
        `Found ${res.items.length} subscribed item(s) on disk (${newCount} not already in the list).`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPreview(false);
    }
  }

  async function browseClientWorkshop() {
    const p = await window.pz.pickDirectory();
    if (!p) return;
    const s = await window.pz.getSettings();
    await window.pz.saveSettings({ ...s, clientWorkshopDir: p });
    await importSubscribed();
  }

  function showPreset(next: ClientModPresetResolved) {
    setPresetName(next.name);
    setPreviewRows(rowsFromItems(next.items, () => true));
  }

  async function loadClientPreset() {
    const missing = workshopApiMissing("listClientPresets");
    if (missing) {
      setErr(missing);
      return;
    }
    setBusyPreview(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await window.pz.listClientPresets();
      setPreviewPath(res.path);
      if (!res.ok) {
        setPresets([]);
        setPreviewRows([]);
        setPreviewMode("preset");
        setErr(res.error);
        return;
      }
      setPresets(res.presets);
      const preferred =
        res.presets.find((p) => p.name === "MP") ?? res.presets[0];
      showPreset(preferred);
      setPreviewMode("preset");
      setMsg(
        `Loaded ${res.presets.length} client preset(s) from SELECT MODS. Apply replaces both server lists.`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPreview(false);
    }
  }

  function applyPreview() {
    if (previewMode === "fill") {
      const nextMods: string[] = [];
      const seen = new Set<string>();
      for (const row of previewRows) {
        for (const id of splitModIdList(row.draft)) {
          if (seen.has(id)) continue;
          seen.add(id);
          nextMods.push(id);
        }
      }
      if (keepOrphans) {
        for (const id of mods) {
          if (seen.has(id)) continue;
          seen.add(id);
          nextMods.push(id);
        }
      }
      changeMods(nextMods);
      setPreviewMode(null);
      setMsg(
        `Filled ${nextMods.length} mod id(s) from ${previewRows.length} Workshop item(s). Save to write the INI.`
      );
      return;
    }

    if (previewMode === "preset") {
      const preset = presets.find((p) => p.name === presetName);
      if (!preset) return;
      const keep = new Set<string>(preset.unmatched);
      const nextWorkshop: string[] = [];
      const wSeen = new Set<string>();
      for (const row of previewRows) {
        if (!row.checked) continue;
        if (!wSeen.has(row.id)) {
          wSeen.add(row.id);
          nextWorkshop.push(row.id);
        }
        for (const id of splitModIdList(row.draft)) keep.add(id);
      }
      const nextMods = preset.mods.filter((id) => keep.has(id));
      setMods(nextMods);
      setWorkshop(nextWorkshop);
      setDirty(true);
      setPreviewMode(null);
      setMsg(
        `Loaded preset “${preset.name}”: ${nextMods.length} mod id(s), ${nextWorkshop.length} Workshop item(s). Save to write the INI.`
      );
      void loadTitles(nextWorkshop);
      return;
    }

    const nextWorkshop = [...workshop];
    const nextMods = [...mods];
    const wSeen = new Set(nextWorkshop);
    const mSeen = new Set(nextMods);
    let addedW = 0;
    let addedM = 0;
    for (const row of previewRows) {
      if (!row.checked) continue;
      if (!wSeen.has(row.id)) {
        wSeen.add(row.id);
        nextWorkshop.push(row.id);
        addedW += 1;
      }
      for (const id of splitModIdList(row.draft)) {
        if (mSeen.has(id)) continue;
        mSeen.add(id);
        nextMods.push(id);
        addedM += 1;
      }
    }
    setMods(nextMods);
    setWorkshop(nextWorkshop);
    setDirty(true);
    setPreviewMode(null);
    setMsg(
      `Added ${addedW} Workshop item(s) and ${addedM} mod id(s). Save to write the INI.`
    );
    void loadTitles(nextWorkshop);
  }

  function setAllChecked(on: boolean) {
    setPreviewRows((rows) => rows.map((r) => ({ ...r, checked: on })));
  }

  const activePreset =
    previewMode === "preset" ? presets.find((p) => p.name === presetName) : undefined;

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
          disabled={busyPreview || !workshop.length}
          onClick={() => void fillModIds()}
        >
          {busyPreview && previewMode === "fill" ? "Looking up…" : "Fill Mod IDs"}
        </button>
        <button
          className="btn"
          disabled={busyPreview}
          onClick={() => void loadClientPreset()}
        >
          {busyPreview && previewMode === "preset" ? "Loading…" : "Load preset"}
        </button>
        <button
          className="btn"
          disabled={busyPreview}
          onClick={() => void importSubscribed()}
        >
          {busyPreview && previewMode === "import" ? "Scanning…" : "Import subscribed"}
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

      {previewMode ? (
        <section className="card" style={{ marginBottom: 14 }}>
          <h3>
            {previewMode === "fill"
              ? "Fill Mod IDs"
              : previewMode === "preset"
                ? "Load client preset"
                : "Import subscribed"}
          </h3>
          <p className="muted">
            {previewMode === "fill"
              ? "Rebuilds the Mods list from Workshop items (client folder, then dedicated server, then Steam description). Save is still required."
              : previewMode === "preset"
                ? `${previewPath || "Client preset file"} — uses the SAVE list order (the game’s MOD ORDER). Apply replaces both server lists.`
                : previewPath
                  ? `Scanning ${previewPath}`
                  : "Select items already downloaded in the client Workshop folder."}
          </p>
          {previewMode === "fill" ? (
            <label className="preview-keep">
              <input
                type="checkbox"
                checked={keepOrphans}
                onChange={(e) => setKeepOrphans(e.target.checked)}
              />
              Keep Mod IDs that are not in this mapping
            </label>
          ) : previewMode === "preset" ? (
            <div className="row" style={{ marginBottom: 8 }}>
              <label className="muted">Preset</label>
              <select
                value={presetName}
                onChange={(e) => {
                  const next = presets.find((p) => p.name === e.target.value);
                  if (next) showPreset(next);
                }}
              >
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.mods.length} mods)
                  </option>
                ))}
              </select>
              <button className="btn" onClick={() => setAllChecked(true)}>
                Select all
              </button>
              <button className="btn" onClick={() => setAllChecked(false)}>
                Select none
              </button>
            </div>
          ) : (
            <div className="row" style={{ marginBottom: 8 }}>
              <button className="btn" onClick={() => setAllChecked(true)}>
                Select all
              </button>
              <button className="btn" onClick={() => setAllChecked(false)}>
                Select none
              </button>
              <button className="btn" onClick={() => void browseClientWorkshop()}>
                Browse folder
              </button>
            </div>
          )}
          {previewMode === "preset" && activePreset?.unmatched.length ? (
            <p className="warn">
              No Workshop ID for: {activePreset.unmatched.join(", ")}
            </p>
          ) : null}
          {previewMode === "preset" && activePreset?.mods.length ? (
            <>
              <p className="muted">Mod load order</p>
              <ol className="mod-list preview-list">
                {activePreset.mods.map((id, i) => (
                  <li className="mod-row" key={`${id}-${i}`}>
                    <span className="mod-num">{i + 1}</span>
                    <div className="mod-main">
                      <div className="mod-id mod-id-solo">{id}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="muted">Workshop items (order follows first use above)</p>
            </>
          ) : null}
          {previewRows.length ? (
            <ol className="mod-list preview-list">
              {previewRows.map((row, i) => (
                <li className="mod-row" key={row.id}>
                  {previewMode === "fill" ? (
                    <span className="mod-num">{i + 1}</span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) =>
                        setPreviewRows((rows) =>
                          rows.map((r, idx) =>
                            idx === i ? { ...r, checked: e.target.checked } : r
                          )
                        )
                      }
                    />
                  )}
                  <div className="mod-main">
                    <div className="mod-title">
                      {row.title || row.id}{" "}
                      <span className={`source-badge source-${row.source}`}>
                        {sourceLabel(row.source)}
                      </span>
                    </div>
                    <div className="mod-id">{row.id}</div>
                    <input
                      className="preview-modids"
                      placeholder="Mod ID(s)…"
                      value={row.draft}
                      onChange={(e) =>
                        setPreviewRows((rows) =>
                          rows.map((r, idx) =>
                            idx === i ? { ...r, draft: e.target.value } : r
                          )
                        )
                      }
                    />
                  </div>
                </li>
              ))}
            </ol>
          ) : previewMode === "import" ? (
            <p className="muted">No subscribed Workshop folders found on disk.</p>
          ) : previewMode === "preset" ? (
            <p className="muted">This preset has no Workshop IDs we could resolve yet.</p>
          ) : (
            <p className="muted">No Workshop items to look up.</p>
          )}
          <div className="row">
            <button
              className="btn primary"
              disabled={
                previewMode === "preset"
                  ? !activePreset?.mods.length
                  : !previewRows.length
              }
              onClick={applyPreview}
            >
              Apply
            </button>
            <button className="btn" onClick={() => setPreviewMode(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <IdListEditor
        label="Mods (mod IDs)"
        items={mods}
        onChange={changeMods}
        hint="Filled from Workshop items, a client preset, or by hand. Order is load order."
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
