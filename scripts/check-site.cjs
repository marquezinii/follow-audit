const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
const preview = readFileSync(join(publicDir, 'preview.html'), 'utf8');
const script = readFileSync(join(publicDir, 'site.js'), 'utf8');
const fail = (message) => { throw new Error(message); };

// Translations: every locale defines exactly the English keys, and every key used in the page exists.
const source = script.match(/const translations = (\{[\s\S]*?\n\});\n\nconst \w+/);
if (!source) fail('Could not read the site translations.');
const translations = Function(`"use strict"; return (${source[1]});`)();
const locales = Object.keys(translations);
const required = new Set([...html.matchAll(/data-i18n(?:-aria-label|-alt)?="([^"]+)"/g)].map((match) => match[1]));
const baseline = Object.keys(translations.en).sort().join('\n');
for (const locale of locales) {
  const keys = Object.keys(translations[locale]);
  const missing = [...required].filter((key) => !keys.includes(key));
  if (missing.length) fail(`${locale} is missing: ${missing.join(', ')}`);
  if (keys.sort().join('\n') !== baseline) fail(`${locale} does not match the English translation keys.`);
  const empty = keys.filter((key) => typeof translations[locale][key] !== 'string' || !translations[locale][key].trim());
  if (empty.length) fail(`${locale} has empty strings: ${empty.join(', ')}`);
}

// Cache busting for the distributable bundle.
if (!script.includes('dist.js?v=${Date.now()}')) fail('The copy action must bypass stale bundle caches.');
if (!preview.includes('./dist.js?v=${Date.now()}')) fail('The preview must bypass stale bundle caches.');

// The Content-Security-Policy must allow exactly the inline theme script that ships with the page.
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
if (inline.length !== 1) fail(`Expected one inline script, found ${inline.length}.`);
const hash = createHash('sha256').update(inline[0]).digest('base64');
if (!html.includes(`'sha256-${hash}'`)) fail(`The CSP hash is stale. Use 'sha256-${hash}'.`);

// Every local asset referenced by the page exists.
const assets = [...html.matchAll(/(?:src|href)="(?!https?:|#|mailto:)([^"?]+)"/g)].map((match) => match[1]).filter((path) => path !== './');
const missingAssets = assets.filter((path) => !existsSync(join(publicDir, path)));
if (missingAssets.length) fail(`Missing assets: ${missingAssets.join(', ')}`);

console.log(`Site: ${locales.length} locales, ${required.size} strings, ${assets.length} assets, CSP hash verified.`);
