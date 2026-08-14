import fs from "node:fs";
import path from "node:path";
import { parseModInfo, parseClientModlists, workshopIdPrefix } from "../shared/modIdParse";
import type { ClientModPresetResolved, WorkshopModMapping } from "../shared/types";
import {
  getAllCachedWorkshopDetails,
  getCachedWorkshopTitles,
  resolveWorkshopTitles
} from "./steamWorkshop";

const INFO_FILES = new Set(["mod.info", "info.txt"]);
const SKIP_DIRS = new Set([
  "media",
  "common",
  "preview",
  "screenshots",
  "userdata",
  "config",
  "steamapps"
]);
const MAX_DEPTH = 4;

function walkInfoFiles(dir: string, depth: number, out: string[]): void {
  if (depth > MAX_DEPTH) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const lower = e.name.toLowerCase();
    const full = path.join(dir, e.name);
    if (e.isFile() && INFO_FILES.has(lower)) {
      out.push(full);
    } else if (e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(lower)) {
      walkInfoFiles(full, depth + 1, out);
    }
  }
}

export function readModIdsFromWorkshopItem(itemDir: string): string[] {
  if (!itemDir || !fs.existsSync(itemDir)) return [];
  const files: string[] = [];
  walkInfoFiles(itemDir, 0, files);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    let text: string;
    try {
      text = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const id of parseModInfo(text)) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function listWorkshopItemIds(contentDir: string): string[] {
  if (!contentDir || !fs.existsSync(contentDir)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(contentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
    .map((e) => e.name);
}

function applyTitles(
  items: WorkshopModMapping[],
  titles: Record<
    string,
    { title: string | null; error?: string; modIds?: string[] }
  >
): WorkshopModMapping[] {
  return items.map((item) => {
    const t = titles[item.id];
    if (!t) return item;
    const next: WorkshopModMapping = { ...item };
    if (!next.title) next.title = t.title;
    if (item.source === "none" && t.modIds?.length) {
      next.modIds = t.modIds;
      next.source = "steam";
      delete next.error;
    } else if (!next.title && t.error) {
      next.error = t.error;
    }
    return next;
  });
}

export async function resolveWorkshopModIds(
  ids: string[],
  dirs: { clientWorkshopDir: string; serverWorkshopDir: string }
): Promise<WorkshopModMapping[]> {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))
  ];
  const items: WorkshopModMapping[] = unique.map((id) => {
    const clientIds = readModIdsFromWorkshopItem(
      dirs.clientWorkshopDir ? path.join(dirs.clientWorkshopDir, id) : ""
    );
    if (clientIds.length) {
      return { id, title: null, modIds: clientIds, source: "client" };
    }
    const serverIds = readModIdsFromWorkshopItem(
      dirs.serverWorkshopDir ? path.join(dirs.serverWorkshopDir, id) : ""
    );
    if (serverIds.length) {
      return { id, title: null, modIds: serverIds, source: "server" };
    }
    return { id, title: null, modIds: [], source: "none" };
  });

  const needSteam = items.filter((i) => i.source === "none").map((i) => i.id);
  const cached = getCachedWorkshopTitles(unique);
  let titled = applyTitles(items, cached);
  const missingTitles = titled.filter((i) => !i.title).map((i) => i.id);
  const steamIds = [...new Set([...needSteam, ...missingTitles])];
  if (steamIds.length) {
    const resolved = await resolveWorkshopTitles(steamIds, {
      needDescription: true
    });
    titled = applyTitles(titled, resolved);
  }
  return titled;
}

export async function listSubscribedWorkshopItems(
  clientDir: string
): Promise<
  | { ok: true; path: string; items: WorkshopModMapping[] }
  | { ok: false; error: string; path: string }
> {
  if (!clientDir || !fs.existsSync(clientDir)) {
    return {
      ok: false,
      path: clientDir || "",
      error: clientDir
        ? `Client Workshop folder not found: ${clientDir}`
        : "Client Workshop folder is not set. Browse to steamapps\\workshop\\content\\108600."
    };
  }
  const ids = listWorkshopItemIds(clientDir);
  const items: WorkshopModMapping[] = ids.map((id) => {
    const modIds = readModIdsFromWorkshopItem(path.join(clientDir, id));
    return {
      id,
      title: null,
      modIds,
      source: modIds.length ? "client" : "none"
    };
  });
  if (!ids.length) {
    return { ok: true, path: clientDir, items };
  }
  const needSteam = items.filter((i) => i.source === "none").map((i) => i.id);
  let titled = applyTitles(items, getCachedWorkshopTitles(ids));
  const steamIds = [
    ...new Set([...needSteam, ...titled.filter((i) => !i.title).map((i) => i.id)])
  ];
  if (steamIds.length) {
    titled = applyTitles(
      titled,
      await resolveWorkshopTitles(steamIds, { needDescription: true })
    );
  }
  return { ok: true, path: clientDir, items: titled };
}

function addModIdMapping(map: Map<string, string>, modId: string, workshopId: string): void {
  if (!modId || !workshopId) return;
  if (!map.has(modId)) map.set(modId, workshopId);
  const lower = modId.toLowerCase();
  if (!map.has(lower)) map.set(lower, workshopId);
}

function lookupWorkshopId(map: Map<string, string>, modId: string): string | null {
  const prefixed = workshopIdPrefix(modId);
  if (prefixed) return prefixed;
  return map.get(modId) ?? map.get(modId.toLowerCase()) ?? null;
}

function buildModIdToWorkshopMap(dirs: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const dir of dirs) {
    for (const wid of listWorkshopItemIds(dir)) {
      addModIdMapping(map, wid, wid);
      for (const mid of readModIdsFromWorkshopItem(path.join(dir, wid))) {
        addModIdMapping(map, mid, wid);
      }
    }
  }
  for (const [wid, details] of Object.entries(getAllCachedWorkshopDetails())) {
    for (const mid of details.modIds ?? []) {
      addModIdMapping(map, mid, wid);
    }
  }
  return map;
}

export async function loadClientModPresets(opts: {
  clientModlist: string;
  clientWorkshopDir: string;
  serverWorkshopDir: string;
}): Promise<
  | { ok: true; path: string; presets: ClientModPresetResolved[] }
  | { ok: false; error: string; path: string }
> {
  const file = opts.clientModlist;
  if (!file || !fs.existsSync(file)) {
    return {
      ok: false,
      path: file || "",
      error: file
        ? `Client mod preset file not found: ${file}`
        : "Client mod preset path is not set."
    };
  }
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    return {
      ok: false,
      path: file,
      error: e instanceof Error ? e.message : String(e)
    };
  }
  const parsed = parseClientModlists(text);
  if (!parsed.length) {
    return {
      ok: false,
      path: file,
      error: "No named presets in pz_modlist_settings.cfg. Save a list in the game’s SELECT MODS screen first."
    };
  }
  const map = buildModIdToWorkshopMap([
    opts.clientWorkshopDir,
    opts.serverWorkshopDir
  ]);
  const workshopNeeded = new Set<string>();
  const resolved: ClientModPresetResolved[] = parsed.map((preset) => {
    const workshop: string[] = [];
    const unmatched: string[] = [];
    const byWorkshop = new Map<string, string[]>();
    for (const modId of preset.mods) {
      const wid = lookupWorkshopId(map, modId);
      if (!wid) {
        unmatched.push(modId);
        continue;
      }
      workshopNeeded.add(wid);
      if (!byWorkshop.has(wid)) {
        byWorkshop.set(wid, []);
        workshop.push(wid);
      }
      byWorkshop.get(wid)!.push(modId);
    }
    const items: WorkshopModMapping[] = workshop.map((id) => ({
      id,
      title: null,
      modIds: byWorkshop.get(id) ?? [],
      source: "client"
    }));
    return { ...preset, workshop, items, unmatched };
  });

  const ids = [...workshopNeeded];
  if (ids.length) {
    let titled = applyTitles(
      resolved.flatMap((p) => p.items),
      getCachedWorkshopTitles(ids)
    );
    const missingTitles = titled.filter((i) => !i.title).map((i) => i.id);
    if (missingTitles.length) {
      titled = applyTitles(
        titled,
        await resolveWorkshopTitles(missingTitles)
      );
    }
    const byId = new Map(titled.map((i) => [i.id, i]));
    for (const preset of resolved) {
      preset.items = preset.items.map((item) => {
        const hit = byId.get(item.id);
        if (!hit) return item;
        return { ...item, title: hit.title ?? item.title, error: hit.error };
      });
    }
  }

  return { ok: true, path: file, presets: resolved };
}
