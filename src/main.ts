import {
  QueueHaltedError, diffSnapshot, estimateRemainingMs, runSequential, toCsv, toSnapshot, wait,
  type Account, type FollowerChanges, type ListKind, type QueueTiming,
} from './core';
import { format, resolveLocale, translations, type CopyKey, type Locale } from './i18n';
import { InstagramGateway, currentUserId, isBlockingError } from './instagram';
import { previewAccounts, previewBaseline } from './preview';
import {
  STORAGE_PREFIX, clearHistory, loadIds, loadSnapshot, parseProtectedBackup, protectedBackup, readText, saveIds, saveSnapshot, snapshotKey, writeText,
} from './storage';
import { parseTikTokExport, pendingTikTokReviewAccounts } from './tiktok';
import { icon } from './ui/icons';
import { languageCode, layout, type Platform, type Segment } from './ui/layout';
import { styles } from './ui/styles';

const HOST_ID = 'follow-audit-app';
const LOCALE_KEY = `${STORAGE_PREFIX}language`;
const THEME_KEY = `${STORAGE_PREFIX}theme`;
const TIKTOK_REVIEWED_KEY = `${STORAGE_PREFIX}tiktok:reviewed`;
const PAGE_SIZE = 200;
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
type Screen = 'report' | 'list' | 'settings';
type Theme = 'light' | 'dark';
type Values = Record<string, string | number>;

interface WorkspaceState {
  accounts: readonly Account[];
  readonly selected: Set<string>;
  readonly results: Map<string, string>;
}

/** The list a segment's rows belong to; null when a segment mixes both lists. */
const SEGMENT_LIST: Record<Segment, ListKind | null> = {
  nonfollowers: 'following', fans: 'followers', lost: 'followers', protected: null, following: 'following', followers: 'followers',
};
const SEGMENT_COPY: Record<Segment, { readonly title: CopyKey; readonly hint?: CopyKey }> = {
  nonfollowers: { title: 'seg_nonfollowers', hint: 'hint_nonfollowers' },
  fans: { title: 'seg_fans', hint: 'hint_fans' },
  lost: { title: 'view_lost', hint: 'hint_lost' },
  protected: { title: 'view_protected', hint: 'hint_protected' },
  following: { title: 'seg_all_following' },
  followers: { title: 'seg_all_followers' },
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
  root.innerHTML = `<style>${styles}</style>${layout(copy, locale, platform)}`;

  const gateway = new InstagramGateway();
  const protectedIds = loadIds(PROTECTED_KEY);
  const reviewedIds = readOnly ? loadIds(TIKTOK_REVIEWED_KEY) : new Set<string>();
  const workspaces: Record<ListKind, WorkspaceState> = {
    following: { accounts: [], selected: new Set(), results: new Map() },
    followers: { accounts: [], selected: new Set(), results: new Map() },
  };
  let audited = false;
  let mode: Mode = 'idle';
  let screen: Screen = 'report';
  let segment: Segment = 'nonfollowers';
  let query = '';
  /** -1 = indeterminate, 0 = hidden, 1–99 = determinate, 100 = done. */
  let progress = 0;
  let limit = PAGE_SIZE;
  let statusKey: CopyKey = readOnly ? 'tiktok_status_ready' : 'status_ready';
  let statusValues: Values = {};
  let controller: AbortController | undefined;
  let confirmedQueue: readonly Account[] = [];
  let confirmedList: ListKind = 'following';
  let changes: FollowerChanges | 'baseline' | undefined;
  let reviewQueue: readonly Account[] = [];
  let reviewIndex = 0;

  const get = <T extends Element = HTMLElement>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  };
  const app = get('.app');
  const text = (key: CopyKey, values: Values = {}): string => format(copy, key, values);
  const setStatus = (key: CopyKey, values: Values = {}): void => { statusKey = key; statusValues = values; };
  const number = (value: number): string => value.toLocaleString(locale);
  const locked = (): boolean => mode === 'scanning' || mode === 'running';
  const sinceDate = (): string => typeof changes === 'object'
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(changes.since))
    : '';

  const lostAccounts = (): readonly Account[] => {
    if (typeof changes !== 'object') return [];
    const following = new Set(workspaces.following.accounts.map(account => account.id));
    return changes.lost.map(entry => ({
      ...entry, avatarUrl: '', isPrivate: false, isVerified: false, followsYou: false, youFollow: following.has(entry.id),
    }));
  };
  const segmentAccounts = (target: Segment): readonly Account[] => {
    const { following, followers } = workspaces;
    switch (target) {
      case 'nonfollowers': return following.accounts.filter(account => !account.followsYou);
      case 'fans': return followers.accounts.filter(account => !account.youFollow);
      case 'lost': return lostAccounts();
      case 'following': return following.accounts;
      case 'followers': return followers.accounts;
      case 'protected': {
        const seen = new Set<string>();
        return [...following.accounts, ...followers.accounts].filter(account => protectedIds.has(account.id) && !seen.has(account.id) && seen.add(account.id));
      }
    }
  };
  const visibleAccounts = (): readonly Account[] => {
    const needle = query.trim().replace(/^@/, '').toLocaleLowerCase(locale);
    const accounts = segmentAccounts(segment);
    return needle === '' ? accounts : accounts.filter(account => account.username.toLocaleLowerCase(locale).includes(needle)
      || account.name.toLocaleLowerCase(locale).includes(needle));
  };
  /** The list that actions in the current segment would change; null when no action is possible. */
  const actionList = (): ListKind | null => readOnly || segment === 'lost' ? null : SEGMENT_LIST[segment];
  const isSelectable = (account: Account): boolean => {
    const list = actionList();
    return list !== null && !protectedIds.has(account.id) && workspaces[list].results.get(account.id) !== 'ok';
  };
  const reviewableAccounts = (includeReviewed = false): readonly Account[] => readOnly && segment === 'nonfollowers'
    ? pendingTikTokReviewAccounts(visibleAccounts(), protectedIds, includeReviewed ? new Set() : reviewedIds)
    : [];
  const formatDuration = (ms: number): string => {
    const minutes = ms >= 60_000;
    const value = minutes ? Math.round(ms / 60_000) : Math.max(1, Math.round(ms / 1_000));
    return new Intl.NumberFormat(locale, { style: 'unit', unit: minutes ? 'minute' : 'second', unitDisplay: 'long' }).format(value);
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

    get('#view-report').hidden = screen !== 'report';
    get('#view-list').hidden = screen !== 'list';
    get('#view-settings').hidden = screen !== 'settings';
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
    const chip = get<HTMLButtonElement>('#changes');
    chip.hidden = changes !== 'baseline';
    chip.setAttribute('aria-disabled', 'true');
    get('#changes-label').textContent = text('changes_baseline');
    get('#segments').hidden = !audited;
    root.querySelectorAll<HTMLButtonElement>('[data-segment]').forEach(button => {
      const id = button.dataset.segment as Segment;
      const count = segmentAccounts(id).length;
      get(`#count-${id}`).textContent = number(count);
      button.dataset.nonzero = String(count > 0);
      button.disabled = mode === 'scanning';
    });
    get('[data-segment="lost"]').hidden = typeof changes !== 'object';
    get('#hint-lost').textContent = text('hint_lost', { date: sinceDate() });

    // List
    const list = actionList();
    const { title, hint } = SEGMENT_COPY[segment];
    get('#list-title').textContent = `${text(title)} · ${number(segmentAccounts(segment).length)}`;
    get('#list-hint').textContent = hint ? text(hint, { date: sinceDate() }) : '';
    get('#list-hint').hidden = !hint;
    get<HTMLInputElement>('#search').disabled = mode === 'scanning';
    get<HTMLButtonElement>('#export').disabled = visibleAccounts().length === 0;
    get('#export').title = text('export');
    const selectable = visibleAccounts().slice(0, limit).filter(isSelectable);
    const selected = list ? workspaces[list].selected : new Set<string>();
    const allSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));
    const selectButton = get<HTMLButtonElement>('#select-visible');
    selectButton.hidden = list === null;
    selectButton.disabled = busy || selectable.length === 0;
    selectButton.setAttribute('aria-label', text(allSelected ? 'clear_visible' : 'select_visible'));
    selectButton.title = text(allSelected ? 'clear_visible' : 'select_visible');

    // Action bar
    const pendingReview = reviewableAccounts();
    const restartableReview = reviewableAccounts(true);
    const guided = get<HTMLButtonElement>('#guided-review');
    guided.hidden = restartableReview.length === 0;
    guided.disabled = busy;
    get('#guided-review-label').textContent = text(pendingReview.length > 0 ? 'tiktok_guided_start' : 'tiktok_guided_restart', { count: pendingReview.length || restartableReview.length });
    get('#actionbar').hidden = screen !== 'list' || (list === null && guided.hidden);
    get('#selection-count').textContent = list === null ? text('tiktok_safety_title') : selected.size === 0 ? text('selection_none') : text('selection_count', { count: number(selected.size) });
    get('#selection-context').textContent = list === null ? text('tiktok_review_notice') : text(`${list}_body`);
    const run = get<HTMLButtonElement>('#run');
    run.hidden = list === null;
    run.disabled = busy || selected.size === 0;
    get('#run-label').textContent = text(list === 'followers' ? 'review_remove' : 'review_unfollow', { count: number(selected.size) });
  };

  const accountRow = (account: Account, busy: boolean): HTMLElement => {
    const list = actionList();
    const owner: ListKind = SEGMENT_LIST[segment] ?? (workspaces.following.accounts.includes(account) ? 'following' : 'followers');
    const result = workspaces[owner].results.get(account.id);
    const selected = list ? workspaces[list].selected : undefined;
    const isProtected = protectedIds.has(account.id);
    const row = document.createElement('article');
    row.className = selected ? 'row' : 'row readonly';
    row.setAttribute('role', 'listitem');
    row.dataset.result = result ? result === 'ok' ? 'ok' : 'error' : '';
    row.dataset.selected = String(Boolean(selected?.has(account.id)));

    if (selected) {
      const choice = document.createElement('label');
      choice.className = 'check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(account.id);
      checkbox.disabled = busy || !isSelectable(account);
      checkbox.setAttribute('aria-label', text('select_account', { username: account.username }));
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(account.id); else selected.delete(account.id);
        row.dataset.selected = String(checkbox.checked);
        renderChrome();
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
    if (result === 'ok') tag(text(owner === 'following' ? 'unfollowed' : 'removed'), 'ok');
    else if (result) tag(`${text('failed')}: ${result}`, 'bad');
    if (segment === 'following') tag(text(account.followsYou ? 'following_you' : 'view_nonfollowers'), account.followsYou ? 'ok' : 'bad');
    if (segment === 'followers' || (segment === 'lost' && workspaces.following.accounts.length > 0)) tag(text(account.youFollow ? 'you_follow' : 'view_not_followed'), account.youFollow ? 'ok' : '');
    if (readOnly && reviewedIds.has(account.id)) tag(text('tiktok_reviewed'), 'info');
    if (account.isVerified) tag(text('verified'), '');
    if (account.isPrivate) tag(text('private'), '');
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
        workspaces.following.selected.delete(account.id);
        workspaces.followers.selected.delete(account.id);
      }
      if (!saveIds(PROTECTED_KEY, protectedIds)) setStatus('protected_save_error');
      render();
    });

    row.append(avatar, identity, protect);
    return row;
  };

  const renderList = (): void => {
    if (screen !== 'list') return;
    const container = get('#accounts');
    container.replaceChildren();
    if (mode === 'scanning') {
      container.append(...Array.from({ length: 6 }, () => Object.assign(document.createElement('div'), { className: 'skeleton' })));
      return;
    }
    const visible = visibleAccounts();
    if (visible.length === 0) {
      const lostEmpty = segment === 'lost' && !query;
      const empty = document.createElement('section');
      empty.className = 'empty';
      empty.innerHTML = `${icon(query ? 'search' : 'check')}<h2></h2><p></p>`;
      empty.querySelector('h2')!.textContent = text(lostEmpty ? 'empty_lost_title' : 'empty_filtered_title');
      empty.querySelector('p')!.textContent = text(lostEmpty ? 'empty_lost_body' : 'empty_filtered_body');
      container.append(empty);
      return;
    }
    const busy = locked();
    const fragment = document.createDocumentFragment();
    for (const account of visible.slice(0, limit)) fragment.append(accountRow(account, busy));
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

  const render = (): void => { renderChrome(); renderList(); };

  const trackChanges = (followers: readonly Account[], removedIds: ReadonlySet<string>): void => {
    const key = snapshotKey(platform, readOnly ? 'export' : currentUserId() ?? 'session');
    // The preview always compares against a fixed baseline so the demo stays reproducible.
    const previous = previewMode ? previewBaseline(followers, readOnly) : loadSnapshot(key);
    if (previous) {
      const diff = diffSnapshot(previous, followers);
      // Followers removed through FollowAudit itself did not unfollow you.
      changes = { ...diff, lost: diff.lost.filter(entry => !removedIds.has(entry.id)) };
    } else changes = 'baseline';
    if (!previewMode) saveSnapshot(key, toSnapshot(followers, new Date()));
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
    const removed = new Set([...workspaces.followers.results].filter(([, result]) => result === 'ok').map(([id]) => id));
    for (const kind of ['following', 'followers'] as const) {
      workspaces[kind].accounts = lists[kind];
      workspaces[kind].results.clear();
      workspaces[kind].selected.clear();
    }
    trackChanges(lists.followers, removed);
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

  const importTikTok = async (files: readonly File[]): Promise<void> => {
    const signal = beginLoad('tiktok_status_loading');
    try {
      if (files.length > MAX_EXPORT_FILES || files.reduce((total, file) => total + file.size, 0) > MAX_EXPORT_BYTES) {
        throw new Error('The selected TikTok export is too large.');
      }
      const sources = await Promise.all(files.map(async file => ({ name: file.name, content: await file.text() })));
      signal.throwIfAborted();
      finishLoad(parseTikTokExport(sources));
    } catch (error) {
      failLoad(signal, error, 'tiktok_import_error');
    } finally {
      controller = undefined;
      render();
    }
  };

  const requestAudit = (): void => {
    if (readOnly && !previewMode) {
      const input = get<HTMLInputElement>('#tiktok-files');
      input.value = '';
      input.click();
    } else void audit();
  };

  const openConfirmation = (): void => {
    const list = actionList();
    if (!list) return;
    const { accounts, selected } = workspaces[list];
    confirmedQueue = accounts.filter(account => selected.has(account.id) && !protectedIds.has(account.id));
    confirmedList = list;
    if (confirmedQueue.length === 0) return;
    const count = confirmedQueue.length;
    get('#confirm-body').textContent = text(list === 'following' ? 'confirm_unfollow_body' : 'confirm_remove_body', { count: number(count) });
    get('#confirm-action-label').textContent = text(list === 'following' ? 'confirm_unfollow' : 'confirm_remove', { count: number(count) });
    const rows: HTMLElement[] = confirmedQueue.slice(0, 8).map(account => {
      const row = document.createElement('div');
      row.className = 'confirm-account';
      const avatar = document.createElement('img');
      avatar.alt = '';
      avatar.src = account.avatarUrl || AVATAR_FALLBACK;
      avatar.addEventListener('error', () => { avatar.src = AVATAR_FALLBACK; }, { once: true });
      const label = document.createElement('span');
      label.textContent = account.name || `@${account.username}`;
      const handle = document.createElement('small');
      handle.textContent = `@${account.username}`;
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

  const runConfirmed = async (): Promise<void> => {
    const queue = confirmedQueue;
    if (readOnly || queue.length === 0) return;
    const kind = confirmedList;
    const { selected, results } = workspaces[kind];
    const configured: QueueTiming = {
      delayMs: numberInput(get<HTMLInputElement>('#delay'), 2, 120, 4) * 1_000,
      batchSize: 5,
      batchDelayMs: numberInput(get<HTMLInputElement>('#batch-delay'), 1, 30, 5) * 60_000,
    };
    // The preview runs a fast, fake queue so the flow can be demonstrated in seconds.
    const timing: QueueTiming = previewMode ? { ...configured, delayMs: 400, batchDelayMs: 1_200 } : configured;
    const signal = (controller = new AbortController()).signal;
    mode = 'running';
    progress = 1;
    setStatus('status_queue');
    render();
    try {
      await runSequential(queue, async (account, itemSignal) => {
        // Defense in depth: protection is locked during a run, but never act on a protected account.
        if (protectedIds.has(account.id)) return;
        if (previewMode) await wait(300, itemSignal);
        else if (kind === 'following') await gateway.unfollow(account.id, itemSignal);
        else await gateway.removeFollower(account.id, itemSignal);
      }, signal, {
        ...timing,
        maxConsecutiveFailures: 3,
        isFatal: isBlockingError,
        onResult: (account, ok, completed, total, error) => {
          if (!ok) globalThis.console.error(`[FollowAudit] Failed for @${account.username}:`, error);
          if (!protectedIds.has(account.id)) results.set(account.id, ok ? 'ok' : error instanceof Error ? error.message : String(error));
          selected.delete(account.id);
          progress = Math.max(1, Math.round((completed / total) * 100));
          setStatus('status_queue_progress', { completed: number(completed), total: number(total), eta: formatDuration(estimateRemainingMs(completed, total, timing)) });
          render();
        },
      });
      setStatus('status_queue_complete');
      mode = 'ready';
    } catch (error) {
      if (signal.aborted) setStatus('status_queue_cancelled');
      else if (error instanceof QueueHaltedError) setStatus(isBlockingError(error.cause) ? 'status_queue_halted' : 'status_queue_failures');
      else {
        globalThis.console.error('[FollowAudit] Queue failed:', error);
        setStatus('unexpected_error');
      }
      mode = signal.aborted ? 'ready' : 'error';
    } finally {
      progress = 100;
      controller = undefined;
      confirmedQueue = [];
      render();
    }
  };

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
      workspaces.following.selected.delete(id);
      workspaces.followers.selected.delete(id);
    }
    if (!saveIds(PROTECTED_KEY, protectedIds)) settingsFeedback('protected_save_error', {}, 'error');
    else settingsFeedback('backup_imported', { count: number(ids.length) });
    render();
  };

  const go = (next: Screen, focus?: string): void => {
    screen = next;
    render();
    get('.body').scrollTop = 0;
    get(focus ?? (next === 'report' ? '#scan' : '#back')).focus();
  };
  const openSegment = (next: Segment): void => {
    segment = next;
    query = '';
    limit = PAGE_SIZE;
    get<HTMLInputElement>('#search').value = '';
    go('list');
  };
  const goBack = (): void => {
    if (screen === 'report') return;
    go('report', screen === 'list' ? `[data-segment="${segment}"]` : '#nav-settings');
  };
  const setMinimized = (minimized: boolean): void => {
    host.toggleAttribute('data-minimized', minimized);
    app.hidden = minimized;
    get('#pill').hidden = !minimized;
    get(minimized ? '#pill' : '#minimize').focus();
  };
  const close = (): void => { controller?.abort(); host.remove(); };

  // Keep keystrokes inside the panel away from the platform's own keyboard shortcuts.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    root.addEventListener(type, event => {
      event.stopPropagation();
      if (type !== 'keydown' || !(event instanceof KeyboardEvent)) return;
      const menu = get<HTMLDetailsElement>('#language-menu');
      const target = event.composedPath()[0];
      const typing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      const dialogOpen = Boolean(root.querySelector('dialog[open]'));
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        get('#language-summary').focus();
      } else if (event.key === 'Escape' && !dialogOpen && !typing) {
        goBack();
      } else if (event.key === '/' && !typing && !dialogOpen && screen === 'list') {
        event.preventDefault();
        get('#search').focus();
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
  get('#run').addEventListener('click', openConfirmation);
  get('#confirm-action').addEventListener('click', () => { get<HTMLDialogElement>('#confirm-dialog').close(); void runConfirmed(); });
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
  root.querySelectorAll<HTMLButtonElement>('[data-segment]').forEach(button => button.addEventListener('click', () => openSegment(button.dataset.segment as Segment)));
  get('#select-visible').addEventListener('click', () => {
    const list = actionList();
    if (!list) return;
    const { selected } = workspaces[list];
    // Only rows actually rendered on screen are selected.
    const selectable = visibleAccounts().slice(0, limit).filter(isSelectable);
    const allSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));
    for (const account of selectable) { if (allSelected) selected.delete(account.id); else selected.add(account.id); }
    render();
  });
  get('#export').addEventListener('click', () => {
    download(toCsv(visibleAccounts()), 'text/csv;charset=utf-8', `followaudit-${platform}-${segment}-${today()}.csv`);
  });
  get<HTMLInputElement>('#search').addEventListener('input', event => { query = (event.currentTarget as HTMLInputElement).value; limit = PAGE_SIZE; render(); });
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
    settingsFeedback('history_cleared');
    render();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  root.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => button.addEventListener('click', () => {
    locale = button.dataset.locale as Locale;
    copy = translations[locale];
    writeText(LOCALE_KEY, locale);
    get<HTMLDetailsElement>('#language-menu').open = false;
    applyCopy();
    render();
  }));
  get('#theme-toggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    host.dataset.theme = theme;
    writeText(THEME_KEY, theme);
    applyCopy();
  });
  root.addEventListener('click', event => {
    const menu = get<HTMLDetailsElement>('#language-menu');
    if (menu.open && !event.composedPath().includes(menu)) menu.open = false;
  });

  applyCopy();
  render();
  get('#scan').focus();
  if (previewMode) void audit();
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

function download(content: string, type: string, filename: string): void {
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
