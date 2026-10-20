export interface Account {
  readonly id: string;
  readonly username: string;
  readonly name: string;
  readonly avatarUrl: string;
  readonly isPrivate: boolean;
  readonly isVerified: boolean;
  readonly followsYou: boolean;
  readonly youFollow: boolean;
}

export interface AccountPage {
  readonly accounts: readonly Account[];
  readonly total: number;
  readonly nextCursor?: string;
}

export type ListKind = 'followers' | 'following';

export interface QueueTiming {
  readonly delayMs: number;
  readonly batchSize: number;
  readonly batchDelayMs: number;
}

interface RunOptions<T> extends QueueTiming {
  readonly onResult?: (item: T, ok: boolean, completed: number, total: number, error?: unknown) => void;
  /** Halts the queue after this many failures in a row. */
  readonly maxConsecutiveFailures?: number;
  /** Halts the queue immediately when an error signals that continuing is unsafe (rate limits, expired sessions). */
  readonly isFatal?: (error: unknown) => boolean;
}

/** Raised when the action queue stops itself to protect the account. */
export class QueueHaltedError extends Error {
  constructor(readonly cause: unknown, readonly completed: number) {
    super('The action queue stopped to protect the account.');
  }
}

/** Minimal, storable identity of an account at audit time. */
export interface SnapshotEntry {
  readonly id: string;
  readonly username: string;
  readonly name: string;
}

export interface FollowerSnapshot {
  readonly at: string;
  readonly accounts: readonly SnapshotEntry[];
}

export interface FollowerChanges {
  readonly since: string;
  readonly gained: readonly SnapshotEntry[];
  readonly lost: readonly SnapshotEntry[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseAccount(value: unknown, kind: ListKind): Account {
  const id = isObject(value) && (typeof value.pk === 'string' || (typeof value.pk === 'number' && Number.isSafeInteger(value.pk)))
    ? String(value.pk)
    : '';
  const relationship = isObject(value) ? value.friendship_status : undefined;
  if (!isObject(value)
    || !/^\d+$/.test(id)
    || typeof value.username !== 'string'
    || typeof value.full_name !== 'string'
    || typeof value.profile_pic_url !== 'string'
    || typeof value.is_private !== 'boolean'
    || typeof value.is_verified !== 'boolean'
    || !isObject(relationship)
    || typeof relationship.following !== 'boolean'
    || typeof relationship.followed_by !== 'boolean') {
    throw new Error('The response contains an invalid account.');
  }

  return {
    id,
    username: value.username,
    name: value.full_name,
    avatarUrl: value.profile_pic_url,
    isPrivate: value.is_private,
    isVerified: value.is_verified,
    followsYou: kind === 'followers' || relationship.followed_by,
    youFollow: kind === 'following' || relationship.following,
  };
}

/**
 * Converts an untrusted Instagram payload into the minimal account model used by the UI.
 *
 * @throws {Error} When the payload does not match the expected following-page contract.
 */
function parseAccountPage(payload: unknown, kind: ListKind): AccountPage {
  if (!isObject(payload)
    || payload.status !== 'ok'
    || !Array.isArray(payload.users)
    || (payload.next_max_id !== null && payload.next_max_id !== undefined && typeof payload.next_max_id !== 'string')) {
    throw new Error('Instagram did not return the expected data.');
  }

  const accounts = payload.users.map(user => parseAccount(user, kind));

  return {
    accounts,
    total: accounts.length,
    nextCursor: payload.next_max_id || undefined,
  };
}

export function parseFollowingPage(payload: unknown): AccountPage {
  return parseAccountPage(payload, 'following');
}

export function parseFollowersPage(payload: unknown): AccountPage {
  return parseAccountPage(payload, 'followers');
}

/** Waits for a non-negative duration and rejects immediately when cancelled. */
export async function wait(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new DOMException('Cancelled', 'AbortError'));
    };
    const timer = setTimeout(finish, Math.max(0, ms));
    signal.addEventListener('abort', abort, { once: true });
  });
}

/**
 * Executes destructive actions one at a time, isolates item failures, halts on unsafe errors, and honors cancellation.
 *
 * @param items Immutable queue snapshot.
 * @param execute Action boundary. It is called exactly once per item.
 * @param signal Cancels the active action or the next delay.
 * @param options Timing and per-item result reporting.
 */
export async function runSequential<T>(
  items: readonly T[],
  execute: (item: T, signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
  options: RunOptions<T>,
): Promise<void> {
  let failures = 0;
  for (let index = 0; index < items.length; index += 1) {
    signal.throwIfAborted();
    const item = items[index];
    if (item === undefined) {
      continue;
    }

    let error: unknown;
    try {
      await execute(item, signal);
      failures = 0;
    } catch (caught) {
      if (signal.aborted) {
        throw caught;
      }
      error = caught;
      failures += 1;
    }

    options.onResult?.(item, error === undefined, index + 1, items.length, error);
    if (error !== undefined && (options.isFatal?.(error) || failures >= (options.maxConsecutiveFailures ?? Infinity))) {
      throw new QueueHaltedError(error, index + 1);
    }
    if (index === items.length - 1) {
      continue;
    }

    const delay = (index + 1) % Math.max(1, options.batchSize) === 0
      ? options.batchDelayMs
      : options.delayMs;
    await wait(delay, signal);
  }
}

/** Estimates the waiting time left in a queue after `completed` of `total` items. */
export function estimateRemainingMs(completed: number, total: number, timing: QueueTiming): number {
  let remaining = 0;
  for (let index = Math.max(0, completed - 1); index < total - 1; index += 1) {
    remaining += (index + 1) % Math.max(1, timing.batchSize) === 0 ? timing.batchDelayMs : timing.delayMs;
  }
  return remaining;
}

export function toSnapshot(accounts: readonly Account[], at: Date): FollowerSnapshot {
  return { at: at.toISOString(), accounts: accounts.map(({ id, username, name }) => ({ id, username, name })) };
}

/** Validates a snapshot read back from untrusted local storage. */
export function parseSnapshot(value: unknown): FollowerSnapshot | undefined {
  if (!isObject(value) || typeof value.at !== 'string' || Number.isNaN(Date.parse(value.at)) || !Array.isArray(value.accounts)) {
    return undefined;
  }
  const accounts = value.accounts.filter((entry): entry is SnapshotEntry => isObject(entry)
    && typeof entry.id === 'string' && entry.id.length > 0 && entry.id.length <= 80
    && typeof entry.username === 'string' && entry.username.length <= 64
    && typeof entry.name === 'string' && entry.name.length <= 200);
  return accounts.length === value.accounts.length ? { at: value.at, accounts } : undefined;
}

/** Compares the previous follower snapshot with a fresh audit. */
export function diffSnapshot(previous: FollowerSnapshot, current: readonly Account[]): FollowerChanges {
  const currentIds = new Set(current.map(account => account.id));
  const previousIds = new Set(previous.accounts.map(entry => entry.id));
  return {
    since: previous.at,
    gained: current.filter(account => !previousIds.has(account.id)).map(({ id, username, name }) => ({ id, username, name })),
    lost: previous.accounts.filter(entry => !currentIds.has(entry.id)),
  };
}

/** Serializes accounts as CSV, neutralizing spreadsheet formula injection. */
export function toCsv(accounts: readonly Account[]): string {
  const cell = (value: string | boolean): string => {
    const raw = String(value);
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = accounts.map(account => [account.id, account.username, account.name, account.followsYou, account.youFollow, account.isPrivate, account.isVerified].map(cell).join(','));
  return ['id,username,name,follows_you,you_follow,private,verified', ...rows].join('\r\n');
}

const MAX_STORED_IDS = 10_000;

/** Keeps only plausible account IDs from untrusted storage or an imported backup. */
export function sanitizeIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 80 && ![...id].some(character => character.charCodeAt(0) < 32))
    .slice(0, MAX_STORED_IDS);
}
