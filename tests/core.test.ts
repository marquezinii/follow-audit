import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFollowersPage, parseFollowingPage, runSequential, scanAccounts, type Account } from '../src/core';
import { format, resolveLocale, translations } from '../src/i18n';
import { InstagramGateway } from '../src/instagram';
import { parseTikTokExport, pendingTikTokReviewAccounts } from '../src/tiktok';

const account = (id: string): Account => ({
  id,
  username: `account_${id}`,
  name: `Account ${id}`,
  avatarUrl: 'https://example.test/avatar.png',
  isPrivate: false,
  isVerified: false,
  followsYou: false,
  youFollow: true,
});

void test('parses valid pages and rejects malformed responses', () => {
  const result = parseFollowingPage({
    users: [{
      pk: '10', username: 'account_10', full_name: 'Account 10', profile_pic_url: 'https://example.test/avatar.png',
      is_private: false, is_verified: true, friendship_status: { followed_by: false, following: true },
    }],
    next_max_id: null,
    status: 'ok',
  });

  assert.equal(result.accounts[0]?.name, 'Account 10');
  assert.throws(() => parseFollowingPage({ users: [], status: 'fail' }));
  assert.throws(() => parseFollowingPage({ users: [], next_max_id: 123, status: 'ok' }));
});

void test('parses followers and records whether you follow them back', () => {
  const result = parseFollowersPage({
    users: [{
      pk: 11, username: 'account_11', full_name: 'Account 11', profile_pic_url: 'https://example.test/avatar.png',
      is_private: false, is_verified: false, friendship_status: { followed_by: true, following: false },
    }],
    next_max_id: null,
    status: 'ok',
  });

  assert.equal(result.accounts[0]?.followsYou, true);
  assert.equal(result.accounts[0]?.youFollow, false);
});

void test('deduplicates accounts across pages', async () => {
  let page = 0;
  const result = await scanAccounts(() => {
    page += 1;
    return Promise.resolve(page === 1
      ? { accounts: [account('1')], total: 2, nextCursor: 'next' }
      : { accounts: [account('1'), account('2')], total: 2 });
  }, new AbortController().signal);

  assert.deepEqual(result.map(item => item.id), ['1', '2']);
});

void test('stops when Instagram repeats a pagination cursor', async () => {
  let requests = 0;
  await assert.rejects(scanAccounts(() => {
    requests += 1;
    return Promise.resolve({ accounts: [], total: 1, nextCursor: 'same' });
  }, new AbortController().signal), /repeated pagination cursor/);

  assert.equal(requests, 2);
});

void test('continues the queue after an individual failure', async () => {
  const outcomes: boolean[] = [];
  const errors: unknown[] = [];
  await runSequential(['a', 'b', 'c'], item => {
    return item === 'b' ? Promise.reject(new Error('expected failure')) : Promise.resolve();
  }, new AbortController().signal, {
    delayMs: 0,
    batchSize: 5,
    batchDelayMs: 0,
    onResult: (_item, ok, _completed, _total, error) => { outcomes.push(ok); errors.push(error); },
  });

  assert.deepEqual(outcomes, [true, false, true]);
  assert.match(String(errors[1]), /expected failure/);
});

void test('cancellation interrupts the queue delay', async () => {
  const controller = new AbortController();
  const run = runSequential(['a', 'b'], () => Promise.resolve(), controller.signal, {
    delayMs: 10_000,
    batchSize: 5,
    batchDelayMs: 0,
  });
  setTimeout(() => controller.abort(), 5);

  await assert.rejects(run, /abort|cancel/i);
});

void test('identifies follower-removal requests as the Instagram web client', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFetch = globalThis.fetch;
  let url: string | undefined;
  let headers: Headers | undefined;

  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'csrftoken=test-token' } });
  globalThis.fetch = (input, init) => {
    if (typeof input !== 'string') throw new Error('Expected a string URL.');
    url = input;
    headers = new Headers(init?.headers);
    return Promise.resolve(new Response('', { status: 200 }));
  };

  try {
    await new InstagramGateway().removeFollower('12', new AbortController().signal);
    assert.equal(url, '/api/v1/friendships/remove_follower/12/');
    assert.equal(headers?.get('x-ig-app-id'), '936619743392459');
    assert.equal(headers?.get('x-csrftoken'), 'test-token');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

void test('loads following accounts from the current Instagram friendship endpoint', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; init?: RequestInit }> = [];

  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'ds_user_id=42; csrftoken=test-token' } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://www.instagram.com' } });
  globalThis.fetch = (input, init) => {
    const requestUrl = input instanceof Request ? input.url : input;
    requests.push({ url: new URL(requestUrl, 'https://www.instagram.com'), init });
    return Promise.resolve(requests.length === 1
      ? Response.json({
        users: [{
          pk: '10', username: 'account_10', full_name: 'Account 10', profile_pic_url: 'https://example.test/avatar.png',
          is_private: false, is_verified: true,
        }],
        next_max_id: 'next',
        status: 'ok',
      })
      : Response.json({ friendship_statuses: { 10: { followed_by: false, following: true } }, status: 'ok' }));
  };

  try {
    const page = await new InstagramGateway().loadFollowing(undefined, new AbortController().signal);
    assert.equal(requests[0]?.url.pathname, '/api/v1/friendships/42/following/');
    assert.equal(requests[0]?.url.searchParams.get('count'), '50');
    assert.equal(requests[1]?.url.pathname, '/api/v1/friendships/show_many/');
    assert.ok(requests[1]?.init?.body instanceof URLSearchParams);
    assert.equal(requests[1].init.body.get('user_ids'), '10');
    assert.equal(page.accounts[0]?.username, 'account_10');
    assert.equal(page.accounts[0]?.followsYou, false);
    assert.equal(page.nextCursor, 'next');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});

void test('resolves supported locales and formats translated values', () => {
  assert.equal(resolveLocale(null, 'pt-PT'), 'pt-BR');
  assert.equal(resolveLocale('fr', 'en-US'), 'fr');
  assert.equal(resolveLocale('unknown', 'it-IT'), 'en');
  assert.equal(format(translations.de, 'review_remove', { count: 3 }), 'Entfernungen prüfen · 3');
});

void test('parses TikTok export lists and derives mutual relationships', () => {
  const result = parseTikTokExport([
    { name: 'Follower.json', content: JSON.stringify({ FollowerList: [
      { Date: '2026-09-01', Username: 'mutual.friend' },
      { Date: '2026-09-02', Username: 'follower_only' },
    ] }) },
    { name: 'Following.json', content: JSON.stringify({ Activity: { Following: { FollowingList: [
      { Date: '2026-09-01', UserName: 'Mutual.Friend' },
      { Date: '2026-09-03', Link: 'https://www.tiktok.com/@following_only' },
    ] } } }) },
  ]);

  assert.deepEqual(result.following.map(item => [item.username, item.followsYou]), [
    ['Mutual.Friend', true],
    ['following_only', false],
  ]);
  assert.deepEqual(result.followers.map(item => [item.username, item.youFollow]), [
    ['mutual.friend', true],
    ['follower_only', false],
  ]);
  assert.throws(() => parseTikTokExport([
    { name: 'Following.json', content: '{"FollowingList":[]}' },
  ]), /not both found/);
});

void test('keeps protected and already reviewed TikTok accounts out of guided review', () => {
  const pending = pendingTikTokReviewAccounts([
    account('pending'),
    account('protected'),
    account('reviewed'),
    { ...account('mutual'), followsYou: true },
  ], new Set(['protected']), new Set(['reviewed']));

  assert.deepEqual(pending.map(item => item.id), ['pending']);
});
