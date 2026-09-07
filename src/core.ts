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
  if (!isObject(value)
    || typeof value.id !== 'string'
    || !/^\d+$/.test(value.id)
    || typeof value.username !== 'string'
    || typeof value.full_name !== 'string'
    || typeof value.profile_pic_url !== 'string'
    || typeof value.is_private !== 'boolean'
    || typeof value.is_verified !== 'boolean'
    || (kind === 'following' && typeof value.follows_viewer !== 'boolean')
    || (kind === 'followers' && typeof value.followed_by_viewer !== 'boolean')) {
    throw new Error('The response contains an invalid account.');
  }

  return {
    id: value.id,
    username: value.username,
    name: value.full_name,
    avatarUrl: value.profile_pic_url,
    isPrivate: value.is_private,
    isVerified: value.is_verified,
    followsYou: kind === 'followers' || value.follows_viewer as boolean,
    youFollow: kind === 'following' || value.followed_by_viewer as boolean,
  };
}

/**
 * Converts an untrusted Instagram payload into the minimal account model used by the UI.
 *
 * @throws {Error} When the payload does not match the expected following-page contract.
 */
function parseAccountPage(payload: unknown, kind: ListKind): AccountPage {
  if (!isObject(payload) || !isObject(payload.data) || !isObject(payload.data.user)) {
    throw new Error('Instagram did not return the expected data.');
  }

  const page = payload.data.user[kind === 'following' ? 'edge_follow' : 'edge_followed_by'];
  if (!isObject(page)
    || typeof page.count !== 'number'
    || !Number.isSafeInteger(page.count)
    || page.count < 0
    || !Array.isArray(page.edges)
    || !isObject(page.page_info)
    || typeof page.page_info.has_next_page !== 'boolean'
    || (page.page_info.end_cursor !== null && typeof page.page_info.end_cursor !== 'string')) {
    throw new Error(`The ${kind}-list response format has changed.`);
  }

  const accounts = page.edges.map(edge => {
    if (!isObject(edge)) {
      throw new Error('The response contains an invalid entry.');
    }
    return parseAccount(edge.node, kind);
  });

  return {
    accounts,
    total: page.count,
    nextCursor: page.page_info.has_next_page && page.page_info.end_cursor
      ? page.page_info.end_cursor
      : undefined,
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
    options.onProgress?.(accounts.size, page.total);
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
