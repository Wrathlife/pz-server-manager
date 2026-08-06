import fs from "node:fs";

export type SandboxFlat = Record<string, string>;

/**
 * Flatten SandboxVars.lua-ish `SandboxVars = { Key = value, ... }` top-level
 * assignments into string map. Nested tables become raw snippets.
 */
export function parseSandboxVars(text: string): { flat: SandboxFlat; raw: string } {
  const raw = text.replace(/^\uFEFF/, "");
  const flat: SandboxFlat = {};
  // Match Key = value at indent typical of SandboxVars body
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*,?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const key = m[1];
    if (key === "SandboxVars") continue;
    let val = m[2].trim();
    if (val.endsWith(",")) val = val.slice(0, -1).trim();
    // Skip block openers that aren't scalars
    if (val === "{") continue;
    flat[key] = val;
  }
  return { flat, raw };
}

/** Replace scalar assignments for known keys; leave structure otherwise. */
export function applySandboxUpdates(raw: string, updates: SandboxFlat): string {
  let out = raw;
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(
      `^(\\s*${key}\\s*=\\s*)(.+?)(\\s*,?\\s*)$`,
      "m"
    );
    if (re.test(out)) {
      out = out.replace(re, `$1${value}$3`);
    }
  }
  return out;
}

export function readSandboxFile(filePath: string): { flat: SandboxFlat; raw: string } {
  if (!fs.existsSync(filePath)) return { flat: {}, raw: "" };
  return parseSandboxVars(fs.readFileSync(filePath, "utf8"));
}

export function writeSandboxFile(filePath: string, raw: string): void {
  const bak = `${filePath}.bak`;
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, bak);
  fs.writeFileSync(filePath, raw.replace(/\r\n/g, "\n"), "utf8");
}
