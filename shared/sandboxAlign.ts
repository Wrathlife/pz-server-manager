/**
 * INI `Mods=` ids that write a differently named SandboxVars table.
 * One mod can own several tables (e.g. MarzGuns + MSW).
 */
export const INI_MOD_TO_SANDBOX_TABLES: Record<string, string[]> = {
  SWMG: ["HB", "SWMG"],
  HBVCEFb42: ["GWG", "HBVCEFb42"],
  MarzGuns: ["MarzGuns", "MSW", "GoM"],
  rSemiTruck: ["rSemiTruck"]
};

export function sandboxTableIdsForMod(modId: string): string[] {
  const trimmed = modId.trim();
  if (!trimmed) return [];
  const short = trimmed.includes("/")
    ? trimmed.slice(trimmed.lastIndexOf("/") + 1)
    : trimmed;
  const extra =
    INI_MOD_TO_SANDBOX_TABLES[trimmed] ?? INI_MOD_TO_SANDBOX_TABLES[short] ?? [];
  return [...new Set([trimmed, short, ...extra])];
}

export function alignSandboxModSections<T extends { id: string }>(
  modSections: T[],
  iniMods: string[]
): { aligned: T[]; orphans: T[]; missing: string[] } {
  if (!iniMods.length) {
    return { aligned: modSections, orphans: [], missing: [] };
  }
  const byId = new Map(modSections.map((s) => [s.id, s]));
  const used = new Set<string>();
  const aligned: T[] = [];
  const missing: string[] = [];
  for (const modId of iniMods) {
    const ids = sandboxTableIdsForMod(modId);
    let found = false;
    for (const id of ids) {
      const sec = byId.get(id);
      if (sec && !used.has(sec.id)) {
        used.add(sec.id);
        aligned.push(sec);
        found = true;
      }
    }
    if (!found) missing.push(modId);
  }
  const orphans = modSections.filter((s) => !used.has(s.id));
  return { aligned, orphans, missing };
}
