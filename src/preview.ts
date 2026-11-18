import type { HistoryPoint, LogEntry } from './actions';
import { toSnapshot, wait, type Account, type FollowerSnapshot, type ListKind } from './core';

type Sample = readonly [id: string, username: string, name: string, isPrivate: boolean, isVerified: boolean, avatar: string];

const MUTUAL: readonly Sample[] = [
  ['102', 'liam.chen', 'Liam Chen', false, false, 'liam-chen.png'],
  ['104', 'isabellarossi', 'Isabella Rossi', false, false, 'isabella-rossi.png'],
  ['106', 'sophiedubois', 'Sophie Dubois', true, false, 'sophie-dubois.png'],
];
/** You follow them; they don't follow you. */
const NOT_FOLLOWING_BACK: readonly Sample[] = [
  ['101', 'avamartin', 'Ava Martin', false, true, 'ava-martin.png'],
  ['103', 'noahpatel', 'Noah Patel', true, false, 'noah-patel.png'],
  ['105', 'masonlee', 'Mason Lee', false, false, 'mason-lee.png'],
];
/** They follow you; you don't follow them. */
const FANS: readonly Sample[] = [
  ['109', 'oliver.kim', 'Oliver Kim', false, false, ''],
  ['110', 'mia.santos', 'Mia Santos', true, false, ''],
  ['111', 'theo.brooks', 'Theo Brooks', false, false, ''],
];

/** Deterministic sample data for local UI development. Never touches a real platform. */
export async function previewAccounts(kind: ListKind, readOnly: boolean, signal: AbortSignal): Promise<readonly Account[]> {
  await wait(500, signal);
  const base = new URL('./avatars/', location.href);
  const toAccount = ([id, username, name, isPrivate, isVerified, avatar]: Sample, mutual: boolean): Account => ({
    id: readOnly ? `tiktok:${username}` : id,
    username,
    name: readOnly ? '' : name,
    avatarUrl: readOnly || !avatar ? '' : new URL(avatar, base).href,
    followsYou: kind === 'followers' || mutual,
    youFollow: kind === 'following' || mutual,
    isPrivate: !readOnly && isPrivate,
    isVerified: !readOnly && isVerified,
  });
  const others = kind === 'following' ? NOT_FOLLOWING_BACK : FANS;
  return [...MUTUAL.map(sample => toAccount(sample, true)), ...others.map(sample => toAccount(sample, false))];
}

/** A previous audit with two extra followers, so the preview can demonstrate change tracking. */
export function previewBaseline(current: readonly Account[], readOnly: boolean): FollowerSnapshot {
  const extra = (id: string, username: string, name: string): Account => ({
    id: readOnly ? `tiktok:${username}` : id, username, name: readOnly ? '' : name, avatarUrl: '',
    followsYou: true, youFollow: false, isPrivate: false, isVerified: false,
  });
  return toSnapshot([...current, extra('107', 'emma.walsh', 'Emma Walsh'), extra('108', 'lucas.moreau', 'Lucas Moreau')], new Date(Date.now() - 7 * 86_400_000));
}

/** Two sent follow requests, so the preview can demonstrate the import and cancellation flow. */
export function previewRequests(): readonly Account[] {
  return [
    { id: '201', username: 'grace.hopper.fan', name: 'Grace Fan Club', avatarUrl: '', isPrivate: true, isVerified: false, followsYou: false, youFollow: false },
    { id: '202', username: 'quiet.studio', name: 'Quiet Studio', avatarUrl: '', isPrivate: true, isVerified: false, followsYou: false, youFollow: false },
  ];
}

/** Earlier audits for the history chart: a gentle, deterministic trend ending one week ago. */
export function previewHistory(): HistoryPoint[] {
  const followers = [5, 6, 6, 7, 8, 8];
  const following = [6, 6, 7, 7, 6, 6];
  return followers.map((count, index) => ({
    at: new Date(Date.now() - (followers.length - index + 0) * 7 * 86_400_000).toISOString(),
    followers: count,
    following: following[index] ?? 6,
    gained: index === 0 ? [] : count > (followers[index - 1] ?? count) ? ['new.follower'] : [],
    lost: index === 3 ? ['old.friend'] : [],
  }));
}

/** A short action log so the activity view and its undo are visible in the preview. */
export function previewLog(): LogEntry[] {
  const at = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();
  return [
    { at: at(9), action: 'unfollow', id: '301', username: 'old.brand', name: 'Old Brand', ok: true },
    { at: at(9), action: 'unfollow', id: '302', username: 'travel.deals', name: 'Travel Deals', ok: true },
    { at: at(8), action: 'remove', id: '303', username: 'spam.bot.42', name: '', ok: true },
    { at: at(2), action: 'follow', id: '109', username: 'oliver.kim', name: 'Oliver Kim', ok: false },
  ];
}
