import { parseFollowersPage, parseFollowingPage, wait, type AccountPage } from './core';

const WEB_APP_ID = '936619743392459';

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

function listUrl(kind: 'followers' | 'following', cursor: string | undefined): URL {
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

function accountsMissingRelationships(payload: unknown): string[] {
  if (!isObject(payload) || !Array.isArray(payload.users)) return [];
  return payload.users.flatMap(user => {
    if (!isObject(user)) return [];
    const id = typeof user.pk === 'string' || (typeof user.pk === 'number' && Number.isSafeInteger(user.pk)) ? String(user.pk) : '';
    const status = user.friendship_status;
    return /^\d+$/.test(id) && (!isObject(status) || typeof status.following !== 'boolean' || typeof status.followed_by !== 'boolean')
      ? [id]
      : [];
  });
}

function mergeRelationships(payload: unknown, statuses: unknown): unknown {
  if (!isObject(payload) || !Array.isArray(payload.users) || !isObject(statuses)) return payload;
  return {
    ...payload,
    users: payload.users.map((user: unknown) => {
      if (!isObject(user)) return user;
      const relationship = statuses[String(user.pk)];
      return isObject(relationship) ? { ...user, friendship_status: relationship } : user;
    }),
  };
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

  private async loadList(
    kind: 'followers' | 'following',
    cursor: string | undefined,
    signal: AbortSignal,
    parse: (payload: unknown) => AccountPage,
  ): Promise<AccountPage> {
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
        let payload = await response.json() as unknown;
        const missing = accountsMissingRelationships(payload);
        if (missing.length > 0) {
          const csrf = cookie('csrftoken');
          if (!csrf) throw new Error('The current session has no CSRF token.');
          const relationshipsResponse = await request('/api/v1/friendships/show_many/', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'x-csrftoken': csrf,
              'x-ig-app-id': WEB_APP_ID,
              'x-requested-with': 'XMLHttpRequest',
            },
            body: new URLSearchParams({ user_ids: missing.join(',') }),
            signal,
          });
          if (!relationshipsResponse.ok) throw new HttpError(relationshipsResponse.status);
          const relationshipsPayload = await relationshipsResponse.json() as unknown;
          payload = mergeRelationships(payload, isObject(relationshipsPayload) ? relationshipsPayload.friendship_statuses : undefined);
        }
        return parse(payload);
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
