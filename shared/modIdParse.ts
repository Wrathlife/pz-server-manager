const MOD_ID_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._\-]*$/;

function isWorkshopNumericId(value: string): boolean {
  return /^\d+$/.test(value);
}

function pushUnique(out: string[], seen: Set<string>, raw: string): void {
  const id = raw.trim();
  if (!id || seen.has(id)) return;
  if (!MOD_ID_TOKEN.test(id) || isWorkshopNumericId(id)) return;
  seen.add(id);
  out.push(id);
}

/** Split user-typed or INI-like Mod ID lists (`;`, `,`, whitespace). */
export function splitModIdList(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[;,\s]+/)) {
    const t = part.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Read `id=` values from a PZ `mod.info` / `info.txt` file. */
export function parseModInfo(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const src = text.replace(/^\uFEFF/, "");
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
    const m = trimmed.match(/^id\s*=\s*(.+)$/i);
    if (!m) continue;
    const value = m[1].replace(/["']/g, "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }
  return ids;
}

/**
 * Extract Mod IDs from a Steam Workshop description.
 * Understands `Mod ID:`, `Mod IDs:`, and BBCode wrappers.
 */
export function parseModIdsFromDescription(text: string): string[] {
  if (!text) return [];
  const plain = text
    .replace(/\[\/?[^\]]+\]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");

  const ids: string[] = [];
  const seen = new Set<string>();

  function addChunk(chunk: string): void {
    for (const part of chunk.split(/[;,\n]+/)) {
      const token = part.trim().replace(/^[-*•]\s*/, "");
      pushUnique(ids, seen, token);
    }
  }

  const re = /mod\s*ids?\s*[:\-]\s*([^\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain))) {
    addChunk(m[1]);
  }
  return ids;
}

export type ParsedClientModPreset = {
  name: string;
  mods: string[];
};

/**
 * Parse B42 client mod presets from `Zomboid/Lua/pz_modlist_settings.cfg`.
 * Lines look like `MP:modA;modB;` — names wrapped in `!…!` are skipped (favorites marker).
 */
export function parseClientModlists(text: string): ParsedClientModPreset[] {
  const presets: ParsedClientModPreset[] = [];
  const seenNames = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim();
    if (!name || /^!.*!$/.test(name)) continue;
    if (seenNames.has(name)) continue;
    seenNames.add(name);
    presets.push({ name, mods: splitModIdList(line.slice(colon + 1)) });
  }
  return presets;
}

/** `1299328280/ToadTraits` → workshop id, otherwise null. */
export function workshopIdPrefix(modId: string): string | null {
  const m = modId.trim().match(/^(\d{8,})\//);
  return m ? m[1] : null;
}
