import { parseFollowersPage, parseFollowingPage, wait, type AccountPage } from './core';

const WEB_APP_ID = '936619743392459';

type ListName = 'followers' | 'following';

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`Instagram responded with HTTP ${status}.`);
  }
}

function cookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const part = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix));
  return part ? decodeURIComponent(part.slice(prefix.length)) : undefined;
}

function listUrl(kind: ListName, cursor: string | undefined): URL {
  const userId = cookie('ds_user_id');
  if (!userId || !/^\d+$/.test(userId)) {
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

/** Authenticated request boundary for the private Instagram web endpoints used by Follow Audit. */
export class InstagramGateway {
  /** Loads one validated page of accounts followed by the current user. */
  async loadFollowing(cursor: string | undefined, signal: AbortSignal): Promise<AccountPage> {
    return this.loadList('following', cursor, signal, parseFollowingPage);
  }

  /** Loads one validated page of accounts following the current user. */
  async loadFollowers(cursor: string | undefined, signal: AbortSignal): Promise<AccountPage> {
    return this.loadList('followers', cursor, signal, parseFollowersPage);
  }

  private readonly relatedIds = new Map<ListName, Promise<Set<string>>>();

  private async loadList(
    kind: ListName,
    cursor: string | undefined,
    signal: AbortSignal,
    parse: (payload: unknown) => AccountPage,
  ): Promise<AccountPage> {
    const payload = await this.fetchPage(kind, cursor, signal);
    if (usersOf(payload).every(hasRelationship)) {
      return parse(payload);
    }

    const other = kind === 'following' ? 'followers' : 'following';
    if (!cursor) this.relatedIds.delete(other);
    let ids = this.relatedIds.get(other);
    if (!ids) {
      ids = this.collectIds(other, signal);
      this.relatedIds.set(other, ids);
      ids.catch(() => this.relatedIds.delete(other));
    }
    return parse(withRelationships(payload, kind, await ids));
  }

  private async collectIds(kind: ListName, signal: AbortSignal): Promise<Set<string>> {
    const ids = new Set<string>();
    const seen = new Set<string>();
    let cursor: string | undefined;
    do {
      const payload = await this.fetchPage(kind, cursor, signal);
      for (const user of usersOf(payload)) ids.add(userId(user));
      const next = isObject(payload) && typeof payload.next_max_id === 'string' && payload.next_max_id ? payload.next_max_id : undefined;
      if (next && seen.has(next)) throw new Error('Instagram returned a repeated pagination cursor.');
      if (next) seen.add(next);
      cursor = next;
    } while (cursor);
    return ids;
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
  }
}
