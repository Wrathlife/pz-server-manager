import fs from "node:fs";

export type SandboxFlat = Record<string, string>;

export type SandboxField = {
  /** e.g. "Zombies" or "HB.PermanentCasings" */
  path: string;
  section: string;
  key: string;
  value: string;
  /** Preceding `--` comment when present */
  label: string | null;
  kind: "bool" | "number" | "string" | "other";
};

export type SandboxSection = {
  id: string;
  label: string;
  isMod: boolean;
  fields: SandboxField[];
};

/** Nested tables that ship with vanilla SandboxVars. */
const VANILLA_NESTED = new Set([
  "Basement",
  "Map",
  "ZombieLore",
  "ZombieConfig",
  "MultiplierConfig"
]);

/** Friendly titles for common mod Sandbox tables. */
const MOD_SECTION_LABELS: Record<string, string> = {
  GWG: "Gunworks Gang Framework",
  HB: "Hot Brass",
  rSemiTruck: "W900 Semi-Truck / Military",
  MSW: "Guns of Marz (Slots)",
  GoM: "Guns of Marz (Weapons)",
  MarzGuns: "Guns of Marz (Weapons)"
};

function detectKind(value: string): SandboxField["kind"] {
  const v = value.trim();
  if (v === "true" || v === "false") return "bool";
  if (/^-?\d+(\.\d+)?$/.test(v)) return "number";
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return "string";
  }
  return "other";
}

function stripTrailingComma(v: string): string {
  let s = v.trim();
  if (s.endsWith(",")) s = s.slice(0, -1).trim();
  return s;
}

/**
 * Parse SandboxVars.lua into root fields + nested section tables.
 * Uses brace depth so nested mod blocks (HB, MSW, …) become their own groups.
 */
export function parseSandboxVars(text: string): {
  flat: SandboxFlat;
  sections: SandboxSection[];
  raw: string;
} {
  const raw = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const flat: SandboxFlat = {};
  const sectionMap = new Map<string, SandboxField[]>();

  const ensure = (id: string) => {
    if (!sectionMap.has(id)) sectionMap.set(id, []);
    return sectionMap.get(id)!;
  };

  let depth = 0;
  let sectionStack: string[] = [];
  let pendingComment: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("--")) {
      const c = trimmed.replace(/^--\s*/, "").trim();
      // Prefer descriptive comments; keep last non-empty before an assignment
      if (c && !c.startsWith("Min:") && !c.startsWith("1 =") && !/^\d+\s*=/.test(c)) {
        pendingComment = c;
      } else if (c.startsWith("Min:")) {
        // keep pending if we already have a descriptive one; else use min hint
        if (!pendingComment) pendingComment = c;
      }
      continue;
    }

    // Track braces on the line
    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;

    // Assignment: Key = value or Key = {
    const assign = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (assign && depth >= 1) {
      const key = assign[1];
      let rhs = stripTrailingComma(assign[2]);
      if (key === "SandboxVars") {
        // ignore
      } else if (rhs === "{") {
        // entering nested table — push after we count this open brace below
        sectionStack.push(key);
      } else if (!rhs.includes("{")) {
        const section =
          depth === 1 ? "" : sectionStack[sectionStack.length - 1] || "";
        // Only treat depth 1 as root; depth 2 as mod/vanilla nested; deeper flatten under current section
        const path = section ? `${section}.${key}` : key;
        const field: SandboxField = {
          path,
          section,
          key,
          value: rhs,
          label: pendingComment,
          kind: detectKind(rhs)
        };
        flat[path] = rhs;
        ensure(section).push(field);
        pendingComment = null;
      }
    } else {
      // blank / other — don't clear comment on blanks
      if (trimmed) pendingComment = null;
    }

    depth += openCount - closeCount;
    if (depth < 0) depth = 0;

    // Pop section stack when leaving nested tables (depth back to 1 = inside SandboxVars root)
    while (sectionStack.length && depth < sectionStack.length + 1) {
      sectionStack.pop();
    }
  }

  const sections: SandboxSection[] = [];
  // Root first
  const rootFields = ensure("");
  sections.push({
    id: "",
    label: "General (Vanilla)",
    isMod: false,
    fields: rootFields
  });

  for (const [id, fields] of sectionMap) {
    if (id === "") continue;
    const isMod = !VANILLA_NESTED.has(id);
    sections.push({
      id,
      label: MOD_SECTION_LABELS[id] || (isMod ? `Mod: ${id}` : id),
      isMod,
      fields
    });
  }

  const modLabelCount = new Map<string, number>();
  for (const s of sections) {
    if (!s.isMod) continue;
    modLabelCount.set(s.label, (modLabelCount.get(s.label) ?? 0) + 1);
  }
  for (const s of sections) {
    if (s.isMod && (modLabelCount.get(s.label) ?? 0) > 1) {
      s.label = `${s.label} · ${s.id}`;
    }
  }

  // Stable order: general, vanilla nested, then mods alpha (UI may re-order to INI)
  sections.sort((a, b) => {
    if (a.id === "") return -1;
    if (b.id === "") return 1;
    const aVan = VANILLA_NESTED.has(a.id);
    const bVan = VANILLA_NESTED.has(b.id);
    if (aVan !== bVan) return aVan ? -1 : 1;
    return a.label.localeCompare(b.label);
  });

  return { flat, sections, raw };
}

/** Replace scalar assignments. Keys may be `Key` (root) or `Section.Key`. */
export function applySandboxUpdates(raw: string, updates: SandboxFlat): string {
  let out = raw.replace(/\r\n/g, "\n");
  for (const [path, value] of Object.entries(updates)) {
    const dot = path.indexOf(".");
    if (dot === -1) {
      out = replaceRootAssignment(out, path, value);
    } else {
      const section = path.slice(0, dot);
      const key = path.slice(dot + 1);
      out = replaceNestedAssignment(out, section, key, value);
    }
  }
  return out;
}

function replaceRootAssignment(text: string, key: string, value: string): string {
  const re = new RegExp(
    `^( {4}${escapeRegExp(key)}\\s*=\\s*)([^,\\n]+)(,?)(\\s*)$`,
    "m"
  );
  if (!re.test(text)) return text;
  return text.replace(re, `$1${value}$3$4`);
}

function replaceNestedAssignment(
  text: string,
  section: string,
  key: string,
  value: string
): string {
  const secRe = new RegExp(
    `(^ {4}${escapeRegExp(section)}\\s*=\\s*\\{)([\\s\\S]*?)(^ {4}\\})`,
    "m"
  );
  return text.replace(secRe, (full, open, body, close) => {
    const keyRe = new RegExp(
      `^( {8}${escapeRegExp(key)}\\s*=\\s*)([^,\\n]+)(,?)(\\s*)$`,
      "m"
    );
    if (!keyRe.test(body)) return full;
    const newBody = body.replace(keyRe, `$1${value}$3$4`);
    return `${open}${newBody}${close}`;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readSandboxFile(filePath: string): {
  flat: SandboxFlat;
  sections: SandboxSection[];
  raw: string;
} {
  if (!fs.existsSync(filePath)) return { flat: {}, sections: [], raw: "" };
  return parseSandboxVars(fs.readFileSync(filePath, "utf8"));
}

export function writeSandboxFile(filePath: string, raw: string): void {
  const bak = `${filePath}.bak`;
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, bak);
  fs.writeFileSync(filePath, raw.replace(/\r\n/g, "\n"), "utf8");
}
