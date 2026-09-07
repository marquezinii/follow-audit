import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFollowersPage, parseFollowingPage, runSequential, scanAccounts, type Account } from '../src/core';
import { format, resolveLocale, translations } from '../src/i18n';
import { InstagramGateway } from '../src/instagram';

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
    data: {
      user: {
        edge_follow: {
          count: 1,
          edges: [{ node: {
            id: '10',
            username: 'account_10',
            full_name: 'Account 10',
            profile_pic_url: 'https://example.test/avatar.png',
            is_private: false,
            is_verified: true,
            follows_viewer: false,
          } }],
          page_info: { has_next_page: false, end_cursor: null },
        },
      },
    },
  });

  assert.equal(result.accounts[0]?.name, 'Account 10');
  assert.throws(() => parseFollowingPage({ data: { user: {} } }));
  assert.throws(() => parseFollowingPage({
    data: { user: { edge_follow: { count: -1, edges: [], page_info: { has_next_page: false, end_cursor: null } } } },
  }));
});

void test('parses followers and records whether you follow them back', () => {
  const result = parseFollowersPage({
    data: {
      user: {
        edge_followed_by: {
          count: 1,
          edges: [{ node: {
            id: '11', username: 'account_11', full_name: 'Account 11', profile_pic_url: 'https://example.test/avatar.png',
            is_private: false, is_verified: false, followed_by_viewer: false,
          } }],
          page_info: { has_next_page: false, end_cursor: null },
        },
      },
    },
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
  await runSequential(['a', 'b', 'c'], item => {
    return item === 'b' ? Promise.reject(new Error('expected failure')) : Promise.resolve();
  }, new AbortController().signal, {
    delayMs: 0,
    batchSize: 5,
    batchDelayMs: 0,
    onResult: (_item, ok) => outcomes.push(ok),
  });

  assert.deepEqual(outcomes, [true, false, true]);
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
  let headers: Headers | undefined;

  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'csrftoken=test-token' } });
  globalThis.fetch = (_url, init) => {
    headers = new Headers(init?.headers);
    return Promise.resolve(new Response('', { status: 200 }));
  };

  try {
    await new InstagramGateway().removeFollower('12', new AbortController().signal);
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
