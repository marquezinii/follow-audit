import {
  appendHistory, appendLog, hourlyWaitMs, jitter, parseHistory, parseLog, parsePendingRequestsExport, parseSavedQueue, remainingItems,
  requestAccount, savedQueue, toJson, toQueueItem, undoableUnfollows, USERNAME_ID_PREFIX,
  type ActionKind, type HistoryPoint, type LogEntry, type QueueItem, type SavedQueue,
} from './actions';
import {
  QueueHaltedError, diffSnapshot, estimateRemainingMs, runSequential, toCsv, toSnapshot, wait,
  type Account, type FollowerChanges, type ListKind, type QueueTiming,
} from './core';
import { format, resolveLocale, translations, type CopyKey, type Locale } from './i18n';
import { InstagramGateway, UnexpectedResponseError, currentUserId, isBlockingError } from './instagram';
import { previewAccounts, previewBaseline, previewHistory, previewLog, previewRequests } from './preview';
import {
  STORAGE_PREFIX, clearHistory, historyKey, loadIds, loadSnapshot, logKey, parseProtectedBackup, protectedBackup, queueKey, readJson, readText,
  removeKey, saveIds, saveSnapshot, snapshotKey, writeJson, writeText,
} from './storage';
import { parseTikTokExport, pendingTikTokReviewAccounts } from './tiktok';
import { icon } from './ui/icons';
import { languageCode, layout, type Platform, type Segment, type ToolScreen } from './ui/layout';
import { styles } from './ui/styles';
import { RELEASED, VERSION, isStale } from './version';
import { toXlsx } from './xlsx';

const HOST_ID = 'follow-audit-app';
const LOCALE_KEY = `${STORAGE_PREFIX}language`;
const THEME_KEY = `${STORAGE_PREFIX}theme`;
const DENSITY_KEY = `${STORAGE_PREFIX}density`;
const PACING_KEY = `${STORAGE_PREFIX}pacing`;
const TIKTOK_REVIEWED_KEY = `${STORAGE_PREFIX}tiktok:reviewed`;
const PAGE_SIZE = 200;
const ACTIVITY_PAGE = 300;
const MAX_EXPORT_FILES = 20;
const MAX_EXPORT_BYTES = 50_000_000;
const MAX_BACKUP_BYTES = 2_000_000;

const { hostname } = location;
const previewMode = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
  || (hostname === 'marquezinii.github.io' && location.pathname.endsWith('/follow-audit/preview.html'));
const instagramHost = hostname === 'instagram.com' || hostname.endsWith('.instagram.com');
const tiktokHost = hostname === 'tiktok.com' || hostname.endsWith('.tiktok.com');
const platform: Platform = tiktokHost || (previewMode && new URL(location.href).searchParams.get('platform') === 'tiktok') ? 'tiktok' : 'instagram';
const readOnly = platform === 'tiktok';
const PROTECTED_KEY = readOnly ? `${STORAGE_PREFIX}tiktok:protected` : `${STORAGE_PREFIX}protected`;

/** Neutral silhouette for missing or expired profile pictures. */
const AVATAR_FALLBACK = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#e3e8f0"/><circle cx="20" cy="16" r="7" fill="#a9b4c5"/><path d="M6 38c1.6-7.5 7.3-11 14-11s12.4 3.5 14 11" fill="#a9b4c5"/></svg>')}`;

type Mode = 'idle' | 'scanning' | 'ready' | 'running' | 'error';
type Screen = 'report' | 'list' | 'settings' | ToolScreen;
type Theme = 'light' | 'dark';
type Values = Record<string, string | number>;
type WorkspaceKind = ListKind | 'requests';
type FilterName = 'verified' | 'private' | 'photo';
type FilterValue = 'any' | 'yes' | 'no';

interface Result {
  readonly action: ActionKind;
  readonly ok: boolean;
  readonly message: string;
}

interface WorkspaceState {
  accounts: readonly Account[];
  readonly selected: Set<string>;
  readonly results: Map<string, Result>;
}

/** The workspace a segment's rows belong to; null when a segment mixes both lists. */
const SEGMENT_WORKSPACE: Record<Segment, WorkspaceKind | null> = {
  nonfollowers: 'following', fans: 'followers', lost: 'followers', protected: null, following: 'following', followers: 'followers', requests: 'requests',
};
/** Actions offered per segment; the last one is the primary button. */
const SEGMENT_ACTIONS: Record<Segment, readonly ActionKind[]> = {
  nonfollowers: ['unfollow'], fans: ['remove', 'follow'], lost: [], protected: [], following: ['unfollow'], followers: ['remove'], requests: ['cancel'],
};
const SEGMENT_COPY: Record<Segment, { readonly title: CopyKey; readonly hint?: CopyKey }> = {
  nonfollowers: { title: 'seg_nonfollowers', hint: 'hint_nonfollowers' },
  fans: { title: 'seg_fans', hint: 'hint_fans' },
  lost: { title: 'view_lost', hint: 'hint_lost' },
  protected: { title: 'view_protected', hint: 'hint_protected' },
  following: { title: 'seg_all_following' },
  followers: { title: 'seg_all_followers' },
  requests: { title: 'seg_requests', hint: 'hint_requests' },
};
const ACTION_COPY: Record<ActionKind, { readonly review: CopyKey; readonly body: CopyKey; readonly confirm: CopyKey; readonly done: CopyKey; readonly log: CopyKey; readonly name: CopyKey }> = {
  unfollow: { review: 'review_unfollow', body: 'confirm_unfollow_body', confirm: 'confirm_unfollow', done: 'unfollowed', log: 'log_unfollow', name: 'action_unfollow' },
  remove: { review: 'review_remove', body: 'confirm_remove_body', confirm: 'confirm_remove', done: 'removed', log: 'log_remove', name: 'action_remove' },
  follow: { review: 'review_follow', body: 'confirm_follow_body', confirm: 'confirm_follow', done: 'followed', log: 'log_follow', name: 'action_follow' },
  cancel: { review: 'review_cancel', body: 'confirm_withdraw_body', confirm: 'confirm_withdraw', done: 'request_cancelled', log: 'log_cancel', name: 'action_cancel' },
};
/** Workspaces whose rows reflect the result of an action. */
const RESULT_WORKSPACES: Record<ActionKind, readonly WorkspaceKind[]> = {
  unfollow: ['following'], remove: ['followers'], follow: ['followers', 'following'], cancel: ['requests'],
};

function start(): void {
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.append(host);
  const root = host.attachShadow({ mode: 'open' });
  let locale = resolveLocale(readText(LOCALE_KEY), navigator.language);
  let copy = translations[locale];
  let theme = initialTheme();
  host.dataset.theme = theme;
  if (readText(DENSITY_KEY) === 'compact') host.dataset.density = 'compact';
  root.innerHTML = `<style>${styles}</style>${layout(copy, locale, platform)}`;

  const gateway = new InstagramGateway();
  const owner = previewMode ? 'preview' : readOnly ? 'export' : currentUserId();
  const protectedIds = loadIds(PROTECTED_KEY);
  const reviewedIds = readOnly ? loadIds(TIKTOK_REVIEWED_KEY) : new Set<string>();
  const workspaces: Record<WorkspaceKind, WorkspaceState> = {
    following: { accounts: [], selected: new Set(), results: new Map() },
    followers: { accounts: [], selected: new Set(), results: new Map() },
    requests: { accounts: [], selected: new Set(), results: new Map() },
  };
  let log: LogEntry[] = previewMode ? previewLog() : owner && !readOnly ? parseLog(readJson(logKey(owner))) : [];
  let history: HistoryPoint[] = previewMode ? previewHistory() : owner ? parseHistory(readJson(historyKey(platform, owner))) : [];
  let pendingQueue: SavedQueue | undefined = !readOnly && !previewMode && owner ? parseSavedQueue(readJson(queueKey(owner))) : undefined;
  if (pendingQueue && (pendingQueue.owner !== owner || remainingItems(pendingQueue).length === 0)) pendingQueue = undefined;
  const filters: Record<FilterName, FilterValue> = { verified: 'any', private: 'any', photo: 'any' };
  const activitySelected = new Set<string>();
  let requestsImported = false;
  let contractBroken = false;
  let audited = false;
  let mode: Mode = 'idle';
  let screen: Screen = 'report';
  let segment: Segment = 'nonfollowers';
  let query = '';
  /** -1 = indeterminate, 0 = hidden, 1–99 = determinate, 100 = done. */
  let progress = 0;
  let limit = PAGE_SIZE;
  let activityLimit = ACTIVITY_PAGE;
  let statusKey: CopyKey = readOnly ? 'tiktok_status_ready' : 'status_ready';
  let statusValues: Values = {};
  let controller: AbortController | undefined;
  let confirmed: { action: ActionKind; items: readonly QueueItem[]; resume?: SavedQueue } | undefined;
  let changes: FollowerChanges | 'baseline' | undefined;
  let reviewQueue: readonly Account[] = [];
  let reviewIndex = 0;
  /** Index (in the visible list) of the last checkbox clicked, for Shift+click ranges. */
  let anchorIndex: number | undefined;
  let previewTimer: ReturnType<typeof setTimeout> | undefined;

  const get = <T extends Element = HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  };
  const app = get('.app');
  const text = (key: CopyKey, values: Values = {}): string => format(copy, key, values);
  const setStatus = (key: CopyKey, values: Values = {}): void => { statusKey = key; statusValues = values; };
  const number = (value: number): string => value.toLocaleString(locale);
  const formatDate = (iso: string, style: 'medium' | 'short' = 'medium'): string => new Intl.DateTimeFormat(locale, { dateStyle: style }).format(new Date(iso));
  const formatDateTime = (iso: string): string => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const locked = (): boolean => mode === 'scanning' || mode === 'running';
  const sinceDate = (): string => typeof changes === 'object' ? formatDate(changes.since) : '';

  // ── Settings that live in this browser ──────────────────────────────────
  const pacingInputs = { delay: get<HTMLInputElement>('#delay'), batchDelay: get<HTMLInputElement>('#batch-delay'), hourlyCap: get<HTMLInputElement>('#hourly-cap') };
  const savedPacing = readJson(PACING_KEY);
  if (typeof savedPacing === 'object' && savedPacing !== null) {
    for (const [name, input] of Object.entries(pacingInputs)) {
      const value = (savedPacing as Record<string, unknown>)[name];
      if (typeof value === 'number' && Number.isFinite(value)) input.value = String(value);
    }
  }
  const pacing = (): { delay: number; batchDelay: number; hourlyCap: number } => ({
    delay: numberInput(pacingInputs.delay, 2, 120, 4),
    batchDelay: numberInput(pacingInputs.batchDelay, 1, 30, 5),
    hourlyCap: numberInput(pacingInputs.hourlyCap, 5, 200, 40),
  });
  const persistLog = (): void => { if (!previewMode && owner && !readOnly) writeJson(logKey(owner), log); };
  const persistQueue = (queue: SavedQueue | undefined): void => {
    pendingQueue = queue;
    if (previewMode || !owner || readOnly) return;
    if (queue) writeJson(queueKey(owner), queue); else removeKey(queueKey(owner));
  };

  // ── Derived views ───────────────────────────────────────────────────────
  const lostAccounts = (): readonly Account[] => {
    if (typeof changes !== 'object') return [];
    const following = new Set(workspaces.following.accounts.map(account => account.id));
    return changes.lost.map(entry => ({
      ...entry, avatarUrl: '', isPrivate: false, isVerified: false, followsYou: false, youFollow: following.has(entry.id),
    }));
  };
  const segmentAccounts = (target: Segment): readonly Account[] => {
    const { following, followers, requests } = workspaces;
    switch (target) {
      case 'nonfollowers': return following.accounts.filter(account => !account.followsYou);
      case 'fans': return followers.accounts.filter(account => !account.youFollow);
      case 'lost': return lostAccounts();
      case 'following': return following.accounts;
      case 'followers': return followers.accounts;
      case 'requests': return requests.accounts;
      case 'protected': {
        const seen = new Set<string>();
        return [...following.accounts, ...followers.accounts].filter(account => protectedIds.has(account.id) && !seen.has(account.id) && seen.add(account.id));
      }
    }
  };
  const matchesFilters = (account: Account): boolean => {
    const check = (value: FilterValue, actual: boolean): boolean => value === 'any' || (value === 'yes') === actual;
    return check(filters.verified, account.isVerified) && check(filters.private, account.isPrivate) && check(filters.photo, Boolean(account.hasAnonymousAvatar));
  };
  const activeFilters = (): number => Object.values(filters).filter(value => value !== 'any').length;
  const visibleAccounts = (): readonly Account[] => {
    const needle = query.trim().replace(/^@/, '').toLocaleLowerCase(locale);
    return segmentAccounts(segment).filter(account => matchesFilters(account) && (needle === ''
      || account.username.toLocaleLowerCase(locale).includes(needle) || account.name.toLocaleLowerCase(locale).includes(needle)));
  };
  /** Actions available on the current screen; the last one is the primary button. */
  const availableActions = (): readonly ActionKind[] => {
    if (readOnly) return [];
    if (screen === 'activity') return ['follow'];
    return screen === 'list' ? SEGMENT_ACTIONS[segment] : [];
  };
  /** The workspace whose selection the current list changes; null when nothing can be selected. */
  const actionWorkspace = (): WorkspaceKind | null => screen === 'list' && availableActions().length > 0 ? SEGMENT_WORKSPACE[segment] : null;
  const isSelectable = (account: Account): boolean => {
    const kind = actionWorkspace();
    return kind !== null && !protectedIds.has(account.id) && workspaces[kind].results.get(account.id)?.ok !== true;
  };
  const undoable = (): LogEntry[] => undoableUnfollows(log).filter(entry => !protectedIds.has(entry.id));
  const reviewableAccounts = (includeReviewed = false): readonly Account[] => readOnly && segment === 'nonfollowers'
    ? pendingTikTokReviewAccounts(visibleAccounts(), protectedIds, includeReviewed ? new Set() : reviewedIds)
    : [];
  const formatDuration = (ms: number): string => {
    const minutes = ms >= 60_000;
    const value = minutes ? Math.round(ms / 60_000) : Math.max(1, Math.round(ms / 1_000));
    return new Intl.NumberFormat(locale, { style: 'unit', unit: minutes ? 'minute' : 'second', unitDisplay: 'long' }).format(value);
  };
  /** Accepted requests show up in Following; cancelling them would unfollow, so they leave the requests list. */
  const pruneRequests = (): void => {
    const following = new Set(workspaces.following.accounts.map(account => account.username.toLowerCase()));
    workspaces.requests.accounts = workspaces.requests.accounts.filter(account => !following.has(account.username.toLowerCase()));
  };

  const applyCopy = (): void => {
    app.lang = locale;
    root.querySelectorAll<HTMLElement>('[data-copy]').forEach(element => { element.textContent = text(element.dataset.copy as CopyKey); });
    root.querySelectorAll<HTMLInputElement>('[data-copy-placeholder]').forEach(element => { element.placeholder = text(element.dataset.copyPlaceholder as CopyKey); });
    root.querySelectorAll<HTMLElement>('[data-copy-aria]').forEach(element => element.setAttribute('aria-label', text(element.dataset.copyAria as CopyKey)));
    get('#active-language').textContent = languageCode(locale);
    get('#language-summary').setAttribute('aria-label', `${text('language')}: ${languageCode(locale)}`);
    root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => button.setAttribute('aria-checked', String(button.dataset.locale === locale)));
    get('#theme-toggle').setAttribute('aria-label', text(theme === 'dark' ? 'theme_light' : 'theme_dark'));
    get('#version-line').textContent = text('version_line', { version: VERSION, date: formatDate(`${RELEASED}T12:00:00Z`) });
  };

  /** Everything except the account rows; cheap enough for every progress tick. */
  const renderChrome = (): void => {
    const busy = locked();
    const status = text(statusKey, statusValues);
    app.dataset.state = audited ? 'ready' : 'idle';
    app.dataset.mode = mode;
    get('#status').textContent = status;
    get('#pill-status').textContent = status;
    get('#status-dot').dataset.mode = mode;
    get('#progress').dataset.state = progress < 0 ? 'indeterminate' : progress === 0 || progress === 100 ? 'idle' : 'determinate';
    get('#progress span').style.transform = progress > 0 && progress < 100 ? `scaleX(${progress / 100})` : '';

    for (const view of ['report', 'list', 'settings', 'history', 'activity'] as const) get(`#view-${view}`).hidden = screen !== view;
    get('#back').hidden = screen === 'report';
    get('#nav-settings').hidden = screen === 'settings';

    // Report
    const { following, followers } = workspaces;
    get('#total-following').textContent = audited ? number(following.accounts.length) : '—';
    get('#total-followers').textContent = audited ? number(followers.accounts.length) : '—';
    const digits = Math.max(number(following.accounts.length).length, number(followers.accounts.length).length);
    get('.versus').dataset.digits = digits <= 3 ? 's' : digits <= 5 ? 'm' : 'l';
    const mutual = get('#mutual');
    mutual.hidden = !audited;
    mutual.textContent = text('mutual', { count: number(following.accounts.filter(account => account.followsYou).length) });
    get('#scan').hidden = busy;
    get('#scan-label').textContent = text(readOnly ? audited ? 'tiktok_reimport' : 'tiktok_import' : audited ? 'refresh' : 'audit');
    get('#cancel').hidden = !busy;
    get('#intro').hidden = audited;
    get('#intro-title').textContent = text(readOnly ? 'tiktok_empty_title' : 'empty_initial_title');
    get('#intro-body').textContent = text(readOnly ? 'tiktok_empty_body' : 'empty_initial_body');
    const resume = get('#resume');
    resume.hidden = !pendingQueue || busy;
    if (pendingQueue) {
      get('#resume-title').textContent = text('resume_title', { count: number(remainingItems(pendingQueue).length) });
      get('#resume-body').textContent = text('resume_body', { action: text(ACTION_COPY[pendingQueue.action].name), date: formatDateTime(pendingQueue.createdAt) });
    }
    get('#update-notice').hidden = !(contractBroken || (!previewMode && isStale(new Date())));
    get('#update-text').textContent = contractBroken ? text('status_contract_changed') : text('update_stale', { date: formatDate(`${RELEASED}T12:00:00Z`) });
    const chip = get<HTMLButtonElement>('#changes');
    chip.hidden = changes !== 'baseline';
    chip.setAttribute('aria-disabled', 'true');
    get('#changes-label').textContent = text('changes_baseline');
    get('#segments').hidden = !audited;
    root.querySelectorAll<HTMLButtonElement>('[data-segment]').forEach(button => {
      const id = button.dataset.segment as Segment;
      const count = segmentAccounts(id).length;
      get(`#count-${id}`).textContent = id === 'requests' && !requestsImported ? '—' : number(count);
      button.dataset.nonzero = String(count > 0);
      button.disabled = mode === 'scanning';
    });
    get('[data-segment="lost"]').hidden = typeof changes !== 'object';
    get('#hint-lost').textContent = text('hint_lost', { date: sinceDate() });
    get('#count-history').textContent = history.length > 0 ? number(history.length) : '';
    if (!readOnly) get('#count-activity').textContent = log.length > 0 ? number(log.length) : '';
    root.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach(button => { button.disabled = mode === 'scanning'; });

    // List
    const kind = actionWorkspace();
    const { title, hint } = SEGMENT_COPY[segment];
    get('#list-title').textContent = `${text(title)} · ${number(segmentAccounts(segment).length)}`;
    get('#list-hint').textContent = hint ? text(hint, { date: sinceDate() }) : '';
    get('#list-hint').hidden = !hint;
    get<HTMLInputElement>('#search').disabled = mode === 'scanning';
    const visible = visibleAccounts();
    get('#export').toggleAttribute('aria-disabled', visible.length === 0);
    get('#export-menu').classList.toggle('disabled', visible.length === 0);
    const filterCount = activeFilters();
    get('#filter-count').hidden = filterCount === 0;
    get('#filter-count').textContent = String(filterCount);
    get('#requests-import').hidden = segment !== 'requests' || requestsImported;
    const selectable = visible.slice(0, limit).filter(isSelectable);
    const selected = kind ? workspaces[kind].selected : new Set<string>();
    const allSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));
    get('#select-menu').hidden = kind === null;
    get<HTMLButtonElement>('#select-visible').disabled = busy || selectable.length === 0;
    get('#select-visible-label').textContent = text(allSelected ? 'clear_visible' : 'select_visible');
    get<HTMLButtonElement>('#clear-selection').disabled = busy || selected.size === 0;

    // Action bar
    const actions = availableActions();
    const pendingReview = reviewableAccounts();
    const restartableReview = reviewableAccounts(true);
    const guided = get<HTMLButtonElement>('#guided-review');
    guided.hidden = screen !== 'list' || restartableReview.length === 0;
    guided.disabled = busy;
    get('#guided-review-label').textContent = text(pendingReview.length > 0 ? 'tiktok_guided_start' : 'tiktok_guided_restart', { count: pendingReview.length || restartableReview.length });
    const activityMode = screen === 'activity';
    const count = activityMode ? activitySelected.size : selected.size;
    get('#actionbar').hidden = activityMode ? undoable().length === 0 || readOnly : screen !== 'list' || (actions.length === 0 && guided.hidden);
    get('#selection-count').textContent = readOnly ? text('tiktok_safety_title') : count === 0 ? text('selection_none') : text('selection_count', { count: number(count) });
    get('#selection-context').textContent = readOnly ? text('tiktok_review_notice') : '';
    const primary = actions[actions.length - 1];
    const secondary = actions.length > 1 ? actions[0] : undefined;
    const run = get<HTMLButtonElement>('#run');
    run.hidden = primary === undefined;
    run.disabled = busy || count === 0;
    if (primary) get('#run-label').textContent = text(activityMode ? 'review_undo' : ACTION_COPY[primary].review, { count: number(count) });
    const runSecondary = get<HTMLButtonElement>('#run-secondary');
    runSecondary.hidden = secondary === undefined;
    runSecondary.disabled = busy || count === 0;
    if (secondary) get('#run-secondary-label').textContent = text(secondary === 'remove' ? 'remove_short' : ACTION_COPY[secondary].review, { count: number(count) });
  };

  // ── Rows ────────────────────────────────────────────────────────────────
  const owningWorkspace = (account: Account): WorkspaceKind => SEGMENT_WORKSPACE[segment]
    ?? (workspaces.following.accounts.includes(account) ? 'following' : 'followers');

  const showPreview = (account: Account, row: HTMLElement): void => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const card = get('#preview-card');
      const avatar = document.createElement('img');
      avatar.alt = '';
      avatar.src = account.avatarUrl || AVATAR_FALLBACK;
      avatar.addEventListener('error', () => { avatar.src = AVATAR_FALLBACK; }, { once: true });
      const name = document.createElement('strong');
      name.textContent = account.name || `@${account.username}`;
      const handle = document.createElement('span');
      handle.textContent = `@${account.username}`;
      const meta = document.createElement('span');
      meta.className = 'meta';
      const labels: [boolean, string][] = [
        [account.followsYou, text('following_you')], [account.youFollow, text('you_follow')], [account.isVerified, text('verified')],
        [account.isPrivate, text('private')], [Boolean(account.hasAnonymousAvatar), text('no_photo')], [protectedIds.has(account.id), text('protected')],
      ];
      for (const [on, label] of labels) if (on) meta.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: label }));
      card.replaceChildren(avatar, name, ...(account.name ? [handle] : []), meta);
      card.hidden = false;
      const bounds = row.getBoundingClientRect();
      card.style.top = `${Math.max(12, Math.min(bounds.top - 40, innerHeight - card.offsetHeight - 12))}px`;
    }, 350);
  };
  const hidePreview = (): void => {
    clearTimeout(previewTimer);
    get('#preview-card').hidden = true;
  };

  const accountRow = (account: Account, index: number, busy: boolean): HTMLElement => {
    const kind = actionWorkspace();
    const result = workspaces[owningWorkspace(account)].results.get(account.id);
    const selected = kind ? workspaces[kind].selected : undefined;
    const isProtected = protectedIds.has(account.id);
    const row = document.createElement('article');
    row.className = selected ? 'row' : 'row readonly';
    row.setAttribute('role', 'listitem');
    row.dataset.result = result ? result.ok ? 'ok' : 'error' : '';
    row.dataset.selected = String(Boolean(selected?.has(account.id)));

    if (selected) {
      const choice = document.createElement('label');
      choice.className = 'check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(account.id);
      checkbox.disabled = busy || !isSelectable(account);
      checkbox.setAttribute('aria-label', text('select_account', { username: account.username }));
      checkbox.addEventListener('click', event => {
        const range = event.shiftKey && anchorIndex !== undefined && anchorIndex !== index;
        if (range) {
          const [from, to] = [Math.min(anchorIndex!, index), Math.max(anchorIndex!, index)];
          for (const candidate of visibleAccounts().slice(from, to + 1)) {
            if (!isSelectable(candidate)) continue;
            if (checkbox.checked) selected.add(candidate.id); else selected.delete(candidate.id);
          }
        } else if (checkbox.checked) selected.add(account.id); else selected.delete(account.id);
        anchorIndex = index;
        if (range) render();
        else {
          row.dataset.selected = String(checkbox.checked);
          renderChrome();
        }
      });
      choice.append(checkbox, document.createElement('span'));
      row.append(choice);
    }

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.alt = '';
    avatar.loading = 'lazy';
    avatar.decoding = 'async';
    avatar.src = account.avatarUrl || AVATAR_FALLBACK;
    avatar.addEventListener('error', () => { avatar.src = AVATAR_FALLBACK; }, { once: true });

    const identity = document.createElement('div');
    identity.className = 'identity';
    const name = document.createElement('a');
    name.className = 'name';
    name.href = readOnly ? `https://www.tiktok.com/@${encodeURIComponent(account.username)}` : `https://www.instagram.com/${encodeURIComponent(account.username)}/`;
    name.target = '_blank';
    name.rel = 'noopener noreferrer';
    name.textContent = account.name || `@${account.username}`;
    identity.append(name);
    if (account.name) {
      const handle = document.createElement('span');
      handle.className = 'handle';
      handle.textContent = `@${account.username}`;
      identity.append(handle);
    }
    const meta = document.createElement('span');
    meta.className = 'meta';
    const tag = (label: string, tone: 'ok' | 'bad' | 'info' | ''): void => {
      const element = document.createElement('span');
      if (tone) element.className = `tag ${tone}`;
      element.textContent = label;
      meta.append(element);
    };
    if (result?.ok) tag(text(ACTION_COPY[result.action].done), 'ok');
    else if (result) tag(`${text('failed')}: ${result.message}`, 'bad');
    if (segment === 'following') tag(text(account.followsYou ? 'following_you' : 'view_nonfollowers'), account.followsYou ? 'ok' : 'bad');
    if (segment === 'followers' || (segment === 'lost' && workspaces.following.accounts.length > 0)) tag(text(account.youFollow ? 'you_follow' : 'view_not_followed'), account.youFollow ? 'ok' : '');
    if (readOnly && reviewedIds.has(account.id)) tag(text('tiktok_reviewed'), 'info');
    if (account.isVerified) tag(text('verified'), '');
    if (account.isPrivate && segment !== 'requests') tag(text('private'), '');
    if (account.hasAnonymousAvatar) tag(text('no_photo'), '');
    identity.append(meta);

    const protect = document.createElement('button');
    protect.type = 'button';
    protect.className = 'protect';
    protect.disabled = busy;
    protect.setAttribute('aria-pressed', String(isProtected));
    protect.setAttribute('aria-label', `${text(isProtected ? 'unprotect' : 'protect')} @${account.username}`);
    protect.title = text(isProtected ? 'unprotect' : 'protect');
    protect.innerHTML = icon(isProtected ? 'shield-check' : 'shield');
    protect.addEventListener('click', () => {
      if (protectedIds.has(account.id)) protectedIds.delete(account.id);
      else {
        protectedIds.add(account.id);
        for (const workspace of Object.values(workspaces)) workspace.selected.delete(account.id);
      }
      if (!saveIds(PROTECTED_KEY, protectedIds)) setStatus('protected_save_error');
      render();
      root.querySelectorAll<HTMLElement>('#accounts .row')[index]?.querySelector<HTMLButtonElement>('.protect')?.focus();
    });

    row.addEventListener('mouseenter', () => showPreview(account, row));
    row.addEventListener('mouseleave', hidePreview);
    name.addEventListener('focus', () => showPreview(account, row));
    name.addEventListener('blur', hidePreview);
    row.append(avatar, identity, protect);
    return row;
  };

  const emptyState = (iconName: 'search' | 'check' | 'activity' | 'chart', title: CopyKey, body: CopyKey): HTMLElement => {
    const empty = document.createElement('section');
    empty.className = 'empty';
    empty.innerHTML = `${icon(iconName)}<h2></h2><p></p>`;
    empty.querySelector('h2')!.textContent = text(title);
    empty.querySelector('p')!.textContent = text(body);
    return empty;
  };

  const renderList = (): void => {
    if (screen !== 'list') return;
    hidePreview();
    const container = get('#accounts');
    container.replaceChildren();
    if (mode === 'scanning') {
      container.append(...Array.from({ length: 6 }, () => Object.assign(document.createElement('div'), { className: 'skeleton' })));
      return;
    }
    if (segment === 'requests' && !requestsImported) return;
    const visible = visibleAccounts();
    if (visible.length === 0) {
      const lostEmpty = segment === 'lost' && !query && activeFilters() === 0;
      container.append(emptyState(query ? 'search' : 'check', lostEmpty ? 'empty_lost_title' : 'empty_filtered_title', lostEmpty ? 'empty_lost_body' : 'empty_filtered_body'));
      return;
    }
    const busy = locked();
    const fragment = document.createDocumentFragment();
    visible.slice(0, limit).forEach((account, index) => fragment.append(accountRow(account, index, busy)));
    if (visible.length > limit) {
      const more = document.createElement('div');
      more.className = 'more';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = `+ ${number(visible.length - limit)}`;
      button.addEventListener('click', () => { limit += PAGE_SIZE; render(); });
      more.append(button);
      fragment.append(more);
    }
    container.append(fragment);
  };

  const renderActivity = (): void => {
    if (screen !== 'activity') return;
    const container = get('#activity-list');
    container.replaceChildren();
    get('#select-undo').hidden = undoable().length === 0;
    if (log.length === 0) {
      container.append(emptyState('activity', 'activity_empty_title', 'activity_empty_body'));
      return;
    }
    const undoableIds = new Set(undoable().map(entry => entry.id));
    const busy = locked();
    const fragment = document.createDocumentFragment();
    // The latest undoable entry of each account carries the checkbox.
    const checkboxFor = new Set<LogEntry>(undoable());
    const entries = [...log].reverse();
    for (const entry of entries.slice(0, activityLimit)) {
      const row = document.createElement('article');
      row.className = 'row activity-row';
      row.setAttribute('role', 'listitem');
      row.dataset.result = entry.ok ? '' : 'error';
      const withCheckbox = checkboxFor.has(entry) && undoableIds.has(entry.id);
      row.dataset.selected = String(withCheckbox && activitySelected.has(entry.id));
      const choice = document.createElement('label');
      choice.className = 'check';
      if (withCheckbox) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = activitySelected.has(entry.id);
        checkbox.disabled = busy;
        checkbox.setAttribute('aria-label', text('select_account', { username: entry.username }));
        checkbox.addEventListener('change', () => {
          if (checkbox.checked) activitySelected.add(entry.id); else activitySelected.delete(entry.id);
          row.dataset.selected = String(checkbox.checked);
          renderChrome();
        });
        choice.append(checkbox, document.createElement('span'));
      }
      const identity = document.createElement('div');
      identity.className = 'identity';
      const name = document.createElement('a');
      name.className = 'name';
      name.href = `https://www.instagram.com/${encodeURIComponent(entry.username)}/`;
      name.target = '_blank';
      name.rel = 'noopener noreferrer';
      name.textContent = entry.name || `@${entry.username}`;
      const meta = document.createElement('span');
      meta.className = 'meta';
      const action = Object.assign(document.createElement('span'), { className: 'tag', textContent: text(ACTION_COPY[entry.action].log) });
      const time = document.createElement('time');
      time.dateTime = entry.at;
      time.textContent = formatDateTime(entry.at);
      meta.append(action, ...(entry.ok ? [] : [Object.assign(document.createElement('span'), { className: 'tag bad', textContent: text('failed') })]), time);
      identity.append(name, ...(entry.name ? [Object.assign(document.createElement('span'), { className: 'handle', textContent: `@${entry.username}` })] : []), meta);
      row.append(choice, identity);
      fragment.append(row);
    }
    if (entries.length > activityLimit) {
      const more = document.createElement('div');
      more.className = 'more';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button';
      button.textContent = `+ ${number(entries.length - activityLimit)}`;
      button.addEventListener('click', () => { activityLimit += ACTIVITY_PAGE; render(); });
      more.append(button);
      fragment.append(more);
    }
    container.append(fragment);
  };

  const renderHistory = (): void => {
    if (screen !== 'history') return;
    const chart = get('#history-chart');
    const list = get('#history-list');
    list.replaceChildren();
    chart.hidden = history.length === 0;
    if (history.length === 0) {
      list.append(emptyState('chart', 'history_empty_title', 'history_empty_body'));
      return;
    }
    chart.replaceChildren(historyChart(history, {
      title: text('history_chart'),
      number,
      date: iso => formatDate(iso, 'short'),
      describe: point => `${formatDate(point.at)} · ${number(point.followers)} ${text('followers').toLocaleLowerCase(locale)} · ${text('history_gained', { count: number(point.gained.length) })} ${text('history_lost', { count: number(point.lost.length) })}`,
    }));
    const fragment = document.createDocumentFragment();
    [...history].reverse().forEach((point, reverseIndex) => {
      const first = reverseIndex === history.length - 1;
      const item = document.createElement('details');
      item.className = 'history-item';
      const summary = document.createElement('summary');
      const time = document.createElement('time');
      time.dateTime = point.at;
      time.textContent = formatDateTime(point.at);
      const counts = document.createElement('span');
      counts.className = 'counts';
      counts.textContent = `${number(point.followers)} ${text('followers').toLocaleLowerCase(locale)} · ${number(point.following)} ${text('following').toLocaleLowerCase(locale)}`;
      const delta = document.createElement('span');
      delta.className = 'delta';
      if (first) delta.textContent = text('history_first');
      else {
        delta.append(Object.assign(document.createElement('span'), { className: 'up', textContent: text('history_gained', { count: number(point.gained.length) }) }));
        delta.append(Object.assign(document.createElement('span'), { className: 'down', textContent: text('history_lost', { count: number(point.lost.length) }) }));
      }
      summary.append(time, counts, delta);
      item.append(summary);
      const names = document.createElement('div');
      names.className = 'names';
      for (const [label, list] of [[text('history_gained', { count: number(point.gained.length) }), point.gained], [text('history_lost', { count: number(point.lost.length) }), point.lost]] as const) {
        if (list.length === 0) continue;
        const line = document.createElement('p');
        line.append(Object.assign(document.createElement('b'), { textContent: `${label}: ` }), list.map(name => `@${name}`).join(', '));
        names.append(line);
      }
      if (names.childElementCount > 0) item.append(names);
      else summary.style.cursor = 'default';
      fragment.append(item);
    });
    list.append(fragment);
  };

  const render = (): void => { renderChrome(); renderList(); renderActivity(); renderHistory(); };

  // ── Audit ───────────────────────────────────────────────────────────────
  const trackChanges = (lists: Record<ListKind, readonly Account[]>, removedIds: ReadonlySet<string>): void => {
    const followers = lists.followers;
    const key = snapshotKey(platform, readOnly ? 'export' : currentUserId() ?? 'session');
    // The preview always compares against a fixed baseline so the demo stays reproducible.
    const previous = previewMode ? previewBaseline(followers, readOnly) : loadSnapshot(key);
    let diff: FollowerChanges | undefined;
    if (previous) {
      diff = diffSnapshot(previous, followers);
      // Followers removed through FollowAudit itself did not unfollow you.
      changes = { ...diff, lost: diff.lost.filter(entry => !removedIds.has(entry.id)) };
    } else changes = 'baseline';
    if (!previewMode) saveSnapshot(key, toSnapshot(followers, new Date()));
    history = appendHistory(history, {
      at: new Date().toISOString(), followers: followers.length, following: lists.following.length,
      gained: diff ? diff.gained.map(entry => entry.username) : [],
      lost: typeof changes === 'object' ? changes.lost.map(entry => entry.username) : [],
    });
    if (!previewMode && owner) writeJson(historyKey(platform, owner), history);
  };

  const beginLoad = (key: CopyKey): AbortSignal => {
    const signal = (controller = new AbortController()).signal;
    mode = 'scanning';
    progress = -1;
    setStatus(key);
    render();
    return signal;
  };
  const finishLoad = (lists: Record<ListKind, readonly Account[]>): void => {
    const removed = new Set([...workspaces.followers.results].filter(([, result]) => result.ok && result.action === 'remove').map(([id]) => id));
    for (const kind of ['following', 'followers'] as const) {
      workspaces[kind].accounts = lists[kind];
      workspaces[kind].results.clear();
      workspaces[kind].selected.clear();
    }
    pruneRequests();
    trackChanges(lists, removed);
    audited = true;
    mode = 'ready';
    progress = 100;
    setStatus('status_complete', { count: number(new Set([...lists.following, ...lists.followers].map(account => account.id)).size) });
  };
  const failLoad = (signal: AbortSignal, error: unknown, errorKey: CopyKey): void => {
    if (!signal.aborted) globalThis.console.error('[FollowAudit] Loading failed:', error);
    mode = signal.aborted ? audited ? 'ready' : 'idle' : 'error';
    progress = 0;
    setStatus(signal.aborted ? 'status_cancelled' : errorKey);
  };

  const audit = async (): Promise<void> => {
    const signal = beginLoad(previewMode ? 'status_preview_loading' : 'status_loading');
    try {
      const lists = previewMode
        ? { following: await previewAccounts('following', readOnly, signal), followers: await previewAccounts('followers', readOnly, signal) }
        : await gateway.audit(signal, (kind, loaded) => { setStatus('status_loading_progress', { list: text(kind), loaded: number(loaded) }); renderChrome(); });
      finishLoad(lists);
    } catch (error) {
      failLoad(signal, error, 'unexpected_error');
    } finally {
      controller = undefined;
      render();
    }
  };

  const readFiles = async (files: readonly File[]): Promise<{ name: string; content: string }[]> => {
    if (files.length > MAX_EXPORT_FILES || files.reduce((total, file) => total + file.size, 0) > MAX_EXPORT_BYTES) {
      throw new Error('The selected export is too large.');
    }
    return Promise.all(files.map(async file => ({ name: file.name, content: await file.text() })));
  };

  const importTikTok = async (files: readonly File[]): Promise<void> => {
    const signal = beginLoad('tiktok_status_loading');
    try {
      const sources = await readFiles(files);
      signal.throwIfAborted();
      finishLoad(parseTikTokExport(sources));
    } catch (error) {
      failLoad(signal, error, 'tiktok_import_error');
    } finally {
      controller = undefined;
      render();
    }
  };

  const importRequests = async (files: readonly File[]): Promise<void> => {
    try {
      const usernames = parsePendingRequestsExport(await readFiles(files));
      workspaces.requests.accounts = usernames.map(requestAccount);
      workspaces.requests.selected.clear();
      workspaces.requests.results.clear();
      pruneRequests();
      requestsImported = true;
      setStatus('requests_imported', { count: number(workspaces.requests.accounts.length) });
    } catch (error) {
      globalThis.console.error('[FollowAudit] Request import failed:', error);
      setStatus('requests_import_error');
    }
    render();
  };

  const requestAudit = (): void => {
    if (readOnly && !previewMode) {
      const input = get<HTMLInputElement>('#tiktok-files');
      input.value = '';
      input.click();
    } else void audit();
  };

  // ── Action queue ────────────────────────────────────────────────────────
  const openConfirmation = (action: ActionKind, items: readonly QueueItem[], resume?: SavedQueue): void => {
    const queue = items.filter(item => !protectedIds.has(item.id));
    if (queue.length === 0) return;
    confirmed = { action, items: queue, resume };
    const count = queue.length;
    const constructive = action === 'follow';
    get('#confirm-body').textContent = text(ACTION_COPY[action].body, { count: number(count) });
    get('#confirm-action-label').textContent = text(ACTION_COPY[action].confirm, { count: number(count) });
    get('#confirm-action').className = `button ${constructive ? 'primary' : 'danger'}`;
    get('#confirm-icon').dataset.tone = constructive ? 'positive' : '';
    const rows: HTMLElement[] = queue.slice(0, 8).map(item => {
      const row = document.createElement('div');
      row.className = 'confirm-account';
      const avatar = document.createElement('img');
      avatar.alt = '';
      avatar.src = item.avatarUrl || AVATAR_FALLBACK;
      avatar.addEventListener('error', () => { avatar.src = AVATAR_FALLBACK; }, { once: true });
      const label = document.createElement('span');
      label.textContent = item.name || `@${item.username}`;
      const handle = document.createElement('small');
      handle.textContent = `@${item.username}`;
      row.append(avatar, label, handle);
      return row;
    });
    if (count > rows.length) {
      const more = document.createElement('div');
      more.className = 'confirm-more';
      more.textContent = `+ ${number(count - rows.length)}`;
      rows.push(more);
    }
    get('#confirm-accounts').replaceChildren(...rows);
    get<HTMLDialogElement>('#confirm-dialog').showModal();
    get<HTMLButtonElement>('#confirm-action').focus();
  };

  const reviewSelection = (action: ActionKind): void => {
    if (screen === 'activity') {
      const entries = undoable().filter(entry => activitySelected.has(entry.id));
      openConfirmation('follow', entries.map(toQueueItem));
      return;
    }
    const kind = actionWorkspace();
    if (!kind) return;
    const { accounts, selected } = workspaces[kind];
    openConfirmation(action, accounts.filter(account => selected.has(account.id)).map(toQueueItem));
  };

  const executeAction = async (action: ActionKind, item: QueueItem, signal: AbortSignal): Promise<void> => {
    if (previewMode) {
      await wait(300, signal);
      return;
    }
    const id = item.id.startsWith(USERNAME_ID_PREFIX) ? await gateway.resolveUserId(item.username, signal) : item.id;
    switch (action) {
      case 'unfollow': return gateway.unfollow(id, signal);
      case 'remove': return gateway.removeFollower(id, signal);
      case 'follow': return gateway.follow(id, signal);
      case 'cancel': return gateway.cancelRequest(id, signal);
    }
  };

  const runQueue = async (): Promise<void> => {
    const job = confirmed;
    confirmed = undefined;
    if (readOnly || !job || job.items.length === 0) return;
    const { action } = job;
    const settings = pacing();
    if (!previewMode) writeJson(PACING_KEY, settings);
    const configured: QueueTiming = { delayMs: settings.delay * 1_000, batchSize: 5, batchDelayMs: settings.batchDelay * 60_000 };
    // The preview runs a fast, fake queue so the flow can be demonstrated in seconds.
    const timing: QueueTiming = previewMode ? { ...configured, delayMs: 400, batchDelayMs: 1_200 } : configured;
    const base = job.resume ?? savedQueue(owner ?? 'session', action, job.items);
    const items = job.resume ? remainingItems(job.resume).filter(item => !protectedIds.has(item.id)) : job.items;
    const signal = (controller = new AbortController()).signal;
    mode = 'running';
    progress = 1;
    setStatus(previewMode ? 'status_queue' : 'status_precheck');
    render();
    try {
      if (!previewMode) await gateway.precheck(signal);
      persistQueue(base);
      setStatus('status_queue');
      renderChrome();
      await runSequential(items, (item, itemSignal) => executeAction(action, item, itemSignal), signal, {
        ...timing,
        maxConsecutiveFailures: 3,
        isFatal: isBlockingError,
        // Human-like rhythm, and twice the pause after a failure.
        adjustDelay: (planned, failed) => previewMode ? planned : jitter(failed ? planned * 2 : planned),
        beforeEach: async (_item, itemSignal) => {
          if (previewMode) return;
          for (;;) {
            const waitMs = hourlyWaitMs(log.map(entry => Date.parse(entry.at)), Date.now(), settings.hourlyCap);
            if (waitMs <= 0) return;
            const resumeAt = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(Date.now() + waitMs));
            setStatus('status_hourly_wait', { time: resumeAt });
            renderChrome();
            await wait(Math.min(waitMs, 60_000), itemSignal);
          }
        },
        onResult: (item, ok, completed, total, error) => {
          if (!ok) globalThis.console.error(`[FollowAudit] ${action} failed for @${item.username}:`, error);
          const message = error instanceof Error ? error.message : String(error);
          for (const kind of RESULT_WORKSPACES[action]) {
            workspaces[kind].results.set(item.id, { action, ok, message });
            workspaces[kind].selected.delete(item.id);
          }
          activitySelected.delete(item.id);
          log = appendLog(log, { at: new Date().toISOString(), action, id: item.id, username: item.username, name: item.name, ok });
          persistLog();
          const done = base.items.length - items.length + completed;
          persistQueue(done >= base.items.length ? undefined : { ...base, done });
          progress = Math.max(1, Math.round((completed / total) * 100));
          setStatus('status_queue_progress', { completed: number(completed), total: number(total), eta: formatDuration(estimateRemainingMs(completed, total, timing)) });
          render();
        },
      });
      persistQueue(undefined);
      setStatus('status_queue_complete');
      mode = 'ready';
    } catch (error) {
      const cause = error instanceof QueueHaltedError ? error.cause : error;
      if (signal.aborted) setStatus('status_queue_cancelled');
      else if (cause instanceof UnexpectedResponseError) {
        contractBroken = true;
        setStatus('status_contract_changed');
      } else if (isBlockingError(cause)) setStatus('status_queue_halted');
      else if (error instanceof QueueHaltedError) setStatus('status_queue_failures');
      else {
        globalThis.console.error('[FollowAudit] Queue failed:', error);
        setStatus('unexpected_error');
      }
      mode = signal.aborted ? 'ready' : 'error';
    } finally {
      progress = 100;
      controller = undefined;
      render();
    }
  };

  // ── TikTok guided review ────────────────────────────────────────────────
  const renderGuidedReview = (): void => {
    const account = reviewQueue[reviewIndex];
    if (!account) {
      get<HTMLDialogElement>('#guided-review-dialog').close();
      setStatus('tiktok_review_complete', { count: number(reviewedIds.size) });
      render();
      return;
    }
    get('#guided-review-position').textContent = text('tiktok_review_position', { current: reviewIndex + 1, total: reviewQueue.length });
    get('#guided-review-account').textContent = `@${account.username}`;
    const open = get<HTMLAnchorElement>('#guided-review-open');
    open.href = `https://www.tiktok.com/@${encodeURIComponent(account.username)}`;
    open.textContent = text('tiktok_review_open', { username: account.username });
  };

  const startGuidedReview = (): void => {
    let queue = reviewableAccounts();
    if (queue.length === 0) {
      for (const account of reviewableAccounts(true)) reviewedIds.delete(account.id);
      saveIds(TIKTOK_REVIEWED_KEY, reviewedIds);
      queue = reviewableAccounts();
    }
    if (queue.length === 0) return;
    reviewQueue = queue;
    reviewIndex = 0;
    renderGuidedReview();
    get<HTMLDialogElement>('#guided-review-dialog').showModal();
    get<HTMLAnchorElement>('#guided-review-open').focus();
  };

  // ── Settings ────────────────────────────────────────────────────────────
  const settingsFeedback = (key: CopyKey, values: Values = {}, tone: 'ok' | 'error' = 'ok'): void => {
    const feedback = get('#settings-feedback');
    feedback.dataset.tone = tone;
    feedback.textContent = text(key, values);
  };

  const importBackup = async (file: File): Promise<void> => {
    // Protection must not change while a queue is running.
    if (locked()) return;
    const ids = file.size <= MAX_BACKUP_BYTES ? parseProtectedBackup(await file.text()) : undefined;
    if (!ids) {
      settingsFeedback('backup_error', {}, 'error');
      return;
    }
    for (const id of ids) {
      protectedIds.add(id);
      for (const workspace of Object.values(workspaces)) workspace.selected.delete(id);
    }
    if (!saveIds(PROTECTED_KEY, protectedIds)) settingsFeedback('protected_save_error', {}, 'error');
    else settingsFeedback('backup_imported', { count: number(ids.length) });
    render();
  };

  const exportVisible = (format: 'csv' | 'xlsx' | 'json'): void => {
    const accounts = visibleAccounts();
    if (accounts.length === 0) return;
    const name = `followaudit-${platform}-${segment}-${today()}`;
    if (format === 'csv') download(toCsv(accounts), 'text/csv;charset=utf-8', `${name}.csv`);
    else if (format === 'xlsx') download(toXlsx(accounts), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${name}.xlsx`);
    else download(toJson(accounts, { platform, segment, version: VERSION }), 'application/json', `${name}.json`);
  };

  // ── Navigation ──────────────────────────────────────────────────────────
  const go = (next: Screen, focus?: string): void => {
    screen = next;
    hidePreview();
    closeMenus();
    render();
    get('.body').scrollTop = 0;
    get(focus ?? (next === 'report' ? '#scan' : '#back')).focus();
  };
  const openSegment = (next: Segment): void => {
    segment = next;
    query = '';
    limit = PAGE_SIZE;
    anchorIndex = undefined;
    get<HTMLInputElement>('#search').value = '';
    go('list');
  };
  const goBack = (): void => {
    if (screen === 'report') return;
    const origin = screen === 'list' ? `[data-segment="${segment}"]` : screen === 'settings' ? '#nav-settings' : `[data-screen="${screen}"]`;
    go('report', origin);
  };
  const setMinimized = (minimized: boolean): void => {
    host.toggleAttribute('data-minimized', minimized);
    app.hidden = minimized;
    get('#pill').hidden = !minimized;
    hidePreview();
    get(minimized ? '#pill' : '#minimize').focus();
  };
  const close = (): void => { controller?.abort(); host.remove(); };
  const menus = (): HTMLDetailsElement[] => [...root.querySelectorAll<HTMLDetailsElement>('details.menu, #language-menu')];
  const closeMenus = (except?: HTMLDetailsElement): void => { for (const menu of menus()) if (menu !== except) menu.open = false; };

  /** Rows of the list on screen, for J/K navigation. */
  const focusRow = (step: number, path: EventTarget[]): void => {
    const rows = [...root.querySelectorAll<HTMLElement>(screen === 'activity' ? '#activity-list .row' : '#accounts .row')];
    if (rows.length === 0) return;
    const current = rows.findIndex(row => path.includes(row));
    const next = rows[current === -1 ? (step > 0 ? 0 : rows.length - 1) : Math.max(0, Math.min(rows.length - 1, current + step))];
    next?.querySelector<HTMLElement>('input:not(:disabled), a')?.focus();
    next?.scrollIntoView({ block: 'nearest' });
  };

  // Keep keystrokes inside the panel away from the platform's own keyboard shortcuts.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    root.addEventListener(type, event => {
      event.stopPropagation();
      if (type !== 'keydown' || !(event instanceof KeyboardEvent)) return;
      const path = event.composedPath();
      const target = path[0];
      const typing = target instanceof HTMLInputElement && !['checkbox', 'radio'].includes(target.type) || target instanceof HTMLTextAreaElement;
      const dialogOpen = Boolean(root.querySelector('dialog[open]'));
      const openMenu = menus().find(menu => menu.open);
      if (event.key === 'Escape' && openMenu) {
        openMenu.open = false;
        openMenu.querySelector('summary')?.focus();
        return;
      }
      if (typing || dialogOpen || event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.key === 'Escape') goBack();
      else if (event.key === '?') get<HTMLDialogElement>('#shortcuts-dialog').showModal();
      else if (event.key === '/' && screen === 'list') {
        event.preventDefault();
        get('#search').focus();
      } else if ((key === 'j' || key === 'k') && (screen === 'list' || screen === 'activity')) {
        event.preventDefault();
        focusRow(key === 'j' ? 1 : -1, path);
      } else if (key === 'x' && (screen === 'list' || screen === 'activity')) {
        const row = path.find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('row'));
        row?.querySelector<HTMLInputElement>('input[type=checkbox]:not(:disabled)')?.click();
      } else if (key === 'p' && screen === 'list') {
        const row = path.find((node): node is HTMLElement => node instanceof HTMLElement && node.classList.contains('row'));
        row?.querySelector<HTMLButtonElement>('.protect:not(:disabled)')?.click();
      } else if (key === 'a' && !event.shiftKey && screen === 'list' && actionWorkspace()) {
        get<HTMLButtonElement>('#select-visible').click();
      } else if (key === 'a' && screen === 'activity') {
        get<HTMLButtonElement>('#select-undo').click();
      }
    });
  }

  get('#close').addEventListener('click', close);
  get('#minimize').addEventListener('click', () => setMinimized(true));
  get('#pill').addEventListener('click', () => setMinimized(false));
  get('#back').addEventListener('click', goBack);
  get('#nav-settings').addEventListener('click', () => { get('#settings-feedback').textContent = ''; go('settings'); });
  get('#scan').addEventListener('click', requestAudit);
  get('#cancel').addEventListener('click', () => controller?.abort());
  get('#run').addEventListener('click', () => {
    const actions = availableActions();
    const primary = actions[actions.length - 1];
    if (primary) reviewSelection(primary);
  });
  get('#run-secondary').addEventListener('click', () => {
    const [secondary] = availableActions();
    if (secondary) reviewSelection(secondary);
  });
  get('#confirm-action').addEventListener('click', () => { get<HTMLDialogElement>('#confirm-dialog').close(); void runQueue(); });
  get('#resume-run').addEventListener('click', () => {
    if (pendingQueue && !locked()) openConfirmation(pendingQueue.action, remainingItems(pendingQueue), pendingQueue);
  });
  get('#resume-discard').addEventListener('click', () => { persistQueue(undefined); render(); get('#scan').focus(); });
  get('#guided-review').addEventListener('click', startGuidedReview);
  get('#guided-review-skip').addEventListener('click', () => { reviewIndex += 1; renderGuidedReview(); });
  get('#guided-review-done').addEventListener('click', () => {
    const account = reviewQueue[reviewIndex];
    if (!account) return;
    reviewedIds.add(account.id);
    saveIds(TIKTOK_REVIEWED_KEY, reviewedIds);
    reviewIndex += 1;
    renderGuidedReview();
  });
  get<HTMLInputElement>('#tiktok-files').addEventListener('change', event => {
    const files = [...((event.currentTarget as HTMLInputElement).files ?? [])];
    if (files.length > 0) void importTikTok(files);
  });
  get('#requests-import-button').addEventListener('click', () => {
    if (previewMode) {
      workspaces.requests.accounts = previewRequests();
      requestsImported = true;
      setStatus('requests_imported', { count: number(workspaces.requests.accounts.length) });
      render();
      return;
    }
    const input = get<HTMLInputElement>('#requests-file');
    input.value = '';
    input.click();
  });
  get<HTMLInputElement>('#requests-file').addEventListener('change', event => {
    const files = [...((event.currentTarget as HTMLInputElement).files ?? [])];
    if (files.length > 0) void importRequests(files);
  });
  root.querySelectorAll<HTMLButtonElement>('[data-segment]').forEach(button => button.addEventListener('click', () => openSegment(button.dataset.segment as Segment)));
  root.querySelectorAll<HTMLButtonElement>('[data-screen]').forEach(button => button.addEventListener('click', () => {
    activitySelected.clear();
    activityLimit = ACTIVITY_PAGE;
    go(button.dataset.screen as ToolScreen);
  }));
  get('#select-visible').addEventListener('click', () => {
    const kind = actionWorkspace();
    if (!kind) return;
    const { selected } = workspaces[kind];
    // Only rows actually rendered on screen are selected.
    const selectable = visibleAccounts().slice(0, limit).filter(isSelectable);
    const allSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));
    for (const account of selectable) { if (allSelected) selected.delete(account.id); else selected.add(account.id); }
    render();
  });
  get('#clear-selection').addEventListener('click', () => {
    const kind = actionWorkspace();
    if (kind) workspaces[kind].selected.clear();
    closeMenus();
    render();
  });
  get<HTMLFormElement>('#select-first').addEventListener('submit', event => {
    event.preventDefault();
    const kind = actionWorkspace();
    if (!kind) return;
    const count = numberInput(get<HTMLInputElement>('#select-first-count'), 1, 10_000, 50);
    const { selected } = workspaces[kind];
    selected.clear();
    const chosen = visibleAccounts().filter(isSelectable).slice(0, count);
    for (const account of chosen) selected.add(account.id);
    // Make sure every selected row is actually on screen.
    limit = Math.max(limit, Math.ceil(count / PAGE_SIZE) * PAGE_SIZE);
    closeMenus();
    render();
  });
  get('#select-undo').addEventListener('click', () => {
    const entries = undoable();
    const allSelected = entries.length > 0 && entries.every(entry => activitySelected.has(entry.id));
    for (const entry of entries) { if (allSelected) activitySelected.delete(entry.id); else activitySelected.add(entry.id); }
    render();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(button => button.addEventListener('click', () => {
    closeMenus();
    exportVisible(button.dataset.export as 'csv' | 'xlsx' | 'json');
  }));
  root.querySelectorAll<HTMLFieldSetElement>('[data-filter]').forEach(fieldset => fieldset.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    filters[fieldset.dataset.filter as FilterName] = input.value as FilterValue;
    limit = PAGE_SIZE;
    anchorIndex = undefined;
    render();
  }));
  get('#filter-clear').addEventListener('click', () => {
    for (const name of Object.keys(filters) as FilterName[]) filters[name] = 'any';
    root.querySelectorAll<HTMLInputElement>('[data-filter] input[value=any]').forEach(input => { input.checked = true; });
    render();
  });
  get<HTMLInputElement>('#search').addEventListener('input', event => { query = (event.currentTarget as HTMLInputElement).value; limit = PAGE_SIZE; anchorIndex = undefined; render(); });
  for (const input of Object.values(pacingInputs)) input.addEventListener('change', () => { if (!previewMode) writeJson(PACING_KEY, pacing()); });
  const compact = get<HTMLInputElement>('#compact');
  compact.checked = host.dataset.density === 'compact';
  compact.addEventListener('change', () => {
    if (compact.checked) host.dataset.density = 'compact'; else delete host.dataset.density;
    writeText(DENSITY_KEY, compact.checked ? 'compact' : 'comfortable');
  });
  get('#open-shortcuts').addEventListener('click', () => get<HTMLDialogElement>('#shortcuts-dialog').showModal());
  get('#backup-export').addEventListener('click', () => download(protectedBackup(platform, protectedIds), 'application/json', `followaudit-protected-${platform}-${today()}.json`));
  get('#backup-import').addEventListener('click', () => {
    if (locked()) return;
    const input = get<HTMLInputElement>('#backup-file');
    input.value = '';
    input.click();
  });
  get<HTMLInputElement>('#backup-file').addEventListener('change', event => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void importBackup(file);
  });
  get('#clear-history').addEventListener('click', () => {
    clearHistory([TIKTOK_REVIEWED_KEY]);
    reviewedIds.clear();
    changes = undefined;
    history = [];
    log = [];
    activitySelected.clear();
    settingsFeedback('history_cleared');
    render();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  root.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => button.addEventListener('click', () => {
    locale = button.dataset.locale as Locale;
    copy = translations[locale];
    writeText(LOCALE_KEY, locale);
    closeMenus();
    applyCopy();
    render();
  }));
  get('#theme-toggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    host.dataset.theme = theme;
    writeText(THEME_KEY, theme);
    applyCopy();
  });
  for (const menu of menus()) {
    menu.addEventListener('toggle', () => { if (menu.open) closeMenus(menu); });
    // A disabled export menu must not open.
    menu.querySelector('summary')?.addEventListener('click', event => { if (menu.classList.contains('disabled')) event.preventDefault(); });
  }
  root.addEventListener('click', event => {
    const path = event.composedPath();
    for (const menu of menus()) if (menu.open && !path.includes(menu)) menu.open = false;
  });

  applyCopy();
  render();
  get('#scan').focus();
  if (previewMode) void audit();
}

interface ChartCopy {
  readonly title: string;
  readonly number: (value: number) => string;
  readonly date: (iso: string) => string;
  readonly describe: (point: HistoryPoint) => string;
}

/** Single-series follower line over real time, with a hover readout and accessible point titles. */
function historyChart(points: readonly HistoryPoint[], copy: ChartCopy): DocumentFragment {
  const width = 400;
  const height = 150;
  const left = 40;
  const right = 12;
  const top = 12;
  const bottom = 24;
  const times = points.map(point => Date.parse(point.at));
  const values = points.map(point => point.followers);
  const [minTime, maxTime] = [Math.min(...times), Math.max(...times)];
  let [minValue, maxValue] = [Math.min(...values), Math.max(...values)];
  const pad = Math.max(1, Math.round((maxValue - minValue) * 0.15));
  minValue = Math.max(0, minValue - pad);
  maxValue += pad;
  const x = (time: number): number => maxTime === minTime ? (left + width - right) / 2 : left + ((time - minTime) / (maxTime - minTime)) * (width - left - right);
  const y = (value: number): number => top + (1 - (value - minValue) / (maxValue - minValue)) * (height - top - bottom);
  const coordinates = points.map((point, index) => [x(times[index] ?? 0), y(point.followers)] as const);
  const line = coordinates.map(([cx, cy], index) => `${index === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)}`).join('');
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const area = first && last && coordinates.length > 1 ? `${line}L${last[0].toFixed(1)},${height - bottom}L${first[0].toFixed(1)},${height - bottom}Z` : '';
  const mid = Math.round((minValue + maxValue) / 2);
  const grid = [maxValue, mid, minValue].map(value => `<line class="grid" x1="${left}" x2="${width - right}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}"/><text x="${left - 8}" y="${(y(value) + 3.5).toFixed(1)}" text-anchor="end">${copy.number(value)}</text>`).join('');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const labels = firstPoint && lastPoint
    ? `<text x="${left}" y="${height - 6}">${escapeXml(copy.date(firstPoint.at))}</text>${points.length > 1 ? `<text x="${width - right}" y="${height - 6}" text-anchor="end">${escapeXml(copy.date(lastPoint.at))}</text>` : ''}`
    : '';
  const fragment = document.createDocumentFragment();
  const caption = document.createElement('figcaption');
  const heading = document.createElement('span');
  heading.append(`${copy.title} `, Object.assign(document.createElement('strong'), { textContent: lastPoint ? copy.number(lastPoint.followers) : '' }));
  const readout = Object.assign(document.createElement('span'), { className: 'readout', textContent: lastPoint ? copy.describe(lastPoint) : '' });
  readout.setAttribute('aria-live', 'polite');
  caption.append(heading, readout);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', copy.title);
  // Hit areas are columns much wider than the 8px dots.
  const columns = coordinates.map(([cx], index) => {
    const previous = coordinates[index - 1]?.[0] ?? left;
    const next = coordinates[index + 1]?.[0] ?? width - right;
    const from = index === 0 ? left : (previous + cx) / 2;
    const to = index === coordinates.length - 1 ? width - right : (cx + next) / 2;
    return `<rect class="hit" data-index="${index}" x="${from.toFixed(1)}" y="0" width="${Math.max(1, to - from).toFixed(1)}" height="${height - bottom}" fill="transparent"/>`;
  }).join('');
  svg.innerHTML = `${grid}${area ? `<path class="area" d="${area}"/>` : ''}<path class="line" d="${line}"/><line class="cursor" y1="${top}" y2="${height - bottom}" stroke="currentColor" stroke-opacity=".25" visibility="hidden"/>${
    coordinates.map(([cx, cy], index) => `<circle class="dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4"><title>${escapeXml(points[index] ? copy.describe(points[index]) : '')}</title></circle>`).join('')
  }${labels}${columns}`;
  const cursor = svg.querySelector('.cursor');
  svg.addEventListener('pointermove', event => {
    const hit = (event.target as Element).closest('.hit');
    const index = Number(hit?.getAttribute('data-index'));
    const point = points[index];
    const coordinate = coordinates[index];
    if (!hit || !point || !coordinate) return;
    readout.textContent = copy.describe(point);
    cursor?.setAttribute('x1', coordinate[0].toFixed(1));
    cursor?.setAttribute('x2', coordinate[0].toFixed(1));
    cursor?.setAttribute('visibility', 'visible');
  });
  svg.addEventListener('pointerleave', () => {
    readout.textContent = lastPoint ? copy.describe(lastPoint) : '';
    cursor?.setAttribute('visibility', 'hidden');
  });
  fragment.append(caption, svg);
  return fragment;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[character] ?? character);
}

function initialTheme(): Theme {
  const saved = readText(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function numberInput(input: HTMLInputElement, min: number, max: number, fallback: number): number {
  const value = Number(input.value);
  const normalized = Number.isFinite(value) && input.value !== '' ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  input.value = String(normalized);
  return normalized;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function download(content: BlobPart, type: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

if (!instagramHost && !tiktokHost && !previewMode) {
  alert('Open instagram.com or tiktok.com before running FollowAudit.');
} else {
  const existing = document.getElementById(HOST_ID);
  // Running the script again restores a minimized panel instead of stacking a second one.
  if (existing) existing.shadowRoot?.querySelector<HTMLButtonElement>('#pill:not([hidden])')?.click();
  else start();
}
