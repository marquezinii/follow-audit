import { parseFollowersPage, parseFollowingPage, wait, type AccountPage } from './core';

const FOLLOWING_QUERY = '3dec7e2c57367ef3da3d987d89f9dbc8';
const FOLLOWERS_QUERY = 'c76146de99bb02f6415203be841dd25a';

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

function listUrl(queryHash: string, cursor: string | undefined): URL {
  const userId = cookie('ds_user_id');
  if (!userId || !/^\d+$/.test(userId)) {
    throw new Error('The current Instagram session could not be identified.');
  }

  const variables: Record<string, unknown> = {
    id: userId,
    first: 50,
    include_reel: false,
    fetch_mutual: false,
  };
  if (cursor) {
    variables.after = cursor;
  }

  const url = new URL('/graphql/query/', location.origin);
  url.searchParams.set('query_hash', queryHash);
  url.searchParams.set('variables', JSON.stringify(variables));
  return url;
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
    return this.loadList(FOLLOWING_QUERY, cursor, signal, parseFollowingPage);
  }

  /** Loads one validated page of accounts following the current user. */
  async loadFollowers(cursor: string | undefined, signal: AbortSignal): Promise<AccountPage> {
    return this.loadList(FOLLOWERS_QUERY, cursor, signal, parseFollowersPage);
  }

  private async loadList(
    queryHash: string,
    cursor: string | undefined,
    signal: AbortSignal,
    parse: (payload: unknown) => AccountPage,
  ): Promise<AccountPage> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await request(listUrl(queryHash, cursor), {
          method: 'GET',
          credentials: 'include',
          headers: { accept: 'application/json' },
          signal,
        });
        if (!response.ok) {
          throw new HttpError(response.status);
        }
        return parse(await response.json());
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

    const response = await request(`/web/friendships/${encodeURIComponent(accountId)}/${action}/`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-csrftoken': csrf,
        'x-requested-with': 'XMLHttpRequest',
      },
      signal,
    });
    if (!response.ok) {
      throw new HttpError(response.status);
    }
  }
}
