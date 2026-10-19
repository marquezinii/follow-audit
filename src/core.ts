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

type PageLoader = (cursor: string | undefined, signal: AbortSignal) => Promise<AccountPage>;

interface ScanOptions {
  readonly maxPages?: number;
  readonly onProgress?: (loaded: number, total: number) => void;
}

interface RunOptions<T> {
  readonly delayMs: number;
  readonly batchSize: number;
  readonly batchDelayMs: number;
  readonly onResult?: (item: T, ok: boolean, completed: number, total: number, error?: unknown) => void;
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

/**
 * Loads every account page up to a fixed ceiling and deduplicates accounts by ID.
 *
 * @param loadPage Request boundary supplied by the caller.
 * @param signal Cancels the current request and the remaining pagination.
 * @param options Page ceiling and optional progress callback.
 * @throws {Error} When loading fails or the page ceiling is reached.
 */
export async function scanAccounts(
  loadPage: PageLoader,
  signal: AbortSignal,
  options: ScanOptions = {},
): Promise<readonly Account[]> {
  const accounts = new Map<string, Account>();
  const seenCursors = new Set<string>();
  const maxPages = options.maxPages ?? 2_000;
  let cursor: string | undefined;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    signal.throwIfAborted();
    if (cursor) {
      if (seenCursors.has(cursor)) {
        throw new Error('Instagram returned a repeated pagination cursor.');
      }
      seenCursors.add(cursor);
    }
    const page = await loadPage(cursor, signal);
    for (const account of page.accounts) {
      accounts.set(account.id, account);
    }
    options.onProgress?.(accounts.size, Math.max(page.total, accounts.size + (page.nextCursor ? 1 : 0)));
    cursor = page.nextCursor;
    if (!cursor) {
      return [...accounts.values()];
    }
  }

  throw new Error('The audit exceeded its safety page limit.');
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
 * Executes destructive actions one at a time, isolates item failures, and honors cancellation.
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
  for (let index = 0; index < items.length; index += 1) {
    signal.throwIfAborted();
    const item = items[index];
    if (item === undefined) {
      continue;
    }

    let error: unknown;
    try {
      await execute(item, signal);
    } catch (caught) {
      if (signal.aborted) {
        throw caught;
      }
      error = caught;
    }

    options.onResult?.(item, error === undefined, index + 1, items.length, error);
    if (index === items.length - 1) {
      continue;
    }

    const delay = (index + 1) % Math.max(1, options.batchSize) === 0
      ? options.batchDelayMs
      : options.delayMs;
    await wait(delay, signal);
  }
}
