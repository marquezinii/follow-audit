import { parseFollowersPage, parseFollowingPage, wait, type Account } from './core';

const WEB_APP_ID = '936619743392459';

type ListName = 'followers' | 'following';

export class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Instagram responded with HTTP ${status}.`);
  }
}

/** Instagram refused an action (rate limit, spam check, or challenge). Continuing would make it worse. */
export class ActionBlockedError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** True when an action error means the queue must stop instead of moving to the next account. */
export function isBlockingError(error: unknown): boolean {
  return error instanceof ActionBlockedError
    || (error instanceof HttpError && [400, 401, 403, 429].includes(error.status));
}

/** Returns the signed-in Instagram user ID, if a session is present. */
export function currentUserId(): string | undefined {
  const id = cookie('ds_user_id');
  return id && /^\d+$/.test(id) ? id : undefined;
}

function cookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const part = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : undefined;
}

function listUrl(kind: ListName, cursor: string | undefined): URL {
  const userId = currentUserId();
  if (!userId) {
    throw new Error('The current Instagram session could not be identified.');
  }

  const url = new URL(`/api/v1/friendships/${userId}/${kind}/`, location.origin);
  url.searchParams.set('count', '50');
  if (cursor) url.searchParams.set('max_id', cursor);
  return url;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function userId(user: Record<string, unknown>): string {
  return typeof user.pk === 'string' || (typeof user.pk === 'number' && Number.isSafeInteger(user.pk)) ? String(user.pk) : '';
}

function hasRelationship(user: Record<string, unknown>): boolean {
  const status = user.friendship_status;
  return isObject(status) && typeof status.following === 'boolean' && typeof status.followed_by === 'boolean';
}

function usersOf(payload: unknown): Record<string, unknown>[] {
  if (!isObject(payload) || !Array.isArray(payload.users)) {
    throw new Error('Instagram did not return the expected data.');
  }
  return payload.users.filter(isObject);
}

/** The web list endpoints omit friendship_status, so the opposite list supplies it. */
function withRelationships(payload: unknown, kind: ListName, otherIds: ReadonlySet<string>): unknown {
  const users = usersOf(payload).map(user => {
    if (hasRelationship(user)) return user;
    const inOther = otherIds.has(userId(user));
    return { ...user, friendship_status: kind === 'following' ? { following: true, followed_by: inOther } : { followed_by: true, following: inOther } };
  });
  return { ...(payload as Record<string, unknown>), users };
}

async function request(url: URL | string, init: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const callerSignal = init.signal;
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (callerSignal) {
    signals.push(callerSignal);
  }
  return fetch(url, { ...init, signal: AbortSignal.any(signals) });
}

export interface AuditLists {
  readonly following: readonly Account[];
  readonly followers: readonly Account[];
}

const MAX_PAGES = 2_000;

/** Authenticated request boundary for the private Instagram web endpoints used by FollowAudit. */
export class InstagramGateway {
  /**
   * Loads both lists exactly once and derives every relationship locally.
   *
   * @param onProgress Called after each page with the list being loaded and its running total.
   * @throws {Error} When loading fails, the payload is malformed, or pagination loops.
   */
  async audit(signal: AbortSignal, onProgress?: (kind: ListName, loaded: number) => void): Promise<AuditLists> {
    const following = await this.collectUsers('following', signal, onProgress);
    const followers = await this.collectUsers('followers', signal, onProgress);
    const ids = (users: readonly Record<string, unknown>[]): Set<string> => new Set(users.map(userId));
    return {
      following: parseFollowingPage(withRelationships({ status: 'ok', users: following }, 'following', ids(followers))).accounts,
      followers: parseFollowersPage(withRelationships({ status: 'ok', users: followers }, 'followers', ids(following))).accounts,
    };
  }

  private async collectUsers(kind: ListName, signal: AbortSignal, onProgress?: (kind: ListName, loaded: number) => void): Promise<Record<string, unknown>[]> {
    const users = new Map<string, Record<string, unknown>>();
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      signal.throwIfAborted();
      const payload = await this.fetchPage(kind, cursor, signal);
      for (const user of usersOf(payload)) users.set(userId(user), user);
      onProgress?.(kind, users.size);
      const next = isObject(payload) && typeof payload.next_max_id === 'string' && payload.next_max_id ? payload.next_max_id : undefined;
      if (!next) return [...users.values()];
      if (seen.has(next)) throw new Error('Instagram returned a repeated pagination cursor.');
      seen.add(next);
      cursor = next;
    }
    throw new Error('The audit exceeded its safety page limit.');
  }

  private async fetchPage(kind: ListName, cursor: string | undefined, signal: AbortSignal): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await request(listUrl(kind, cursor), {
          method: 'GET',
          credentials: 'include',
          headers: { accept: 'application/json', 'x-ig-app-id': WEB_APP_ID },
          signal,
        });
        if (!response.ok) {
          throw new HttpError(response.status);
        }
        return await response.json() as unknown;
      } catch (error) {
        if (signal.aborted) {
          throw error;
        }
        const retryable = !(error instanceof HttpError) || error.status === 429 || error.status >= 500;
        if (!retryable || attempt === 2) {
          throw error;
        }
        await wait(1_000 * 2 ** attempt, signal);
      }
    }
    throw new Error('The accounts could not be loaded.');
  }

  /** Removes one follower without retrying the destructive request. */
  async removeFollower(accountId: string, signal: AbortSignal): Promise<void> {
    await this.changeRelationship(accountId, 'remove_follower', signal);
  }

  /** Performs one unfollow request without retrying it. */
  async unfollow(accountId: string, signal: AbortSignal): Promise<void> {
    await this.changeRelationship(accountId, 'unfollow', signal);
  }

  private async changeRelationship(accountId: string, action: 'remove_follower' | 'unfollow', signal: AbortSignal): Promise<void> {
    if (!/^\d+$/.test(accountId)) {
      throw new Error('Invalid account ID.');
    }
    const csrf = cookie('csrftoken');
    if (!csrf) {
      throw new Error('The current session has no CSRF token.');
    }

    const encodedId = encodeURIComponent(accountId);
    const url = action === 'remove_follower'
      ? `/api/v1/friendships/remove_follower/${encodedId}/`
      : `/web/friendships/${encodedId}/unfollow/`;
    const response = await request(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-csrftoken': csrf,
        'x-ig-app-id': WEB_APP_ID,
        'x-requested-with': 'XMLHttpRequest',
      },
      signal,
    });
    if (!response.ok) {
      throw new HttpError(response.status);
    }
    await assertActionAccepted(response);
  }
}

/** Instagram can answer HTTP 200 with a refusal body (feedback_required, spam, challenge). */
async function assertActionAccepted(response: Response): Promise<void> {
  // A login or checkpoint page served with HTTP 200 means the action did not happen.
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new ActionBlockedError('Instagram answered with a web page instead of confirming the action.');
  }
  let body: unknown;
  try {
    body = await response.json() as unknown;
  } catch {
    return;
  }
  if (!isObject(body) || body.status === undefined || body.status === 'ok') {
    return;
  }
  const reason = [body.feedback_title, body.message, body.status].find(value => typeof value === 'string' && value.length > 0);
  throw new ActionBlockedError(`Instagram refused the action: ${String(reason).slice(0, 160)}`);
}
