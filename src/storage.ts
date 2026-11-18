import { parseSnapshot, sanitizeIds, type FollowerSnapshot } from './core';

/** Prefix shared by every key FollowAudit writes to localStorage. */
export const STORAGE_PREFIX = 'follow-audit:';
const SNAPSHOT_PREFIX = `${STORAGE_PREFIX}snapshot:`;
const HISTORY_PREFIX = `${STORAGE_PREFIX}history:`;
const LOG_PREFIX = `${STORAGE_PREFIX}log:`;
const QUEUE_PREFIX = `${STORAGE_PREFIX}queue:`;
const MAX_SNAPSHOT_CHARS = 2_500_000;

export function readText(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

/** Returns false when the browser refuses the write (private mode, quota). */
export function writeText(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function readJson(key: string): unknown {
  try { return JSON.parse(readText(key) ?? 'null') as unknown; } catch { return null; }
}

export function writeJson(key: string, value: unknown): boolean {
  return writeText(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  try { localStorage.removeItem(key); } catch { /* Storage unavailable: nothing to remove. */ }
}

/** Per-account keys: audit history, action log and the resumable queue. */
export const historyKey = (platform: string, account: string): string => `${HISTORY_PREFIX}${platform}:${account}`;
export const logKey = (account: string): string => `${LOG_PREFIX}instagram:${account}`;
export const queueKey = (account: string): string => `${QUEUE_PREFIX}instagram:${account}`;

export function loadIds(key: string): Set<string> {
  return new Set(sanitizeIds(readJson(key)) ?? []);
}

export function saveIds(key: string, ids: ReadonlySet<string>): boolean {
  return writeText(key, JSON.stringify(sanitizeIds([...ids])));
}

export function snapshotKey(platform: string, account: string): string {
  return `${SNAPSHOT_PREFIX}${platform}:${account}`;
}

export function loadSnapshot(key: string): FollowerSnapshot | undefined {
  return parseSnapshot(readJson(key));
}

/** Large audits that would crowd out localStorage are skipped instead of truncated. */
export function saveSnapshot(key: string, snapshot: FollowerSnapshot): boolean {
  const value = JSON.stringify(snapshot);
  return value.length <= MAX_SNAPSHOT_CHARS && writeText(key, value);
}

/** Removes every saved follower snapshot, audit history and action log, plus the extra keys given. */
export function clearHistory(extraKeys: readonly string[]): void {
  try {
    const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key !== null && [SNAPSHOT_PREFIX, HISTORY_PREFIX, LOG_PREFIX].some(prefix => key.startsWith(prefix)));
    for (const key of [...keys, ...extraKeys]) localStorage.removeItem(key);
  } catch { /* Storage unavailable: nothing was persisted. */ }
}

interface ProtectedBackup {
  readonly app: 'FollowAudit';
  readonly kind: 'protected';
  readonly version: 1;
  readonly platform: string;
  readonly ids: readonly string[];
}

export function protectedBackup(platform: string, ids: ReadonlySet<string>): string {
  const backup: ProtectedBackup = { app: 'FollowAudit', kind: 'protected', version: 1, platform, ids: [...ids] };
  return JSON.stringify(backup, null, 2);
}

/** Accepts a FollowAudit backup (or a bare ID array) and returns its validated IDs. */
export function parseProtectedBackup(text: string): string[] | undefined {
  let value: unknown;
  try { value = JSON.parse(text) as unknown; } catch { return undefined; }
  if (Array.isArray(value)) return sanitizeIds(value);
  if (typeof value === 'object' && value !== null && (value as Record<string, unknown>).kind === 'protected') {
    return sanitizeIds((value as Record<string, unknown>).ids);
  }
  return undefined;
}
