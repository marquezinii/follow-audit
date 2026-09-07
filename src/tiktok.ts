import type { Account, ListKind } from './core';

export interface TikTokExportSource {
  readonly name: string;
  readonly content: string;
}

export interface TikTokLists {
  readonly followers: readonly Account[];
  readonly following: readonly Account[];
}

/** Returns accounts that still need a human review in TikTok. */
export function pendingTikTokReviewAccounts(
  accounts: readonly Account[],
  protectedIds: ReadonlySet<string>,
  reviewedIds: ReadonlySet<string>,
): readonly Account[] {
  return accounts.filter(account => account.youFollow && !account.followsYou
    && !protectedIds.has(account.id) && !reviewedIds.has(account.id));
}

const LIST_KEYS: Record<ListKind, ReadonlySet<string>> = {
  followers: new Set(['follower', 'followers', 'followerlist', 'followerslist', 'fan', 'fans', 'fanslist']),
  following: new Set(['following', 'followinglist']),
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function listKind(value: string): ListKind | undefined {
  const key = normalizedKey(value.replace(/\.json$/i, ''));
  if (LIST_KEYS.following.has(key) || key.endsWith('followinglist')) return 'following';
  if (LIST_KEYS.followers.has(key) || key.endsWith('followerlist') || key.endsWith('fanslist')) return 'followers';
  return undefined;
}

function cleanUsername(value: string): string | undefined {
  let candidate = value.trim();
  const urlMatch = candidate.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([^/?#\s]+)/i);
  if (urlMatch?.[1]) candidate = urlMatch[1];
  candidate = candidate.replace(/^@/, '').trim();
  try { candidate = decodeURIComponent(candidate); } catch { return undefined; }
  return /^[A-Za-z0-9._]{1,64}$/.test(candidate) ? candidate : undefined;
}

function entryUsername(value: unknown): string | undefined {
  if (typeof value === 'string') return cleanUsername(value);
  if (!isObject(value)) return undefined;

  for (const [key, candidate] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (typeof candidate === 'string' && (normalized === 'username' || normalized === 'user' || normalized === 'link')) {
      const username = cleanUsername(candidate);
      if (username) return username;
    }
  }
  return undefined;
}

function collect(
  value: unknown,
  inheritedKind: ListKind | undefined,
  found: Record<ListKind, boolean>,
  usernames: Record<ListKind, Map<string, string>>,
): void {
  if (Array.isArray(value)) {
    if (inheritedKind) {
      found[inheritedKind] = true;
      for (const entry of value) {
        const username = entryUsername(entry);
        if (username) usernames[inheritedKind].set(username.toLowerCase(), username);
      }
    }
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    collect(child, listKind(key) ?? inheritedKind, found, usernames);
  }
}

function account(username: string, followsYou: boolean, youFollow: boolean): Account {
  return {
    id: `tiktok:${username.toLowerCase()}`,
    username,
    name: '',
    avatarUrl: '',
    isPrivate: false,
    isVerified: false,
    followsYou,
    youFollow,
  };
}

/** Parses the extracted JSON files from TikTok's official data export. */
export function parseTikTokExport(sources: readonly TikTokExportSource[]): TikTokLists {
  if (sources.length === 0 || sources.length > 20) throw new Error('Select the TikTok follower and following JSON files.');
  if (sources.reduce((total, source) => total + source.content.length, 0) > 50_000_000) {
    throw new Error('The selected TikTok export is too large.');
  }

  const found: Record<ListKind, boolean> = { followers: false, following: false };
  const usernames: Record<ListKind, Map<string, string>> = { followers: new Map(), following: new Map() };
  for (const source of sources) {
    let payload: unknown;
    try { payload = JSON.parse(source.content) as unknown; }
    catch { throw new Error(`${source.name} is not valid JSON.`); }
    collect(payload, listKind(source.name), found, usernames);
  }

  if (!found.followers || !found.following) {
    throw new Error('The TikTok follower and following lists were not both found.');
  }

  const followers = usernames.followers;
  const following = usernames.following;
  return {
    followers: [...followers].map(([key, username]) => account(username, true, following.has(key))),
    following: [...following].map(([key, username]) => account(username, followers.has(key), true)),
  };
}
