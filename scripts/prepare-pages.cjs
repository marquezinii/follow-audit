const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { folder, loadTranslations, renderLocale, sitemap } = require('./localize-site.cjs');

const publicDir = join(__dirname, '..', 'public');

copyFileSync(join(__dirname, '..', 'dist', 'dist.js'), join(publicDir, 'dist.js'));

const html = readFileSync(join(publicDir, 'index.html'), 'utf8');
const translations = loadTranslations(readFileSync(join(publicDir, 'site.js'), 'utf8'));
const locales = Object.keys(translations);

for (const locale of locales.filter((candidate) => candidate !== 'en')) {
  mkdirSync(join(publicDir, folder(locale)), { recursive: true });
  writeFileSync(join(publicDir, folder(locale), 'index.html'), renderLocale(html, translations, locale));
}
writeFileSync(join(publicDir, 'sitemap.xml'), sitemap(html, locales));
