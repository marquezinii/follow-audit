/**
 * Contract tests: fixtures mirror real Instagram responses (anonymized), so a change in the platform's
 * shapes or in FollowAudit's requests shows up here before it reaches users.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parsePendingRequestsExport } from '../src/actions';
import { InstagramGateway, UnexpectedResponseError, isBlockingError } from '../src/instagram';

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const dtsgScript = { textContent: 'requireLazy(["DTSGInitialData",[],{"token":"test-dtsg"},258])' };

interface Call { readonly url: string; readonly init?: RequestInit }

/** Runs `body` with a fake signed-in document and a scripted fetch, restoring both afterwards. */
async function withInstagram(responses: readonly Response[], body: (calls: Call[]) => Promise<void>): Promise<void> {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const originalFetch = globalThis.fetch;
  const calls: Call[] = [];
  const queue = [...responses];
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'ds_user_id=42; csrftoken=test-token', scripts: [dtsgScript] } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: { origin: 'https://www.instagram.com' } });
  globalThis.fetch = (input, init) => {
    calls.push({ url: input instanceof URL ? input.href : typeof input === 'string' ? input : input.url, init });
    const next = queue.shift();
    return next ? Promise.resolve(next) : Promise.reject(new Error('Unexpected request'));
  };
  try {
    await body(calls);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, descriptor] of [['document', originalDocument], ['location', originalLocation]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

const json = (text: string): Response => new Response(text, { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
const html = (text: string): Response => new Response(text, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

void test('contract: the following list keeps the fields FollowAudit reads', async () => {
  const page = fixture('instagram-following-page.json');
  const followers = JSON.stringify({ users: [(JSON.parse(page) as { users: unknown[] }).users[0]], next_max_id: null, status: 'ok' });
  await withInstagram([json(page), json(followers)], async calls => {
    const lists = await new InstagramGateway().audit(new AbortController().signal);
    assert.equal(calls[0]?.url, 'https://www.instagram.com/api/v1/friendships/42/following/?count=50');
    assert.deepEqual(lists.following.map(account => [account.username, account.followsYou, account.hasAnonymousAvatar]), [
      ['sample.airline', true, false],
      ['quiet.account', false, true],
    ]);
    assert.equal(lists.following[0]?.isVerified, true);
  });
});

void test('contract: follow, unfollow and cancel send the web client body', async () => {
  const ok = fixture('instagram-friendship-response.json');
  await withInstagram([json(ok), json(ok), json(ok)], async calls => {
    const gateway = new InstagramGateway();
    const signal = new AbortController().signal;
    await gateway.follow('7', signal);
    await gateway.unfollow('8', signal);
    await gateway.cancelRequest('9', signal);
    assert.deepEqual(calls.map(call => call.url), [
      '/api/v1/friendships/create/7/', '/api/v1/friendships/destroy/8/', '/api/v1/friendships/destroy/9/',
    ]);
    for (const [index, call] of calls.entries()) {
      const body = new URLSearchParams(typeof call.init?.body === 'string' ? call.init.body : '');
      assert.equal(body.get('user_id'), ['7', '8', '9'][index]);
      assert.equal(body.get('fb_dtsg'), 'test-dtsg');
      assert.equal(body.get('jazoest'), '21038');
      assert.equal(new Headers(call.init?.headers).get('x-csrftoken'), 'test-token');
    }
  });
});

void test('contract: the HTML app shell means the request contract changed', async () => {
  await withInstagram([html(fixture('instagram-app-shell.html'))], async () => {
    await assert.rejects(new InstagramGateway().unfollow('8', new AbortController().signal), (error: unknown) => {
      assert.ok(error instanceof UnexpectedResponseError);
      assert.ok(isBlockingError(error));
      return true;
    });
  });
});

void test('contract: the pre-check is a no-op unfollow of the signed-in account', async () => {
  await withInstagram([json(fixture('instagram-friendship-response.json'))], async calls => {
    await new InstagramGateway().precheck(new AbortController().signal);
    assert.equal(calls[0]?.url, '/api/v1/friendships/destroy/42/');
  });
  await withInstagram([html(fixture('instagram-app-shell.html'))], async () => {
    await assert.rejects(new InstagramGateway().precheck(new AbortController().signal), UnexpectedResponseError);
  });
});

void test('contract: a profile page exposes the numeric account ID', async () => {
  await withInstagram([html(fixture('instagram-profile-page.html')), html(fixture('instagram-app-shell.html'))], async calls => {
    const gateway = new InstagramGateway();
    assert.equal(await gateway.resolveUserId('instagram', new AbortController().signal), '25025320');
    assert.equal(calls[0]?.url, '/instagram/');
    await assert.rejects(gateway.resolveUserId('gone.account', new AbortController().signal), /could not be found/);
    await assert.rejects(gateway.resolveUserId('../admin', new AbortController().signal), /Invalid username/);
  });
});

void test('contract: both known pending_follow_requests.json layouts are read', () => {
  assert.deepEqual(parsePendingRequestsExport([{ name: 'pending_follow_requests.json', content: fixture('pending_follow_requests.json') }]), [
    'private.photographer', 'close.friend_',
  ]);
  assert.deepEqual(parsePendingRequestsExport([{ name: 'pending_follow_requests.json', content: fixture('pending_follow_requests_titled.json') }]), [
    'night.owl', 'early.bird',
  ]);
  assert.throws(() => parsePendingRequestsExport([{ name: 'followers_1.json', content: '[{"title":"someone"}]' }]), /No sent follow requests/);
});
