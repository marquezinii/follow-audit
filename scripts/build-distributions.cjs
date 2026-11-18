/**
 * Packages the bundled script into its other distributions:
 *   public/followaudit.user.js         userscript (Tampermonkey, Violentmonkey) with auto-update
 *   public/followaudit-extension.zip   Manifest V3 extension for Chrome, Edge and Firefox
 *   dist/extension/                    the same extension, unpacked, for "Load unpacked"
 * Outputs are deterministic, so CI can verify the committed copies are current.
 */
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { crc32 } = require('node:zlib');

const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const site = 'https://marquezinii.github.io/follow-audit/';
const { version, description } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const bundle = readFileSync(join(root, 'dist', 'dist.js'), 'utf8').replace(/\n?\/\/# sourceMappingURL=.*\s*$/, '\n');
const mark = readFileSync(join(root, 'src', 'assets', 'mark.svg'), 'utf8').replaceAll('fa-', 'fal-').trim();

// ── Userscript ──────────────────────────────────────────────────────────────
const userscript = `// ==UserScript==
// @name         FollowAudit
// @namespace    ${site}
// @version      ${version}
// @description  See who doesn't follow you back and who unfollowed you, then act deliberately. Runs only in your browser.
// @author       marquezinii
// @license      MIT
// @homepageURL  ${site}
// @supportURL   https://github.com/marquezinii/follow-audit/issues
// @updateURL    ${site}followaudit.user.js
// @downloadURL  ${site}followaudit.user.js
// @icon         ${site}favicon-48.png
// @match        https://www.instagram.com/*
// @match        https://www.tiktok.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* FollowAudit ${version} · ${site} · MIT License
 * Adds a small launcher button. Nothing runs until you click it. */
(() => {
  'use strict';
  const APP_ID = 'follow-audit-app';
  const launch = () => {
${bundle.trim()}
  };
  const host = document.createElement('div');
  host.id = 'follow-audit-launcher';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = '<style>:host{all:initial;position:fixed;z-index:2147483646;right:20px;bottom:20px}button{display:grid;place-items:center;width:52px;height:52px;border:1px solid #e2e6ee;border-radius:50%;padding:0;background:#fff;box-shadow:0 12px 30px -12px rgba(23,34,53,.45);cursor:pointer}button:hover{transform:translateY(-1px)}button:focus-visible{outline:3px solid #0a5cff;outline-offset:2px}svg{width:32px;height:32px}</style><button type="button" title="Open FollowAudit" aria-label="Open FollowAudit">' + ${JSON.stringify(mark)} + '</button>';
  shadow.querySelector('button').addEventListener('click', launch);
  const sync = () => { host.hidden = Boolean(document.getElementById(APP_ID)); };
  new MutationObserver(sync).observe(document.documentElement, { childList: true });
  document.documentElement.append(host);
  sync();
})();
`;
writeFileSync(join(publicDir, 'followaudit.user.js'), userscript);

// ── Extension ───────────────────────────────────────────────────────────────
const manifest = {
  manifest_version: 3,
  name: 'FollowAudit',
  version,
  description: 'See who doesn’t follow you back and who unfollowed you on Instagram. Runs only when you click it, only in your tab.',
  homepage_url: site,
  action: { default_title: 'Open FollowAudit', default_icon: { 48: 'icon-48.png', 128: 'icon-128.png' } },
  icons: { 48: 'icon-48.png', 128: 'icon-128.png' },
  // activeTab + scripting: the extension can touch a page only after you click its button on that tab.
  permissions: ['activeTab', 'scripting'],
  background: { service_worker: 'background.js', scripts: ['background.js'] },
  browser_specific_settings: { gecko: { id: 'followaudit@marquezinii.github.io', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } },
};
const background = `// FollowAudit ${version}: inject the panel into the current Instagram or TikTok tab when the toolbar button is clicked.
const api = globalThis.browser ?? globalThis.chrome;
const SUPPORTED = /^https:\\/\\/(?:[a-z0-9-]+\\.)*(?:instagram|tiktok)\\.com\\//;

api.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined || !tab.url || !SUPPORTED.test(tab.url)) {
    await api.tabs.create({ url: 'https://www.instagram.com/' });
    return;
  }
  await api.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', files: ['followaudit.js'] });
});
`;
const files = [
  ['manifest.json', `${JSON.stringify(manifest, null, 2)}\n`],
  ['background.js', background],
  ['followaudit.js', bundle],
  ['icon-48.png', readFileSync(join(publicDir, 'favicon-48.png'))],
  ['icon-128.png', readFileSync(join(publicDir, 'icon-192.png'))],
  ['LICENSE', readFileSync(join(root, 'LICENSE'))],
];

const unpacked = join(root, 'dist', 'extension');
rmSync(unpacked, { recursive: true, force: true });
mkdirSync(unpacked, { recursive: true });
for (const [name, content] of files) writeFileSync(join(unpacked, name), content);
writeFileSync(join(publicDir, 'followaudit-extension.zip'), zip(files));

/** Stored (uncompressed) ZIP with a fixed 1980-01-01 timestamp, so identical inputs give identical bytes. */
function zip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const fileName = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0x0800, 8);
    header.writeUInt16LE(0x0021, 14);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(fileName.length, 28);
    header.writeUInt32LE(offset, 42);
    parts.push(local, fileName, data);
    central.push(header, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

console.log(`Distributions: followaudit.user.js and followaudit-extension.zip (${description ? 'v' : ''}${version}).`);
