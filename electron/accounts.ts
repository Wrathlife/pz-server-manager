import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { AppSettings } from "../shared/types";
import { resolvedPaths } from "./settingsStore";
import { discoverServerPids, sendConsoleCommand } from "./processManager";

export type AccountRow = {
  id: number;
  username: string;
  role: string | null;
  roleId: number | null;
  steamid: string | null;
  lastConnection: string | null;
  displayName: string | null;
  hasPassword: boolean;
  world: string | null;
};

function dbPath(settings: AppSettings): string {
  return resolvedPaths(settings).accountsDb;
}

function openDb(file: string, readonly = false): DatabaseSync {
  return new DatabaseSync(file, { readOnly: readonly });
}

function backupDb(file: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${file}.bak-${stamp}`;
  fs.copyFileSync(file, bak);
  return bak;
}

export function listAccounts(settings: AppSettings): {
  ok: boolean;
  path: string;
  exists: boolean;
  accounts: AccountRow[];
  error?: string;
} {
  const file = dbPath(settings);
  if (!fs.existsSync(file)) {
    return { ok: true, path: file, exists: false, accounts: [] };
  }
  try {
    const db = openDb(file, true);
    try {
      const rows = db
        .prepare(
          `SELECT w.id, w.world, w.username, w.password, w.lastConnection,
                  w.role AS roleId, r.name AS roleName, w.steamid, w.displayName
           FROM whitelist w
           LEFT JOIN role r ON r.id = w.role
           ORDER BY w.username COLLATE NOCASE`
        )
        .all() as Array<{
        id: number;
        world: string | null;
        username: string;
        password: string | null;
        lastConnection: string | null;
        roleId: number | null;
        roleName: string | null;
        steamid: string | null;
        displayName: string | null;
      }>;
      const accounts: AccountRow[] = rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.roleName,
        roleId: r.roleId,
        steamid: r.steamid,
        lastConnection: r.lastConnection,
        displayName: r.displayName,
        hasPassword: !!(r.password && String(r.password).length > 0),
        world: r.world
      }));
      return { ok: true, path: file, exists: true, accounts };
    } finally {
      db.close();
    }
  } catch (e) {
    return {
      ok: false,
      path: file,
      exists: true,
      accounts: [],
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

export async function resetAccountPassword(
  settings: AppSettings,
  username: string,
  newPassword?: string
): Promise<{ ok: boolean; error?: string; method?: string; backup?: string }> {
  const user = username.trim();
  if (!user) return { ok: false, error: "Username required" };

  const running = (await discoverServerPids(settings)).length > 0;

  // Prefer live console when a password is provided and server is up
  if (running && newPassword != null && newPassword.length > 0) {
    const res = sendConsoleCommand(`setpassword "${user}" "${newPassword}"`);
    if (!res.ok) return res;
    return { ok: true, method: "console:setpassword" };
  }

  if (running) {
    // Clearing via DB while live is unsafe; remove from whitelist so they re-register
    const res = sendConsoleCommand(`removeuserfromwhitelist "${user}"`);
    if (!res.ok) return res;
    return {
      ok: true,
      method: "console:removeuserfromwhitelist",
      error: undefined
    };
  }

  const file = dbPath(settings);
  if (!fs.existsSync(file)) return { ok: false, error: `Missing ${file}` };

  try {
    const bak = backupDb(file);
    const db = openDb(file, false);
    try {
      const existing = db
        .prepare(`SELECT id FROM whitelist WHERE username = ? COLLATE NOCASE`)
        .get(user) as { id: number } | undefined;
      if (!existing) return { ok: false, error: `No account named "${user}"` };

      if (newPassword != null && newPassword.length > 0) {
        // Game stores hashed passwords — cannot set a usable plaintext hash offline.
        // Clear instead and tell caller to use console while running, OR use remove approach.
        return {
          ok: false,
          error:
            "Setting a new password requires the server running (uses setpassword). Stopped server can only clear the password hash."
        };
      }

      db.prepare(
        `UPDATE whitelist SET password = NULL WHERE username = ? COLLATE NOCASE`
      ).run(user);
      return { ok: true, method: "db:clear-password", backup: bak };
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function wipeAccount(
  settings: AppSettings,
  username: string
): Promise<{ ok: boolean; error?: string; method?: string; backup?: string }> {
  const user = username.trim();
  if (!user) return { ok: false, error: "Username required" };

  const running = (await discoverServerPids(settings)).length > 0;
  if (running) {
    const res = sendConsoleCommand(`removeuserfromwhitelist "${user}"`);
    if (!res.ok) return res;
    return { ok: true, method: "console:removeuserfromwhitelist" };
  }

  const file = dbPath(settings);
  if (!fs.existsSync(file)) return { ok: false, error: `Missing ${file}` };

  try {
    const bak = backupDb(file);
    const db = openDb(file, false);
    try {
      const result = db
        .prepare(`DELETE FROM whitelist WHERE username = ? COLLATE NOCASE`)
        .run(user);
      if (!result.changes) return { ok: false, error: `No account named "${user}"` };
      return { ok: true, method: "db:delete", backup: bak };
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function wipeAllAccounts(
  settings: AppSettings,
  opts: { keepAdmin: boolean }
): Promise<{ ok: boolean; error?: string; deleted?: number; backup?: string }> {
  const running = (await discoverServerPids(settings)).length > 0;
  if (running) {
    return {
      ok: false,
      error: "Stop the server before wiping all accounts from the database."
    };
  }

  const file = dbPath(settings);
  if (!fs.existsSync(file)) return { ok: false, error: `Missing ${file}` };

  try {
    const bak = backupDb(file);
    const db = openDb(file, false);
    try {
      const result = opts.keepAdmin
        ? db.prepare(`DELETE FROM whitelist WHERE lower(username) != 'admin'`).run()
        : db.prepare(`DELETE FROM whitelist`).run();
      return { ok: true, deleted: Number(result.changes ?? 0), backup: bak };
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Clear password hashes for selected users (stopped server only). */
export async function clearPasswords(
  settings: AppSettings,
  usernames: string[]
): Promise<{ ok: boolean; error?: string; cleared?: number; backup?: string }> {
  const running = (await discoverServerPids(settings)).length > 0;
  if (running) {
    return {
      ok: false,
      error:
        "Stop the server to clear passwords in the DB, or use Reset with a new password while running."
    };
  }
  const file = dbPath(settings);
  if (!fs.existsSync(file)) return { ok: false, error: `Missing ${file}` };
  const names = usernames.map((u) => u.trim()).filter(Boolean);
  if (!names.length) return { ok: false, error: "No usernames selected" };

  try {
    const bak = backupDb(file);
    const db = openDb(file, false);
    try {
      const stmt = db.prepare(
        `UPDATE whitelist SET password = NULL WHERE username = ? COLLATE NOCASE`
      );
      let cleared = 0;
      db.exec("BEGIN");
      try {
        for (const name of names) {
          const r = stmt.run(name);
          cleared += Number(r.changes ?? 0);
        }
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return { ok: true, cleared, backup: bak };
    } finally {
      db.close();
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function accountsDbExists(settings: AppSettings): boolean {
  return fs.existsSync(dbPath(settings));
}
