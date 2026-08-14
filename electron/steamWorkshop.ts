import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import https from "node:https";
import { parseModIdsFromDescription } from "../shared/modIdParse";

export type WorkshopDetails = {
  id: string;
  title: string | null;
  description?: string | null;
  modIds?: string[];
  error?: string;
  fetchedAt: number;
};

const CACHE_DIR = path.join(os.homedir(), "AppData", "Roaming", "pz-server-manager");
const CACHE_FILE = path.join(CACHE_DIR, "workshop-cache.json");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CacheFile = Record<string, WorkshopDetails>;

function loadCache(): CacheFile {
  try {
    if (!fs.existsSync(CACHE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")) as CacheFile;
  } catch {
    return {};
  }
}

function saveCache(cache: CacheFile): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

function postForm(url: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "pz-server-manager/1.0"
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error("Steam API timeout"));
    });
    req.write(body);
    req.end();
  });
}

type SteamPublishedFile = {
  publishedfileid?: string;
  title?: string;
  description?: string;
  result?: number;
};

function cacheFresh(
  hit: WorkshopDetails | undefined,
  now: number,
  needDescription?: boolean
): boolean {
  if (!hit?.title) return false;
  if (now - hit.fetchedAt >= CACHE_TTL_MS) return false;
  if (
    needDescription &&
    hit.description === undefined &&
    !(hit.modIds && hit.modIds.length)
  ) {
    return false;
  }
  return true;
}

/**
 * Resolve Workshop titles via Steam's public GetPublishedFileDetails API.
 * Batches up to 50 IDs per request. Uses a local disk cache.
 */
export async function resolveWorkshopTitles(
  ids: string[],
  opts?: { force?: boolean; needDescription?: boolean }
): Promise<Record<string, WorkshopDetails>> {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter((id) => /^\d+$/.test(id)))
  ];
  const cache = loadCache();
  const now = Date.now();
  const out: Record<string, WorkshopDetails> = {};
  const missing: string[] = [];

  for (const id of unique) {
    const hit = cache[id];
    if (hit && !opts?.force && cacheFresh(hit, now, opts?.needDescription)) {
      out[id] = hit;
    } else {
      missing.push(id);
    }
  }

  const chunkSize = 50;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const params = new URLSearchParams();
    params.set("itemcount", String(chunk.length));
    chunk.forEach((id, idx) => params.set(`publishedfileids[${idx}]`, id));

    try {
      const raw = await postForm(
        "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/",
        params.toString()
      );
      const json = JSON.parse(raw) as {
        response?: { publishedfiledetails?: SteamPublishedFile[] };
      };
      const details = json.response?.publishedfiledetails ?? [];
      const byId = new Map(details.map((d) => [String(d.publishedfileid ?? ""), d]));

      for (const id of chunk) {
        const d = byId.get(id);
        const title = d?.title?.trim() || null;
        const description = d?.description ?? null;
        const modIds = description ? parseModIdsFromDescription(description) : [];
        const entry: WorkshopDetails = {
          id,
          title,
          description,
          modIds,
          error: title ? undefined : "No title returned (private or removed?)",
          fetchedAt: now
        };
        cache[id] = entry;
        out[id] = entry;
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      for (const id of chunk) {
        const prev = cache[id];
        const entry: WorkshopDetails = {
          id,
          title: prev?.title ?? null,
          description: prev?.description,
          modIds: prev?.modIds,
          error: err,
          fetchedAt: now
        };
        out[id] = entry;
      }
    }
  }

  saveCache(cache);
  return out;
}

export function getCachedWorkshopTitles(ids: string[]): Record<string, WorkshopDetails> {
  const cache = loadCache();
  const out: Record<string, WorkshopDetails> = {};
  for (const id of ids) {
    if (cache[id]) out[id] = cache[id];
  }
  return out;
}

export function getAllCachedWorkshopDetails(): Record<string, WorkshopDetails> {
  return loadCache();
}
