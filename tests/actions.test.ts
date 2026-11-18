import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { crc32, inflateRawSync } from 'node:zlib';
import {
  appendHistory, appendLog, hourlyWaitMs, jitter, parseHistory, parseLog, parseSavedQueue, remainingItems, requestAccount, savedQueue, toJson,
  undoableUnfollows, type LogEntry,
} from '../src/actions';
import { runSequential, type Account } from '../src/core';
import { RELEASED, VERSION, isStale } from '../src/version';
import { toXlsx } from '../src/xlsx';

const item = (id: string) => ({ id, username: `user_${id}`, name: `User ${id}`, avatarUrl: '' });
const entry = (id: string, action: LogEntry['action'], ok = true, at = '2026-11-01T10:00:00.000Z'): LogEntry => ({ at, action, id, username: `user_${id}`, name: '', ok });

void test('saved queues round-trip through storage and reject tampering', () => {
  const queue = savedQueue('42', 'unfollow', [item('1'), item('2'), item('3')], 1, new Date('2026-11-18T12:00:00Z'));
  const restored = parseSavedQueue(JSON.parse(JSON.stringify(queue)));
  assert.deepEqual(restored, queue);
  assert.deepEqual(remainingItems(queue).map(entry => entry.id), ['2', '3']);
  assert.equal(parseSavedQueue({ ...queue, done: 4 }), undefined);
  assert.equal(parseSavedQueue({ ...queue, action: 'delete_account' }), undefined);
  assert.equal(parseSavedQueue({ ...queue, items: [{ ...item('1'), id: '../1' }] }), undefined);
  // Only platform CDN avatars survive storage, because they are rendered as <img src>.
  const hostile = parseSavedQueue({ ...queue, items: [{ ...item('1'), avatarUrl: 'javascript:alert(1)' }, { ...item('2'), avatarUrl: 'https://scontent.cdninstagram.com/a.jpg' }] });
  assert.deepEqual(hostile?.items.map(entry => entry.avatarUrl), ['', 'https://scontent.cdninstagram.com/a.jpg']);
  // Imported requests are queued by username until the ID is resolved.
  assert.ok(parseSavedQueue({ ...queue, items: [{ ...item('x'), id: 'username:night.owl' }], done: 0 }));
});

void test('the action log keeps valid entries and knows what can be undone', () => {
  const log = parseLog([entry('1', 'unfollow'), { at: 'nope' }, entry('2', 'unfollow'), entry('2', 'follow'), entry('3', 'unfollow', false), entry('4', 'remove')]);
  assert.equal(log.length, 5);
  assert.deepEqual(undoableUnfollows(log).map(entry => entry.id), ['1']);
  const capped = Array.from({ length: 3_005 }, (_, index) => entry(String(index), 'follow')).reduce<LogEntry[]>(appendLog, []);
  assert.equal(capped.length, 3_000);
  assert.equal(capped[0]?.id, '5');
});

void test('pacing spreads delays and enforces a rolling hourly cap', () => {
  assert.equal(jitter(10_000, () => 0), 7_000);
  assert.equal(jitter(10_000, () => 1), 13_000);
  const now = Date.parse('2026-11-18T12:00:00Z');
  const minutesAgo = (minutes: number): number => now - minutes * 60_000;
  assert.equal(hourlyWaitMs([minutesAgo(50), minutesAgo(10)], now, 3), 0);
  // Three actions in the last hour with a cap of 3: wait until the oldest leaves the window.
  assert.equal(hourlyWaitMs([minutesAgo(50), minutesAgo(30), minutesAgo(10), minutesAgo(90)], now, 3), 10 * 60_000);
});

void test('the queue applies the pacing hooks', async () => {
  const delays: number[] = [];
  const before: string[] = [];
  await runSequential(['a', 'b', 'c'], value => value === 'b' ? Promise.reject(new Error('boom')) : Promise.resolve(), new AbortController().signal, {
    delayMs: 0, batchSize: 5, batchDelayMs: 0,
    adjustDelay: (planned, failed) => { delays.push(failed ? 1 : 0); return planned; },
    beforeEach: value => { before.push(value); return Promise.resolve(); },
  });
  assert.deepEqual(before, ['a', 'b', 'c']);
  assert.deepEqual(delays, [0, 1]);
});

void test('history keeps a bounded series of audits', () => {
  const point = { at: '2026-11-18T12:00:00.000Z', followers: 10, following: 12, gained: ['a'], lost: Array.from({ length: 300 }, (_, i) => `u${i}`) };
  const history = appendHistory([], point);
  assert.equal(history[0]?.lost.length, 200);
  assert.deepEqual(parseHistory(JSON.parse(JSON.stringify(history))), history);
  assert.deepEqual(parseHistory([{ ...point, followers: -1 }]), []);
});

/** Reads a stored (uncompressed or deflated) ZIP back into its files. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extra = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const start = offset + 30 + nameLength + extra;
    const raw = bytes.subarray(start, start + size);
    const data = method === 0 ? raw : inflateRawSync(raw);
    assert.equal(crc32(data), crc, `CRC of ${name}`);
    files.set(name, new TextDecoder().decode(data));
    offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50, 'central directory follows the entries');
  return files;
}

void test('exports a valid .xlsx workbook with inert text cells', () => {
  const account: Account = {
    id: '1', username: 'formula', name: '=HYPERLINK("x") <b>&', avatarUrl: '', isPrivate: true, isVerified: false,
    followsYou: false, youFollow: true, hasAnonymousAvatar: true,
  };
  const files = unzip(toXlsx([account]));
  assert.deepEqual([...files.keys()].sort(), ['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';
  assert.match(sheet, /<c r="C2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK\(&quot;x&quot;\) &lt;b&gt;&amp;<\/t><\/is><\/c>/);
  assert.match(sheet, /<c r="H2" t="b"><v>1<\/v><\/c>/);
  assert.doesNotMatch(sheet, /<f>/);
});

void test('JSON exports carry profile links and the export context', () => {
  const parsed = JSON.parse(toJson([requestAccount('night.owl')], { platform: 'instagram', segment: 'requests' })) as { app: string; segment: string; accounts: { profileUrl: string; id: string }[] };
  assert.equal(parsed.app, 'FollowAudit');
  assert.equal(parsed.segment, 'requests');
  assert.equal(parsed.accounts[0]?.profileUrl, 'https://www.instagram.com/night.owl/');
  assert.equal(parsed.accounts[0]?.id, 'username:night.owl');
});

void test('the baked-in version matches package.json and ages into a notice', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string };
  assert.equal(VERSION, pkg.version);
  assert.equal(isStale(new Date(`${RELEASED}T12:00:00Z`)), false);
  assert.equal(isStale(new Date(Date.parse(`${RELEASED}T00:00:00Z`) + 46 * 86_400_000)), true);
});
