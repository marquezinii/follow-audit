const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const html = readFileSync(join(root, 'public', 'index.html'), 'utf8');
const script = readFileSync(join(root, 'public', 'site.js'), 'utf8');
const source = script.match(/const translations = (\{[\s\S]*?\n\});\n\nconst languageSelect/);
if (!source) throw new Error('Could not read the site translations.');

const translations = Function(`"use strict"; return (${source[1]});`)();
const locales = Object.keys(translations);
const required = new Set([...html.matchAll(/data-i18n(?:-aria-label)?="([^"]+)"/g)].map((match) => match[1]));
const baseline = Object.keys(translations.en).sort().join('\n');

for (const locale of locales) {
  const keys = Object.keys(translations[locale]);
  const missing = [...required].filter((key) => !keys.includes(key));
  if (missing.length) throw new Error(`${locale} is missing: ${missing.join(', ')}`);
  if (keys.sort().join('\n') !== baseline) throw new Error(`${locale} does not match the English translation keys.`);
}

console.log(`Site translations: ${locales.length} locales, ${required.size} interface strings.`);
