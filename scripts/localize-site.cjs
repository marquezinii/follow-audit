// Pre-renders the English landing page (public/index.html) into one static page per language, so every
// language has its own crawlable URL, hreflang alternates, canonical and JSON-LD. Pure functions: no file I/O.

const OG_LOCALES = { en: 'en_US', 'pt-BR': 'pt_BR', es: 'es_ES', fr: 'fr_FR', de: 'de_DE' };

// Hand-written long-form guides (public/<path>index.html). They form their own reciprocal hreflang cluster, with
// the English guide as x-default. Languages without a guide link to the English one from the landing page.
const GUIDES = {
  en: 'guides/who-doesnt-follow-you-back-on-instagram/',
  'pt-BR': 'pt-br/guias/quem-nao-te-segue-de-volta-no-instagram/',
};

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const folder = (locale) => (locale === 'en' ? '' : `${locale.toLowerCase()}/`);
const label = (locale) => (locale === 'pt-BR' ? 'PT' : locale.toUpperCase());
const guidePath = (locale) => GUIDES[locale] ?? GUIDES.en;
const baseUrl = (html) => html.match(/<link rel="canonical" href="([^"]+)">/)[1];

function loadTranslations(script) {
  const source = script.match(/const translations = (\{[\s\S]*?\n\});\n\nconst \w+/);
  if (!source) throw new Error('Could not read the site translations.');
  return Function(`"use strict"; return (${source[1]});`)();
}

function renderLocale(html, translations, locale) {
  const copy = translations[locale];
  const url = baseUrl(html) + folder(locale);
  const description = escape(copy._meta);
  const title = escape(copy._page_title);
  const jsonLd = (block) => {
    const data = JSON.parse(block);
    return JSON.stringify({ ...data, url, description: copy._meta, inLanguage: locale });
  };

  let out = html
    .replace('<html lang="en"', () => `<html lang="${locale}"`)
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, (_, head) => `${head}${description}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, (_, head) => `${head}${title}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, (_, head) => `${head}${description}"`)
    .replace(/(<meta property="og:locale" content=")[^"]*"/, (_, head) => `${head}${OG_LOCALES[locale]}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, (_, head) => `${head}${url}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, (_, head) => `${head}${url}"`)
    .replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, open, block, close) => `${open}${jsonLd(block)}${close}`)
    .replace(
      /<summary class="tool" aria-label="[^"]*"><span data-active-language>[^<]*<\/span>/,
      () => `<summary class="tool" aria-label="${escape(copy.language_label)}: ${label(locale)}"><span data-active-language>${label(locale)}</span>`,
    )
    .replace(' aria-current="page"', '')
    .replace(`data-language="${locale}"`, () => `data-language="${locale}" aria-current="page"`)
    .replace(/(<[a-z0-9]+\b[^>]*\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/[a-z0-9]+>)/g, (whole, open, key, _text, close) =>
      key in copy ? `${open}${escape(copy[key])}${close}` : whole)
    .replace(/<[^>]*\sdata-i18n-(aria-label|alt)="([^"]+)"[^>]*>/g, (tag, attribute, key) =>
      key in copy ? tag.replace(new RegExp(`(\\s${attribute}=")[^"]*"`), (_, head) => `${head}${escape(copy[key])}"`) : tag);

  if (locale !== 'en') {
    // The pages live one folder deeper: point the English entry of the language menu at the root and
    // prefix every other relative reference.
    out = out
      .replace('href="./" hreflang="en"', 'href="../" hreflang="en"')
      .replaceAll(`href="${GUIDES.en}"`, `href="${guidePath(locale)}"`)
      .replace(/\b(src|href)="(?!https?:|#|mailto:|data:|\.\/|\.\.\/)([^"]+)"/g, '$1="../$2"');
  }
  return out;
}

function sitemap(html, locales) {
  const base = baseUrl(html);
  const entry = (path, alternates) => {
    const links = alternates.map(([hreflang, href]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${base}${href}"/>`).join('\n');
    return `  <url>\n    <loc>${base}${path}</loc>\n${links}\n  </url>`;
  };
  const pages = [...locales.map((locale) => [locale, folder(locale)]), ['x-default', '']];
  const guides = [...Object.entries(GUIDES), ['x-default', GUIDES.en]];
  const urls = [
    ...locales.map((locale) => entry(folder(locale), pages)),
    ...Object.values(GUIDES).map((path) => entry(path, guides)),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

module.exports = { GUIDES, folder, guidePath, loadTranslations, renderLocale, sitemap };
