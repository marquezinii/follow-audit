import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QueueHaltedError, diffSnapshot, estimateRemainingMs, parseFollowersPage, parseFollowingPage, parseSnapshot, runSequential, toCsv, toSnapshot,
  type Account,
} from '../src/core';
import { format, resolveLocale, translations } from '../src/i18n';
import { ActionBlockedError, HttpError, InstagramGateway, isBlockingError } from '../src/instagram';
import { parseProtectedBackup, protectedBackup } from '../src/storage';
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

void test('halts the queue after consecutive failures or a blocking error', async () => {
  const attempted: string[] = [];
  await assert.rejects(runSequential(['a', 'b', 'c', 'd'], item => {
    attempted.push(item);
    return Promise.reject(new Error('down'));
  }, new AbortController().signal, { delayMs: 0, batchSize: 5, batchDelayMs: 0, maxConsecutiveFailures: 2 }), QueueHaltedError);
  assert.deepEqual(attempted, ['a', 'b']);

  attempted.length = 0;
  await assert.rejects(runSequential(['a', 'b', 'c'], item => {
    attempted.push(item);
    return item === 'b' ? Promise.reject(new HttpError(429)) : Promise.resolve();
  }, new AbortController().signal, { delayMs: 0, batchSize: 5, batchDelayMs: 0, isFatal: isBlockingError }), (error: unknown) => {
    assert.ok(error instanceof QueueHaltedError);
    assert.equal(error.completed, 2);
    return true;
  });
  assert.deepEqual(attempted, ['a', 'b']);
  assert.equal(isBlockingError(new HttpError(500)), false);
});

void test('estimates the remaining queue time including batch pauses', () => {
  const timing = { delayMs: 1_000, batchSize: 2, batchDelayMs: 60_000 };
  assert.equal(estimateRemainingMs(1, 4, timing), 1_000 + 60_000 + 1_000);
  assert.equal(estimateRemainingMs(3, 4, timing), 1_000);
  assert.equal(estimateRemainingMs(4, 4, timing), 0);
});

void test('reports gained and lost followers between audits', () => {
  const previous = toSnapshot([account('1'), account('2')], new Date('2026-10-01T00:00:00Z'));
  const changes = diffSnapshot(previous, [account('2'), account('3')]);
  assert.equal(changes.since, '2026-10-01T00:00:00.000Z');
  assert.deepEqual(changes.gained.map(entry => entry.id), ['3']);
  assert.deepEqual(changes.lost, [{ id: '1', username: 'account_1', name: 'Account 1' }]);
});

void test('rejects corrupted snapshots from local storage', () => {
  const snapshot = toSnapshot([account('1')], new Date('2026-10-01T00:00:00Z'));
  assert.deepEqual(parseSnapshot(JSON.parse(JSON.stringify(snapshot))), snapshot);
  assert.equal(parseSnapshot({ at: 'not a date', accounts: [] }), undefined);
  assert.equal(parseSnapshot({ at: snapshot.at, accounts: [{ id: 1 }] }), undefined);
  assert.equal(parseSnapshot(null), undefined);
});

void test('exports spreadsheet-safe CSV', () => {
  const csv = toCsv([{ ...account('1'), name: '=HYPERLINK("x")' }]);
  const [header, row] = csv.split('\r\n');
  assert.equal(header, 'id,username,name,follows_you,you_follow,private,verified');
  assert.equal(row, '"1","account_1","\'=HYPERLINK(""x"")","false","true","false","false"');
});

void test('treats an HTTP 200 refusal body as a blocked action', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'csrftoken=test-token' } });
  globalThis.fetch = () => Promise.resolve(Response.json({ status: 'fail', message: 'feedback_required', spam: true }));

  try {
    await assert.rejects(new InstagramGateway().unfollow('12', new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof ActionBlockedError);
      assert.ok(isBlockingError(error));
      return true;
    });
    globalThis.fetch = () => Promise.resolve(Response.json({ status: 'ok' }));
    await new InstagramGateway().unfollow('12', new AbortController().signal);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

void test('round-trips protected backups and rejects foreign files', () => {
  const backup = protectedBackup('instagram', new Set(['1', '2']));
  assert.deepEqual(parseProtectedBackup(backup), ['1', '2']);
  assert.deepEqual(parseProtectedBackup('["3", 4, "", "bad\\u0001id"]'), ['3']);
  assert.equal(parseProtectedBackup('{"kind":"other","ids":["1"]}'), undefined);
  assert.equal(parseProtectedBackup('not json'), undefined);
});

const withInstagramSession = async (respond: (url: URL) => unknown, run: () => Promise<void>): Promise<URL[]> => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'ds_user_id=42; csrftoken=test-token' } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://www.instagram.com' } });
  globalThis.fetch = input => {
    const url = new URL(input instanceof Request ? input.url : input, 'https://www.instagram.com');
    requests.push(url);
    return Promise.resolve(Response.json(respond(url)));
  };
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
    if (originalLocation) Object.defineProperty(globalThis, 'location', originalLocation);
    else Reflect.deleteProperty(globalThis, 'location');
  }
  return requests;
};

const igUser = (pk: string) => ({
  pk, username: `account_${pk}`, full_name: `Account ${pk}`, profile_pic_url: '', is_private: false, is_verified: false,
});

void test('audits both lists once each and derives relationships locally', async () => {
  let lists: Awaited<ReturnType<InstagramGateway['audit']>> | undefined;
  const requests = await withInstagramSession(url => url.pathname.endsWith('/following/')
    ? url.searchParams.get('max_id') === 'p2'
      ? { users: [igUser('11'), igUser('12')], next_max_id: null, status: 'ok' }
      : { users: [igUser('10'), igUser('11')], next_max_id: 'p2', status: 'ok' }
    : { users: [igUser('10'), igUser('20')], next_max_id: null, status: 'ok' },
  async () => { lists = await new InstagramGateway().audit(new AbortController().signal); });

  assert.deepEqual(requests.map(url => url.pathname), [
    '/api/v1/friendships/42/following/', '/api/v1/friendships/42/following/', '/api/v1/friendships/42/followers/',
  ]);
  assert.equal(requests[0]?.searchParams.get('count'), '50');
  assert.deepEqual(lists?.following.map(account => [account.id, account.followsYou]), [['10', true], ['11', false], ['12', false]]);
  assert.deepEqual(lists?.followers.map(account => [account.id, account.youFollow]), [['10', true], ['20', false]]);
});

void test('stops the audit when Instagram repeats a pagination cursor', async () => {
  let failure: unknown;
  const requests = await withInstagramSession(() => ({ users: [], next_max_id: 'same', status: 'ok' }), async () => {
    try { await new InstagramGateway().audit(new AbortController().signal); } catch (error) { failure = error; }
  });
  assert.match(String(failure), /repeated pagination cursor/);
  assert.equal(requests.length, 2);
});
