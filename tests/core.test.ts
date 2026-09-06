import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFollowingPage, runSequential, scanFollowing, type Account } from '../src/core';

const account = (id: string): Account => ({
  id,
  username: `account_${id}`,
  name: `Account ${id}`,
  avatarUrl: 'https://example.test/avatar.png',
  isPrivate: false,
  isVerified: false,
  followsYou: false,
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
});

void test('deduplicates accounts across pages', async () => {
  let page = 0;
  const result = await scanFollowing(() => {
    page += 1;
    return Promise.resolve(page === 1
      ? { accounts: [account('1')], total: 2, nextCursor: 'next' }
      : { accounts: [account('1'), account('2')], total: 2 });
  }, new AbortController().signal);

  assert.deepEqual(result.map(item => item.id), ['1', '2']);
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
