/*
 * THESIS: a side panel that opens as an account report, not a table. The two lists meet on one
 * versus axis; everything else is a ranked list of answers you can open. Refuses the full-screen
 * admin dashboard with a data grid and a sidebar.
 * OWN-WORLD: cool paper ground, heavy navy ink numerals, one brand-blue axis that carries the
 * verdict mark, hairline-ruled rows that shrink in rank like a fight card's undercard.
 * STORY: see both counts instantly, read who does not follow back, open a segment, protect,
 * select, confirm. Reading is fast; changing is slow and explicit.
 * FIRST VIEWPORT: Following count | axis with mark | Followers count, mutual line, status, the
 * primary audit button, then the segment rows.
 * FORM: report-first (grounded candidate 3), seed 9c07a5e2.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
import type { Copy, Locale } from '../i18n';
import logoDark from '../assets/logo-dark.svg';
import logo from '../assets/logo.svg';
import markDark from '../assets/mark-dark.svg';
import mark from '../assets/mark.svg';
import { WEBSITE_URL } from '../version';
import { icon, type IconName } from './icons';

export type Platform = 'instagram' | 'tiktok';
export type Segment = 'nonfollowers' | 'fans' | 'lost' | 'protected' | 'following' | 'followers' | 'requests';
export type ToolScreen = 'history' | 'activity';

const LANGUAGES: ReadonlyArray<readonly [Locale, string]> = [
  ['en', 'English'], ['pt-BR', 'Português'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'],
];

export const languageCode = (locale: Locale): string => locale === 'pt-BR' ? 'PT' : locale.toUpperCase();

/**
 * Both theme variants of the mark, with gradient ids unique per instance:
 * a url(#id) that resolves into a hidden SVG renders nothing.
 */
const marks = (prefix: string): string => `<span class="mark mark-light" aria-hidden="true">${mark.replaceAll('fa-', `${prefix}l-`)}</span><span class="mark mark-dark" aria-hidden="true">${markDark.replaceAll('fa-', `${prefix}d-`)}</span>`;

const segment = (id: Segment, label: keyof Copy, hint: keyof Copy | '', rank: 'major' | 'minor', copy: Copy): string =>
  `<button type="button" class="segment ${rank}" data-segment="${id}"><span class="segment-text"><strong data-copy="${label}">${copy[label]}</strong>${hint ? `<small id="hint-${id}" data-copy="${hint}">${copy[hint]}</small>` : ''}</span><span class="segment-count" id="count-${id}">—</span>${icon('chevron-right')}</button>`;

const tool = (id: ToolScreen, iconName: IconName, label: keyof Copy, hint: keyof Copy, copy: Copy): string =>
  `<button type="button" class="segment minor tool" data-screen="${id}">${icon(iconName)}<span class="segment-text"><strong data-copy="${label}">${copy[label]}</strong><small data-copy="${hint}">${copy[hint]}</small></span><span class="segment-count" id="count-${id}"></span>${icon('chevron-right')}</button>`;

/** A three-way filter: any value, only matching accounts, or only non-matching accounts. */
const filter = (id: string, label: keyof Copy, copy: Copy): string => `<fieldset class="filter" data-filter="${id}"><legend data-copy="${label}">${copy[label]}</legend><span class="choices">${
  (['any', 'yes', 'no'] as const).map(value => `<label><input type="radio" name="filter-${id}" value="${value}"${value === 'any' ? ' checked' : ''}><span data-copy="filter_${value}">${copy[`filter_${value}`]}</span></label>`).join('')
}</span></fieldset>`;

const shortcut = (keys: string, label: keyof Copy, copy: Copy): string => `<div class="shortcut"><span class="keys">${keys}</span><span data-copy="${label}">${copy[label]}</span></div>`;

/** Static shell of the panel. Dynamic text is filled by the controller through ids and data-copy attributes. */
export function layout(copy: Copy, locale: Locale, platform: Platform): string {
  const readOnly = platform === 'tiktok';
  const languages = LANGUAGES.map(([code, label]) => `<button type="button" role="menuitemradio" data-locale="${code}" lang="${code}"><span>${languageCode(code)}</span><strong>${label}</strong>${icon('check')}</button>`).join('');
  return `<div class="app" data-platform="${platform}" lang="${locale}" role="region" aria-label="FollowAudit">
  <header class="bar">
    <button id="back" class="icon-button" type="button" hidden data-copy-aria="back" aria-label="${copy.back}">${icon('chevron-left')}</button>
    <div class="brand"><span class="logo logo-light" aria-hidden="true">${logo.replaceAll('fa-', 'topl-')}</span><span class="logo logo-dark" aria-hidden="true">${logoDark.replaceAll('fa-', 'topd-')}</span></div>
    <div class="bar-actions">
      <details id="language-menu" class="language-menu">
        <summary id="language-summary" class="icon-button text" aria-label="${copy.language}: ${languageCode(locale)}"><span id="active-language">${languageCode(locale)}</span></summary>
        <div class="popover" role="menu"><p data-copy="language">${copy.language}</p>${languages}</div>
      </details>
      <button id="theme-toggle" class="icon-button" type="button" aria-label="${copy.theme_dark}"><span class="icon-sun">${icon('sun')}</span><span class="icon-moon">${icon('moon')}</span></button>
      <button id="nav-settings" class="icon-button" type="button" data-copy-aria="settings" aria-label="${copy.settings}">${icon('settings')}</button>
      <button id="minimize" class="icon-button" type="button" data-copy-aria="minimize" aria-label="${copy.minimize}">${icon('minimize')}</button>
      <button id="close" class="icon-button" type="button" data-copy-aria="close" aria-label="${copy.close}">${icon('close')}</button>
    </div>
  </header>
  <div class="progress" id="progress" data-state="idle" aria-hidden="true"><span></span></div>
  <main class="body">
    <section id="view-report" class="view" aria-labelledby="report-heading">
      <h1 id="report-heading" class="sr-only" data-copy="report_label">${copy.report_label}</h1>
      <div class="versus">
        <p class="side"><strong id="total-following">—</strong><span data-copy="following">${copy.following}</span></p>
        <span class="axis" aria-hidden="true"><span class="axis-mark">${marks('axis')}</span></span>
        <p class="side"><strong id="total-followers">—</strong><span data-copy="followers">${copy.followers}</span></p>
      </div>
      <p class="mutual" id="mutual" hidden></p>
      <p class="session" role="status" aria-live="polite"><span id="status-dot" data-mode="idle"></span><span id="status"></span></p>
      <div class="report-actions">
        <input id="tiktok-files" type="file" accept=".json,application/json" multiple hidden>
        <button id="scan" class="button primary" type="button">${icon('scan')}<span id="scan-label"></span></button>
        <button id="cancel" class="button quiet danger-text" type="button" hidden><span data-copy="cancel">${copy.cancel}</span></button>
      </div>
      <section id="resume" class="resume" hidden aria-labelledby="resume-title">
        <span class="resume-icon">${icon('play')}</span>
        <p><strong id="resume-title"></strong><span id="resume-body"></span></p>
        <div class="resume-actions"><button id="resume-discard" class="button quiet" type="button" data-copy="resume_discard">${copy.resume_discard}</button><button id="resume-run" class="button primary" type="button" data-copy="resume_run">${copy.resume_run}</button></div>
      </section>
      <p id="update-notice" class="update-notice" hidden>${icon('info')}<span><span id="update-text"></span> <a href="${WEBSITE_URL}" target="_blank" rel="noopener noreferrer" data-copy="update_link">${copy.update_link}</a></span></p>
      <div id="intro" class="intro">
        <h2 id="intro-title"></h2>
        <p id="intro-body"></p>
        <p class="assurance">${icon('lock')}<span data-copy="privacy_body">${copy.privacy_body}</span></p>
      </div>
      <button id="changes" class="changes" type="button" hidden>${icon('user-minus')}<span id="changes-label"></span></button>
      <nav id="segments" class="segments" data-copy-aria="report_label" aria-label="${copy.report_label}" hidden>
        ${segment('nonfollowers', 'seg_nonfollowers', 'hint_nonfollowers', 'major', copy)}
        ${segment('fans', 'seg_fans', 'hint_fans', 'major', copy)}
        ${segment('lost', 'view_lost', 'hint_lost', 'major', copy)}
        ${segment('protected', 'view_protected', 'hint_protected', 'minor', copy)}
        ${segment('following', 'seg_all_following', '', 'minor', copy)}
        ${segment('followers', 'seg_all_followers', '', 'minor', copy)}
        ${readOnly ? '' : segment('requests', 'seg_requests', 'hint_requests', 'minor', copy)}
      </nav>
      <nav id="tools" class="segments tools" data-copy-aria="report_label" aria-label="${copy.report_label}">
        ${tool('history', 'chart', 'nav_history', 'hint_history', copy)}
        ${readOnly ? '' : tool('activity', 'activity', 'nav_activity', 'hint_activity', copy)}
      </nav>
    </section>

    <section id="view-list" class="view" hidden aria-labelledby="list-title">
      <header class="list-head">
        <h1 id="list-title"></h1>
        <p id="list-hint"></p>
      </header>
      <div class="toolbar">
        <label class="search">${icon('search')}<span class="sr-only" data-copy="search">${copy.search}</span><input id="search" type="search" autocomplete="off" spellcheck="false" data-copy-placeholder="search" placeholder="${copy.search}"><kbd aria-hidden="true">/</kbd></label>
        <details id="filter-menu" class="menu" ${readOnly ? 'hidden' : ''}>
          <summary id="filter-toggle" class="icon-button outlined" data-copy-aria="filters" aria-label="${copy.filters}">${icon('filter')}<span id="filter-count" class="badge" hidden></span></summary>
          <div class="popover filters" role="group" data-copy-aria="filters" aria-label="${copy.filters}">
            <p data-copy="filters">${copy.filters}</p>
            ${filter('verified', 'filter_verified', copy)}${readOnly ? '' : filter('private', 'filter_private', copy) + filter('photo', 'filter_no_photo', copy)}
            <button id="filter-clear" type="button" class="link-button" data-copy="filter_clear">${copy.filter_clear}</button>
          </div>
        </details>
        <details id="select-menu" class="menu" ${readOnly ? 'hidden' : ''}>
          <summary id="select-toggle" class="icon-button outlined" data-copy-aria="selection_menu" aria-label="${copy.selection_menu}">${icon('select')}</summary>
          <div class="popover" role="menu">
            <p data-copy="selection_menu">${copy.selection_menu}</p>
            <button id="select-visible" type="button" role="menuitem"><span id="select-visible-label"></span><kbd>A</kbd></button>
            <button id="clear-selection" type="button" role="menuitem"><span data-copy="clear_selection">${copy.clear_selection}</span></button>
            <form id="select-first" class="select-first"><label for="select-first-count" data-copy="select_first">${copy.select_first}</label><input id="select-first-count" type="number" inputmode="numeric" min="1" max="10000" value="50"><button type="submit" class="button primary" data-copy="select_first_apply">${copy.select_first_apply}</button></form>
          </div>
        </details>
        <details id="export-menu" class="menu">
          <summary id="export" class="icon-button outlined" data-copy-aria="export" aria-label="${copy.export}">${icon('download')}</summary>
          <div class="popover" role="menu">
            <p data-copy="export">${copy.export}</p>
            <button type="button" role="menuitem" data-export="csv"><span data-copy="export_csv">${copy.export_csv}</span></button>
            <button type="button" role="menuitem" data-export="xlsx"><span data-copy="export_xlsx">${copy.export_xlsx}</span></button>
            <button type="button" role="menuitem" data-export="json"><span data-copy="export_json">${copy.export_json}</span></button>
          </div>
        </details>
      </div>
      <section id="requests-import" class="import-card" hidden aria-labelledby="requests-import-title">
        <h2 id="requests-import-title" data-copy="requests_import_title">${copy.requests_import_title}</h2>
        <p data-copy="requests_import_body">${copy.requests_import_body}</p>
        <input id="requests-file" type="file" accept=".json,application/json" multiple hidden>
        <button id="requests-import-button" type="button" class="button primary">${icon('upload')}<span data-copy="requests_import">${copy.requests_import}</span></button>
      </section>
      <div id="accounts" class="accounts" role="list"></div>
      <div id="preview-card" class="preview-card" hidden aria-hidden="true"></div>
    </section>

    <section id="view-history" class="view" hidden aria-labelledby="history-title">
      <header class="list-head"><h1 id="history-title" data-copy="nav_history">${copy.nav_history}</h1><p data-copy="history_body">${copy.history_body}</p></header>
      <figure id="history-chart" class="chart"></figure>
      <div id="history-list" class="history-list"></div>
    </section>

    <section id="view-activity" class="view" hidden aria-labelledby="activity-title">
      <header class="list-head"><h1 id="activity-title" data-copy="nav_activity">${copy.nav_activity}</h1><p data-copy="activity_body">${copy.activity_body}</p></header>
      <div class="toolbar activity-toolbar"><button id="select-undo" type="button" class="button quiet">${icon('undo')}<span data-copy="select_all_undo">${copy.select_all_undo}</span></button></div>
      <div id="activity-list" class="accounts" role="list"></div>
    </section>

    <section id="view-settings" class="view" hidden aria-labelledby="settings-title">
      <header class="list-head"><h1 id="settings-title" data-copy="settings_title">${copy.settings_title}</h1><p data-copy="settings_body">${copy.settings_body}</p></header>
      <section class="settings-group" ${readOnly ? 'hidden' : ''}>
        <h2 data-copy="settings_pacing">${copy.settings_pacing}</h2>
        <div class="setting-row"><label for="delay" data-copy="delay_label">${copy.delay_label}</label><span class="field"><input id="delay" type="number" inputmode="numeric" min="2" max="120" value="4"><span data-copy="delay_unit">${copy.delay_unit}</span></span></div>
        <div class="setting-row"><label for="batch-delay" data-copy="batch_label">${copy.batch_label}</label><span class="field"><input id="batch-delay" type="number" inputmode="numeric" min="1" max="30" value="5"><span data-copy="batch_unit">${copy.batch_unit}</span></span></div>
        <div class="setting-row"><label for="hourly-cap" data-copy="hourly_label">${copy.hourly_label}</label><span class="field"><input id="hourly-cap" type="number" inputmode="numeric" min="5" max="200" value="40"><span data-copy="hourly_unit">${copy.hourly_unit}</span></span></div>
        <p class="note">${icon('info')}<span data-copy="limits_notice">${copy.limits_notice}</span></p>
      </section>
      <section class="settings-group">
        <h2 data-copy="settings_display">${copy.settings_display}</h2>
        <div class="setting-row"><label for="compact" data-copy="compact_label">${copy.compact_label}</label><input id="compact" class="switch" type="checkbox" role="switch"></div>
        <button id="open-shortcuts" type="button" class="row-button">${icon('keyboard')}<span data-copy="shortcuts">${copy.shortcuts}</span><kbd>?</kbd></button>
      </section>
      <section class="settings-group">
        <h2 data-copy="settings_data">${copy.settings_data}</h2>
        <p class="settings-hint" data-copy="settings_data_body">${copy.settings_data_body}</p>
        <div class="settings-actions">
          <button id="backup-export" type="button" class="row-button">${icon('download')}<span data-copy="backup_export">${copy.backup_export}</span></button>
          <button id="backup-import" type="button" class="row-button">${icon('upload')}<span data-copy="backup_import">${copy.backup_import}</span></button>
          <input id="backup-file" type="file" accept=".json,application/json" hidden>
          <button id="clear-history" type="button" class="row-button danger-text">${icon('trash')}<span data-copy="clear_history">${copy.clear_history}</span></button>
        </div>
        <p id="settings-feedback" class="settings-feedback" role="status" aria-live="polite"></p>
      </section>
      <p class="version"><span id="version-line"></span> · <a href="${WEBSITE_URL}" target="_blank" rel="noopener noreferrer" data-copy="update_link">${copy.update_link}</a></p>
    </section>
  </main>
  <footer id="actionbar" class="actionbar" hidden>
    <p class="selection"><strong id="selection-count"></strong><span id="selection-context"></span></p>
    <button id="guided-review" class="button primary" type="button" hidden><span id="guided-review-label"></span>${icon('arrow')}</button>
    <button id="run-secondary" class="button outline" type="button" hidden><span id="run-secondary-label"></span></button>
    <button id="run" class="button primary" type="button" disabled ${readOnly ? 'hidden' : ''}><span id="run-label"></span>${icon('arrow')}</button>
  </footer>

  <dialog id="confirm-dialog" class="dialog" aria-labelledby="confirm-title">
    <section class="dialog-panel">
      <span id="confirm-icon" class="dialog-icon">${icon('shield')}</span>
      <h2 id="confirm-title" data-copy="confirm_title">${copy.confirm_title}</h2>
      <p id="confirm-body"></p>
      <p class="list-label" data-copy="confirm_list">${copy.confirm_list}</p>
      <div id="confirm-accounts" class="confirm-accounts"></div>
      <footer><button type="button" class="button quiet" data-close-dialog data-copy="confirm_cancel">${copy.confirm_cancel}</button><button id="confirm-action" type="button" class="button danger"><span id="confirm-action-label"></span></button></footer>
    </section>
  </dialog>
  <dialog id="shortcuts-dialog" class="dialog" aria-labelledby="shortcuts-title">
    <section class="dialog-panel">
      <span class="dialog-icon">${icon('keyboard')}</span>
      <h2 id="shortcuts-title" data-copy="shortcuts">${copy.shortcuts}</h2>
      <div class="shortcuts">
        ${shortcut('<kbd>/</kbd>', 'sc_search', copy)}
        ${shortcut('<kbd>J</kbd><kbd>K</kbd>', 'sc_move', copy)}
        ${readOnly ? '' : shortcut('<kbd>X</kbd>', 'sc_toggle', copy) + shortcut(`<kbd>Shift</kbd>+<span data-copy="sc_click">${copy.sc_click}</span>`, 'sc_range', copy) + shortcut('<kbd>A</kbd>', 'sc_select_visible', copy)}
        ${shortcut('<kbd>P</kbd>', 'sc_protect', copy)}
        ${shortcut('<kbd>Esc</kbd>', 'sc_back', copy)}
        ${shortcut('<kbd>?</kbd>', 'sc_help', copy)}
      </div>
      <footer><button type="button" class="button primary" data-close-dialog data-copy="shortcuts_close">${copy.shortcuts_close}</button></footer>
    </section>
  </dialog>
  <dialog id="guided-review-dialog" class="dialog" aria-labelledby="guided-title">
    <section class="dialog-panel">
      <span class="dialog-icon">${icon('shield-check')}</span>
      <h2 id="guided-title" data-copy="tiktok_review_title">${copy.tiktok_review_title}</h2>
      <p data-copy="tiktok_review_body">${copy.tiktok_review_body}</p>
      <p id="guided-review-position" class="list-label"></p>
      <div class="guided-account"><strong id="guided-review-account"></strong><a id="guided-review-open" class="button primary" target="_blank" rel="noopener noreferrer"></a></div>
      <p class="note">${icon('info')}<span data-copy="tiktok_review_notice">${copy.tiktok_review_notice}</span></p>
      <footer><button id="guided-review-skip" type="button" class="button quiet" data-copy="tiktok_review_skip">${copy.tiktok_review_skip}</button><button id="guided-review-done" type="button" class="button primary" data-copy="tiktok_review_done">${copy.tiktok_review_done}</button></footer>
    </section>
  </dialog>
</div>
<button id="pill" class="pill" type="button" hidden data-copy-aria="restore" aria-label="${copy.restore}">${marks('pill')}<span id="pill-status"></span></button>`;
}
