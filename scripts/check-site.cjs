const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { GUIDES, folder, guidePath, loadTranslations, renderLocale, sitemap } = require('./localize-site.cjs');

const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const read = (name) => readFileSync(join(publicDir, name), 'utf8');
const html = read('index.html');
const preview = read('preview.html');
const script = read('site.js');
const fail = (message) => { throw new Error(message); };

// Translations: every locale defines exactly the English keys, and every key used in the page exists.
const translations = loadTranslations(script);
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

// The English strings in index.html are the translations.en strings (the other pages are rendered from them).
const withoutJsonLd = (page) => page.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/, '');
if (withoutJsonLd(renderLocale(html, translations, 'en')) !== withoutJsonLd(html)) {
  fail('index.html text differs from translations.en in public/site.js. Keep them identical.');
}

// Search: one self-canonical page per language, reciprocal hreflang alternates, structured data, sitemap inputs.
const base = html.match(/<link rel="canonical" href="([^"]+)">/)[1];
const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((match) => `${match[1]} ${match[2]}`);
const expectedAlternates = [...locales.map((locale) => `${locale} ${base}${folder(locale)}`), `x-default ${base}`];
if (alternates.join('\n') !== expectedAlternates.join('\n')) fail(`hreflang alternates must be:\n${expectedAlternates.join('\n')}`);
for (const file of ['robots.txt', 'llms.txt']) if (!existsSync(join(publicDir, file))) fail(`public/${file} is missing.`);
if (!read('robots.txt').includes(`Sitemap: ${base}sitemap.xml`)) fail('robots.txt must point to the sitemap.');
if (!sitemap(html, locales).includes(`<loc>${base}pt-br/</loc>`)) fail('The sitemap must list every language page.');

// Every page (English root + each rendered language) is complete and every local asset it references exists.
let assetCount = 0;
for (const locale of locales) {
  const page = renderLocale(html, translations, locale);
  const where = `${locale} page`;
  if (!page.includes(`<html lang="${locale}"`)) fail(`${where}: wrong lang attribute.`);
  if (!page.includes(`<link rel="canonical" href="${base}${folder(locale)}">`)) fail(`${where}: canonical must be its own URL.`);
  const ld = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  if (ld['@type'] !== 'SoftwareApplication' || ld.url !== base + folder(locale) || ld.inLanguage !== locale) fail(`${where}: invalid JSON-LD.`);
  const current = [...page.matchAll(/aria-current="page"/g)].length;
  if (current !== 1 || !page.includes(`data-language="${locale}" aria-current="page"`)) fail(`${where}: the language menu must mark the current language.`);
  // Links to other language pages (trailing slash) are generated at build time; everything else is a file.
  const assets = [...page.matchAll(/(?:src|href)="(?!https?:|#|mailto:)([^"?]+)"/g)].map((match) => match[1]).filter((path) => !path.endsWith('/'));
  const missing = assets.filter((path) => !existsSync(join(publicDir, folder(locale), path)));
  if (missing.length) fail(`${where}: missing assets: ${missing.join(', ')}`);
  assetCount += assets.length;
}

// Guides: hand-written long-form pages, each self-canonical and in one reciprocal hreflang cluster.
const pageDirectories = new Set([...locales.map(folder), ...Object.values(GUIDES)]);
const plainText = (markup) => markup.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const wordCount = (text) => text.split(/\s+/).filter(Boolean).length;
const siteFile = (reference, pageUrl) => {
  const target = new URL(reference, pageUrl).href;
  return target.startsWith(base) ? target.slice(base.length).split(/[?#]/)[0] : null;
};
const guideAlternates = [...Object.entries(GUIDES).map(([locale, path]) => `${locale} ${base}${path}`), `x-default ${base}${GUIDES.en}`];
const sitemapXml = sitemap(html, locales);
const llms = read('llms.txt');
const landingCsp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];

for (const [locale, path] of Object.entries(GUIDES)) {
  const where = `${locale} guide`;
  const url = base + path;
  if (!existsSync(join(publicDir, path, 'index.html'))) fail(`${where}: public/${path}index.html is missing.`);
  const page = read(`${path}index.html`);
  const attribute = (pattern) => page.match(pattern)?.[1] ?? fail(`${where}: missing ${pattern}.`);

  if (!page.includes(`<html lang="${locale}"`)) fail(`${where}: wrong lang attribute.`);
  if (attribute(/<link rel="canonical" href="([^"]+)">/) !== url) fail(`${where}: canonical must be its own URL.`);
  if (attribute(/<meta property="og:url" content="([^"]+)">/) !== url) fail(`${where}: og:url must be its own URL.`);
  const alternates = [...page.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map((match) => `${match[1]} ${match[2]}`);
  if (alternates.join('\n') !== guideAlternates.join('\n')) fail(`${where}: hreflang alternates must be:\n${guideAlternates.join('\n')}`);
  if (!llms.includes(url)) fail(`${where}: llms.txt must list it.`);
  if (!sitemapXml.includes(`<loc>${url}</loc>`)) fail(`${where}: the sitemap must list it.`);

  // Same Content-Security-Policy as the landing page, with nothing inline beyond the hashed theme script.
  if (attribute(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) !== landingCsp) fail(`${where}: the CSP must match the landing page.`);
  const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  if (scripts.length !== 1 || scripts[0] !== inline[0]) fail(`${where}: the only inline script must be the landing page's theme script.`);
  if (/\sstyle="|\son[a-z]+="/.test(page)) fail(`${where}: inline styles and event handlers are blocked by the CSP.`);

  // Search snippets: one h1, a sensible title and description.
  const heading = plainText(attribute(/<h1[^>]*>([\s\S]*?)<\/h1>/));
  if ((page.match(/<h1[\s>]/g) ?? []).length !== 1) fail(`${where}: expected exactly one h1.`);
  const title = attribute(/<title>([^<]+)<\/title>/);
  const description = attribute(/<meta name="description" content="([^"]+)">/);
  if (title.length > 75) fail(`${where}: the title is ${title.length} characters; keep it at 75 or fewer.`);
  if (description.length < 80 || description.length > 170) fail(`${where}: the description must be 80-170 characters.`);
  if (attribute(/<meta property="og:title" content="([^"]+)">/) !== title) fail(`${where}: og:title must match the title.`);
  if (attribute(/<meta property="og:description" content="([^"]+)">/) !== description) fail(`${where}: og:description must match the description.`);

  // Answer first: the h1 and every h2 open with a direct 40-60 word answer.
  const article = attribute(/<article[^>]*>([\s\S]*)<\/article>/);
  const headings = (page.match(/<\/h1>\s*<p class="answer">/g) ?? []).length + (article.match(/<\/h2>\s*<p class="answer">/g) ?? []).length;
  if (headings !== 1 + (article.match(/<h2[\s>]/g) ?? []).length) fail(`${where}: the h1 and every h2 must be followed by <p class="answer">.`);
  for (const [, answer] of page.matchAll(/<p class="answer">([\s\S]*?)<\/p>/g)) {
    const words = wordCount(plainText(answer));
    if (words < 40 || words > 60) fail(`${where}: a direct answer has ${words} words (40-60 required): ${plainText(answer).slice(0, 60)}…`);
  }

  // Structured data must describe exactly what is visible.
  const graph = JSON.parse(attribute(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/))['@graph'];
  const articleData = graph.find((item) => item['@type'] === 'Article');
  const howTo = graph.find((item) => item['@type'] === 'HowTo');
  if (!articleData || !howTo) fail(`${where}: expected Article and HowTo structured data.`);
  const published = attribute(/<time datetime="([^"]+)">/);
  if (articleData.headline !== heading || articleData.url !== url || articleData.mainEntityOfPage !== url || articleData.inLanguage !== locale) fail(`${where}: Article data does not match the page.`);
  if (articleData.datePublished !== published || articleData.dateModified !== published) fail(`${where}: Article dates must match the visible date.`);
  if (articleData.description !== description) fail(`${where}: Article description must match the meta description.`);
  const steps = [...page.matchAll(/<li id="([^"]+)"><strong>([\s\S]*?)<\/strong><span>([\s\S]*?)<\/span><\/li>/g)];
  if (howTo.inLanguage !== locale || !steps.length || howTo.step.length !== steps.length) fail(`${where}: HowTo must have one step per visible numbered step.`);
  steps.forEach(([, id, name, text], index) => {
    const step = howTo.step[index];
    if (step.position !== index + 1 || step.name !== plainText(name) || step.text !== plainText(text) || step.url !== `${url}#${id}`) fail(`${where}: HowTo step ${index + 1} does not match the visible step.`);
  });

  // Every local reference resolves: files exist, directory links are known pages, anchors have a target.
  for (const [, reference] of page.matchAll(/(?:src|href)="(?!https?:|mailto:)([^"]*)"/g)) {
    if (reference.startsWith('#')) {
      if (!page.includes(`id="${reference.slice(1)}"`)) fail(`${where}: broken anchor ${reference}.`);
      continue;
    }
    const target = siteFile(reference, url);
    if (target === null) continue;
    const known = target === '' || target.endsWith('/') ? pageDirectories.has(target) : existsSync(join(publicDir, target));
    if (!known) fail(`${where}: broken link ${reference}.`);
  }

  // Every guide links to its landing page, to the other guides and to the Copy script action.
  const links = [...page.matchAll(/href="([^"]*)"/g)].map((match) => siteFile(match[1], url));
  for (const expected of [folder(locale), ...Object.values(GUIDES).filter((other) => other !== path)]) {
    if (!links.includes(expected)) fail(`${where}: missing a link to ${base}${expected}.`);
  }
  if (!page.includes('class="button primary copy-script"')) fail(`${where}: missing the Copy script button.`);
}

// Every landing page links to the guide in its language (English when none exists).
for (const locale of locales) {
  const pageUrl = base + folder(locale);
  const links = [...renderLocale(html, translations, locale).matchAll(/href="([^"]*)"/g)].map((match) => siteFile(match[1], pageUrl));
  if (!links.includes(guidePath(locale))) fail(`${locale} page: must link to ${base}${guidePath(locale)}.`);
}

console.log(`Site: ${locales.length} locales, ${required.size} strings, ${assetCount} asset references, ${Object.keys(GUIDES).length} guides, CSP hash verified.`);
