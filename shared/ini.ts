import type { IniDocument } from "./types";

/** Parse PZ server .ini (Key=Value, # comments). */
export function parseIni(text: string): IniDocument {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const values: Record<string, string> = {};
  const keyLines: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    values[key] = value;
    keyLines[key] = i;
  }

  return { lines, values, keyLines };
}

/** Apply key updates; preserve comments and unknown lines. Append new keys at end. */
export function applyIniUpdates(
  doc: IniDocument,
  updates: Record<string, string>
): IniDocument {
  const lines = [...doc.lines];
  const values = { ...doc.values };
  const keyLines = { ...doc.keyLines };

  for (const [key, value] of Object.entries(updates)) {
    values[key] = value;
    if (key in keyLines) {
      const idx = keyLines[key];
      const prev = lines[idx];
      const indent = prev.match(/^\s*/)?.[0] ?? "";
      lines[idx] = `${indent}${key}=${value}`;
    } else {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      lines.push(`${key}=${value}`);
      keyLines[key] = lines.length - 1;
    }
  }

  return { lines, values, keyLines };
}

export function serializeIni(doc: IniDocument): string {
  const body = doc.lines.join("\n");
  return body.endsWith("\n") ? body : `${body}\n`;
}

export function getIniValue(doc: IniDocument, key: string, fallback = ""): string {
  return doc.values[key] ?? fallback;
}

/** Split semicolon-separated INI list values (Mods, WorkshopItems, …). */
export function splitIniList(value: string): string[] {
  return value
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinIniList(items: string[]): string {
  return items.map((s) => s.trim()).filter(Boolean).join(";");
}
