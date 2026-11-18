import type { Account } from './core';

/** Every account change FollowAudit can make on Instagram. */
export type ActionKind = 'unfollow' | 'remove' | 'follow' | 'cancel';
export const ACTION_KINDS: readonly ActionKind[] = ['unfollow', 'remove', 'follow', 'cancel'];

/** The minimal account identity a queue or log needs after the audit is gone. */
export interface QueueItem {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly avatarUrl: string;
}

/** A confirmed queue kept in storage so it can be resumed after the tab is closed or reloaded. */
export interface SavedQueue {
  readonly version: 1;
  readonly owner: string;
  readonly action: ActionKind;
  readonly items: readonly QueueItem[];
  /** How many items, from the start, were already processed. */
  readonly done: number;
  readonly createdAt: string;
}

export interface LogEntry {
  readonly at: string;
  readonly action: ActionKind;
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly ok: boolean;
}

export interface HistoryPoint {
  readonly at: string;
  readonly followers: number;
  readonly following: number;
  readonly gained: readonly string[];
  readonly lost: readonly string[];
}

const MAX_QUEUE_ITEMS = 10_000;
const MAX_LOG_ENTRIES = 3_000;
const MAX_HISTORY_POINTS = 240;
const MAX_NAMES_PER_POINT = 200;
/** Accounts imported from an export are known only by username until the queue resolves their ID. */
export const USERNAME_ID_PREFIX = 'username:';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 80
  && (/^\d+$/.test(value) || (value.startsWith(USERNAME_ID_PREFIX) && isUsername(value.slice(USERNAME_ID_PREFIX.length))));
const validDate = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const shortText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const isAction = (value: unknown): value is ActionKind => ACTION_KINDS.includes(value as ActionKind);

export function isUsername(value: string): boolean {
  return /^[A-Za-z0-9._]{1,30}$/.test(value);
}

export function toQueueItem({ id, username, name, avatarUrl }: Pick<QueueItem, 'id' | 'username' | 'name'> & { readonly avatarUrl?: string }): QueueItem {
  return { id, username, name, avatarUrl: avatarUrl ?? '' };
}

function parseItem(value: unknown): QueueItem | undefined {
  if (!isObject(value) || !validId(value.id) || !shortText(value.username, 64) || !shortText(value.name, 200)
    || !shortText(value.avatarUrl, 2_000)) return undefined;
  // Avatar URLs are rendered as <img src>, so only platform HTTPS URLs survive storage.
  const avatarUrl = /^https:\/\/[^/]+\.(cdninstagram\.com|fbcdn\.net)\//.test(value.avatarUrl) ? value.avatarUrl : '';
  return { id: value.id, username: value.username, name: value.name, avatarUrl };
}

export function savedQueue(owner: string, action: ActionKind, items: readonly QueueItem[], done = 0, createdAt = new Date()): SavedQueue {
  return { version: 1, owner, action, items: items.slice(0, MAX_QUEUE_ITEMS).map(toQueueItem), done, createdAt: createdAt.toISOString() };
}

/** Validates a queue read back from untrusted storage. */
export function parseSavedQueue(value: unknown): SavedQueue | undefined {
  if (!isObject(value) || value.version !== 1 || typeof value.owner !== 'string' || !isAction(value.action)
    || !Array.isArray(value.items) || value.items.length > MAX_QUEUE_ITEMS || !validDate(value.createdAt)
    || typeof value.done !== 'number' || !Number.isSafeInteger(value.done) || value.done < 0 || value.done > value.items.length) {
    return undefined;
  }
  const items = value.items.map(parseItem);
  if (items.some(item => item === undefined)) return undefined;
  return { version: 1, owner: value.owner, action: value.action, items: items as QueueItem[], done: value.done, createdAt: value.createdAt };
}

export function remainingItems(queue: SavedQueue): readonly QueueItem[] {
  return queue.items.slice(queue.done);
}

/** Validates the action log, dropping malformed entries instead of failing the whole log. */
export function parseLog(value: unknown): LogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is LogEntry => isObject(entry) && validDate(entry.at) && isAction(entry.action) && validId(entry.id)
    && shortText(entry.username, 64) && shortText(entry.name, 200) && typeof entry.ok === 'boolean').slice(-MAX_LOG_ENTRIES);
}

export function appendLog(log: readonly LogEntry[], entry: LogEntry): LogEntry[] {
  return [...log, entry].slice(-MAX_LOG_ENTRIES);
}

/** Unfollows that succeeded and were not followed again afterwards: the only actions FollowAudit can undo. */
export function undoableUnfollows(log: readonly LogEntry[]): LogEntry[] {
  const latest = new Map<string, LogEntry>();
  for (const entry of log) if (entry.ok && (entry.action === 'unfollow' || entry.action === 'follow')) latest.set(entry.id, entry);
  return [...latest.values()].filter(entry => entry.action === 'unfollow').reverse();
}

export function parseHistory(value: unknown): HistoryPoint[] {
  if (!Array.isArray(value)) return [];
  const names = (list: unknown): list is string[] => Array.isArray(list) && list.length <= MAX_NAMES_PER_POINT
    && list.every(name => shortText(name, 64));
  const count = (number: unknown): number is number => typeof number === 'number' && Number.isSafeInteger(number) && number >= 0;
  return value.filter((point): point is HistoryPoint => isObject(point) && validDate(point.at) && count(point.followers)
    && count(point.following) && names(point.gained) && names(point.lost)).slice(-MAX_HISTORY_POINTS);
}

export function appendHistory(history: readonly HistoryPoint[], point: HistoryPoint): HistoryPoint[] {
  const capped: HistoryPoint = { ...point, gained: point.gained.slice(0, MAX_NAMES_PER_POINT), lost: point.lost.slice(0, MAX_NAMES_PER_POINT) };
  return [...history, capped].slice(-MAX_HISTORY_POINTS);
}

/** Spreads a delay over ±30% so the queue does not act on a machine-perfect rhythm. */
export function jitter(ms: number, random: () => number = Math.random): number {
  return Math.round(ms * (0.7 + random() * 0.6));
}

/**
 * How long to wait before the next action so no more than `cap` actions happen in any rolling hour.
 *
 * @param timestamps Times (ms) of earlier actions, in any order.
 */
export function hourlyWaitMs(timestamps: readonly number[], now: number, cap: number): number {
  if (cap <= 0) return 0;
  const recent = timestamps.filter(time => time > now - 3_600_000 && time <= now).sort((a, b) => a - b);
  if (recent.length < cap) return 0;
  const oldestInWindow = recent[recent.length - cap];
  return oldestInWindow === undefined ? 0 : Math.max(0, oldestInWindow + 3_600_000 - now);
}

/**
 * Reads the usernames of follow requests you sent from Instagram's "Download your information" export
 * (pending_follow_requests.json, JSON format).
 *
 * @throws {Error} When no file contains sent follow requests.
 */
export function parsePendingRequestsExport(sources: readonly { readonly name: string; readonly content: string }[]): string[] {
  const usernames = new Set<string>();
  let recognized = false;
  for (const source of sources) {
    let value: unknown;
    try { value = JSON.parse(source.content) as unknown; } catch { continue; }
    const fromFileName = /pending_follow_requests/i.test(source.name);
    const entries = isObject(value) && Array.isArray(value.relationships_follow_requests_sent)
      ? value.relationships_follow_requests_sent
      : fromFileName && Array.isArray(value) ? value : undefined;
    if (!entries) continue;
    recognized = true;
    for (const entry of entries) {
      const username = requestUsername(entry);
      if (username) usernames.add(username);
    }
  }
  if (!recognized) throw new Error('No sent follow requests were found in the selected files.');
  return [...usernames];
}

function requestUsername(entry: unknown): string | undefined {
  if (!isObject(entry)) return undefined;
  const data = Array.isArray(entry.string_list_data) ? entry.string_list_data.find(isObject) : undefined;
  const candidates = [data?.value, typeof entry.title === 'string' && entry.title ? entry.title : undefined, data?.href];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const fromUrl = /instagram\.com\/(?:_u\/)?([A-Za-z0-9._]{1,30})\/?(?:[?#]|$)/.exec(candidate)?.[1];
    const username = (fromUrl ?? candidate).trim().replace(/^@/, '');
    if (isUsername(username)) return username;
  }
  return undefined;
}

/** An account known only from an export, waiting for its numeric ID. */
export function requestAccount(username: string): Account {
  return {
    id: `${USERNAME_ID_PREFIX}${username}`, username, name: '', avatarUrl: '',
    isPrivate: true, isVerified: false, followsYou: false, youFollow: false,
  };
}

export function toJson(accounts: readonly Account[], meta: Record<string, string>): string {
  return JSON.stringify({
    app: 'FollowAudit', ...meta, exportedAt: new Date().toISOString(),
    accounts: accounts.map(account => ({ ...account, hasAnonymousAvatar: Boolean(account.hasAnonymousAvatar), profileUrl: `https://www.instagram.com/${account.username}/` })),
  }, null, 2);
}
