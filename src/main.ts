import { runSequential, scanAccounts, wait, type Account, type ListKind } from './core';
import { format, resolveLocale, translations, type Copy, type CopyKey, type Locale } from './i18n';
import { InstagramGateway } from './instagram';
import logoUrl from './logo.png';
import fontUrl from './manrope.ttf';

const HOST_ID = 'follow-audit-app';
const PROTECTED_KEY = 'follow-audit:protected';
const LOCALE_KEY = 'follow-audit:language';
const THEME_KEY = 'follow-audit:theme';
const previewMode = ['localhost', '127.0.0.1', '::1'].includes(location.hostname)
  || (location.hostname === 'marquezinii.github.io' && location.pathname.endsWith('/follow-audit/preview.html'));
const instagramHost = location.hostname === 'instagram.com' || location.hostname.endsWith('.instagram.com');

type Mode = 'idle' | 'scanning' | 'ready' | 'running' | 'error';
type View = 'nonmutual' | 'all' | 'protected';
type Theme = 'light' | 'dark';

interface WorkspaceState {
  accounts: readonly Account[];
  readonly selected: Set<string>;
  readonly results: Map<string, 'ok' | 'error'>;
}

function start(): void {
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.append(host);
  const root = host.attachShadow({ mode: 'open' });
  let locale = resolveLocale(safeGet(LOCALE_KEY), navigator.language);
  let copy = translations[locale];
  let theme = initialTheme();
  root.innerHTML = `${layout(copy, locale, theme)}<style>${styles}</style>`;

  const gateway = new InstagramGateway();
  let mode: Mode = 'idle';
  let listKind: ListKind = 'following';
  let view: View = 'nonmutual';
  let query = '';
  let progress = 0;
  let statusKey: CopyKey = 'status_ready';
  let statusValues: Record<string, string | number> = {};
  let controller: AbortController | undefined;
  let confirmedQueue: readonly Account[] = [];
  let confirmedList: ListKind = 'following';
  const protectedIds = loadProtected();
  const workspaces: Record<ListKind, WorkspaceState> = {
    following: { accounts: [], selected: new Set(), results: new Map() },
    followers: { accounts: [], selected: new Set(), results: new Map() },
  };

  const get = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing interface element: ${selector}`);
    return element;
  };
  const text = (key: CopyKey, values: Record<string, string | number> = {}): string => format(copy, key, values);
  const setStatus = (key: CopyKey, values: Record<string, string | number> = {}): void => {
    statusKey = key;
    statusValues = values;
  };
  const visibleAccounts = (): readonly Account[] => {
    const { accounts } = workspaces[listKind];
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    return accounts.filter(account => {
      const mutual = listKind === 'following' ? account.followsYou : account.youFollow;
      if (view === 'nonmutual' && mutual) return false;
      if (view === 'protected' && !protectedIds.has(account.id)) return false;
      return normalizedQuery === ''
        || account.username.toLocaleLowerCase(locale).includes(normalizedQuery)
        || account.name.toLocaleLowerCase(locale).includes(normalizedQuery);
    });
  };

  const updateThemeControl = (): void => {
    const toggle = get<HTMLButtonElement>('#theme-toggle');
    toggle.setAttribute('aria-label', text(theme === 'dark' ? 'theme_light' : 'theme_dark'));
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  };
  const applyCopy = (): void => {
    get<HTMLElement>('.app').lang = locale;
    root.querySelectorAll<HTMLElement>('[data-copy]').forEach(element => {
      element.textContent = text(element.dataset.copy as CopyKey);
    });
    root.querySelectorAll<HTMLInputElement>('[data-copy-placeholder]').forEach(element => {
      element.placeholder = text(element.dataset.copyPlaceholder as CopyKey);
    });
    root.querySelectorAll<HTMLElement>('[data-copy-aria]').forEach(element => {
      element.setAttribute('aria-label', text(element.dataset.copyAria as CopyKey));
    });
    get<HTMLElement>('#active-language').textContent = locale === 'pt-BR' ? 'PT' : locale.toUpperCase();
    root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => {
      const active = button.dataset.locale === locale;
      button.dataset.active = String(active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
    updateThemeControl();
  };

  const render = (): void => {
    const { accounts } = workspaces[listKind];
    const visible = visibleAccounts();
    const locked = mode === 'scanning' || mode === 'running';
    const nonmutual = accounts.filter(account => !(listKind === 'following' ? account.followsYou : account.youFollow)).length;
    const hasAccounts = accounts.length > 0;

    get<HTMLElement>('#status').textContent = text(statusKey, statusValues);
    get<HTMLElement>('#status-dot').dataset.mode = mode;
    get<HTMLProgressElement>('#progress').value = progress;
    get<HTMLProgressElement>('#progress').style.visibility = progress === 0 || progress === 100 ? 'hidden' : 'visible';
    get<HTMLElement>('#total-count').textContent = String(accounts.length);
    get<HTMLElement>('#nonmutual-count').textContent = String(nonmutual);
    get<HTMLElement>('#protected-count').textContent = String(protectedIds.size);
    get<HTMLElement>('#page-title').textContent = text(view === 'protected' ? 'protected_title' : `${listKind}_title`);
    get<HTMLElement>('#page-body').textContent = text(view === 'protected' ? 'protected_body' : `${listKind}_body`);
    get<HTMLButtonElement>('#scan').disabled = locked;
    get<HTMLElement>('#scan-label').textContent = text(hasAccounts ? 'refresh' : 'audit');
    get<HTMLButtonElement>('#cancel').hidden = !locked;
    get<HTMLButtonElement>('#export').disabled = !hasAccounts;
    get<HTMLInputElement>('#search').disabled = locked;
    get<HTMLElement>('#sidebar-summary').hidden = !hasAccounts;
    root.querySelectorAll<HTMLButtonElement>('[data-list]').forEach(button => {
      const active = button.dataset.list === listKind;
      button.dataset.active = String(active && view !== 'protected');
      button.setAttribute('aria-selected', String(active));
      button.disabled = locked;
    });
    get<HTMLButtonElement>('#nav-protected').dataset.active = String(view === 'protected');
    get<HTMLElement>('#total-label').textContent = text(listKind);
    get<HTMLElement>('#nonmutual-label').textContent = text(listKind === 'following' ? 'view_nonfollowers' : 'view_not_followed');
    get<HTMLElement>('#relationship-label').textContent = text(listKind === 'following' ? 'following_you' : 'you_follow');
    get<HTMLButtonElement>('[data-view="nonmutual"]').textContent = text(listKind === 'following' ? 'view_nonfollowers' : 'view_not_followed');
    get<HTMLElement>('#safety-title').textContent = text('safety_title');
    get<HTMLElement>('#safety-body').textContent = text('safety_body');
    get<HTMLElement>('#selection-context').textContent = text(`${listKind}_body`);
    root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = locked;
    });
    renderSelection();
    renderList(visible, locked);
  };

  const renderSelection = (): void => {
    const { selected, results } = workspaces[listKind];
    const locked = mode === 'scanning' || mode === 'running';
    const selectable = visibleAccounts().filter(account => !protectedIds.has(account.id) && results.get(account.id) !== 'ok');
    const allVisibleSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));

    get<HTMLElement>('#selection-count').textContent = selected.size === 0 ? text('selection_none') : text('selection_count', { count: selected.size });
    get<HTMLButtonElement>('#run').disabled = locked || selected.size === 0;
    get<HTMLElement>('#run-label').textContent = text(listKind === 'following' ? 'review_unfollow' : 'review_remove', { count: selected.size });
    get<HTMLButtonElement>('#select-visible').disabled = locked || selectable.length === 0;
    get<HTMLElement>('#select-visible-label').textContent = text(allVisibleSelected ? 'clear_visible' : 'select_visible');
  };

  const renderList = (visible: readonly Account[], locked: boolean): void => {
    const { accounts, selected, results } = workspaces[listKind];
    const list = get<HTMLElement>('#accounts');
    list.replaceChildren();
    if (visible.length === 0) {
      const empty = document.createElement('section');
      empty.className = 'empty';
      empty.innerHTML = `${icon(accounts.length === 0 ? 'scan' : 'search')}<h2></h2><p></p>`;
      empty.querySelector('h2')!.textContent = text(accounts.length === 0 ? 'empty_initial_title' : 'empty_filtered_title');
      empty.querySelector('p')!.textContent = text(accounts.length === 0 ? 'empty_initial_body' : 'empty_filtered_body');
      if (accounts.length === 0) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'primary empty-action';
        action.textContent = text('empty_initial_action');
        action.disabled = locked;
        action.addEventListener('click', () => void scan());
        empty.append(action);
      }
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const account of visible) {
      const item = document.createElement('article');
      item.className = 'account-row';
      item.dataset.result = results.get(account.id) ?? '';
      item.dataset.selected = String(selected.has(account.id));
      item.setAttribute('role', 'row');

      const choice = document.createElement('label');
      choice.className = 'check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(account.id);
      checkbox.disabled = locked || protectedIds.has(account.id) || results.get(account.id) === 'ok';
      checkbox.setAttribute('aria-label', text('select_account', { username: account.username }));
      choice.append(checkbox, document.createElement('span'));
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selected.add(account.id);
        else selected.delete(account.id);
        item.dataset.selected = String(checkbox.checked);
        renderSelection();
      });

      const accountCell = document.createElement('div');
      accountCell.className = 'account-cell';
      const avatar = document.createElement('img');
      avatar.className = 'avatar'; avatar.src = account.avatarUrl; avatar.alt = ''; avatar.loading = 'lazy';
      const identity = document.createElement('div');
      identity.className = 'identity';
      const name = document.createElement('a');
      name.href = `https://www.instagram.com/${encodeURIComponent(account.username)}/`; name.target = '_blank'; name.rel = 'noopener noreferrer'; name.textContent = account.name || text('no_name');
      const mobileHandle = document.createElement('span');
      mobileHandle.className = 'mobile-handle'; mobileHandle.textContent = `@${account.username}`;
      const badges = document.createElement('small');
      badges.textContent = [account.isPrivate ? text('private') : '', account.isVerified ? text('verified') : '', results.get(account.id) === 'ok' ? text(listKind === 'following' ? 'unfollowed' : 'removed') : '', results.get(account.id) === 'error' ? text('failed') : ''].filter(Boolean).join(' · ');
      identity.append(name, mobileHandle, badges); accountCell.append(avatar, identity);

      const handle = document.createElement('span'); handle.className = 'handle'; handle.textContent = `@${account.username}`;
      const relationship = listKind === 'following' ? account.followsYou : account.youFollow;
      const follows = document.createElement('span'); follows.className = relationship ? 'follows yes' : 'follows no'; follows.textContent = text(relationship ? 'yes' : 'no');
      const protect = document.createElement('button');
      protect.className = 'protect'; protect.type = 'button'; protect.disabled = locked; protect.dataset.active = String(protectedIds.has(account.id));
      protect.innerHTML = `${icon(protectedIds.has(account.id) ? 'shield-check' : 'shield')}<span></span>`;
      protect.querySelector('span')!.textContent = text(protectedIds.has(account.id) ? 'protected' : 'protect');
      protect.setAttribute('aria-label', `${text(protectedIds.has(account.id) ? 'unprotect' : 'protect')} @${account.username}`);
      protect.setAttribute('aria-pressed', String(protectedIds.has(account.id)));
      protect.addEventListener('click', () => {
        if (protectedIds.has(account.id)) protectedIds.delete(account.id);
        else {
          protectedIds.add(account.id);
          workspaces.following.selected.delete(account.id);
          workspaces.followers.selected.delete(account.id);
        }
        saveProtected(protectedIds, copy); render();
      });
      item.append(choice, accountCell, handle, follows, protect);
      fragment.append(item);
    }
    list.append(fragment);
  };

  const scan = async (): Promise<void> => {
    const workspace = workspaces[listKind];
    controller = new AbortController(); mode = 'scanning'; progress = 1; workspace.results.clear(); workspace.selected.clear();
    setStatus(previewMode ? 'status_preview_loading' : 'status_loading'); render();
    try {
      workspace.accounts = previewMode ? await previewAccounts(listKind, controller.signal) : await scanAccounts(
        (cursor, signal) => listKind === 'following' ? gateway.loadFollowing(cursor, signal) : gateway.loadFollowers(cursor, signal), controller.signal,
        { onProgress: (loaded, total) => { progress = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 1; setStatus('status_loading_progress', { loaded, total }); render(); } },
      );
      mode = 'ready'; progress = 100; setStatus('status_complete', { count: workspace.accounts.length });
    } catch {
      const aborted = controller.signal.aborted; mode = aborted ? 'idle' : 'error'; progress = 0;
      setStatus(aborted ? 'status_cancelled' : 'unexpected_error');
    } finally { controller = undefined; render(); }
  };

  const openConfirmation = (): void => {
    const { accounts, selected } = workspaces[listKind];
    confirmedQueue = accounts.filter(account => selected.has(account.id) && !protectedIds.has(account.id));
    confirmedList = listKind;
    if (confirmedQueue.length === 0) return;
    get<HTMLElement>('#confirm-body').textContent = text(listKind === 'following' ? 'confirm_unfollow_body' : 'confirm_remove_body', { count: confirmedQueue.length });
    get<HTMLElement>('#confirm-action-label').textContent = text(listKind === 'following' ? 'confirm_unfollow' : 'confirm_remove', { count: confirmedQueue.length });
    const rows = confirmedQueue.slice(0, 8).map(account => {
      const row = document.createElement('div'); row.className = 'confirm-account';
      const avatar = document.createElement('img'); avatar.src = account.avatarUrl; avatar.alt = '';
      const label = document.createElement('span'); label.textContent = account.name || `@${account.username}`;
      const handle = document.createElement('small'); handle.textContent = `@${account.username}`;
      row.append(avatar, label, handle); return row;
    });
    get<HTMLElement>('#confirm-accounts').replaceChildren(...rows);
    get<HTMLDialogElement>('#confirm-dialog').showModal();
    get<HTMLButtonElement>('#confirm-action').focus();
  };

  const runConfirmed = async (): Promise<void> => {
    const queue = confirmedQueue;
    if (queue.length === 0) return;
    const { selected, results } = workspaces[confirmedList];
    const delaySeconds = numberInput(get<HTMLInputElement>('#delay'), 2, 120, 4);
    const batchMinutes = numberInput(get<HTMLInputElement>('#batch-delay'), 1, 30, 5);
    controller = new AbortController(); mode = 'running'; progress = 1; setStatus('status_queue'); render();
    try {
      await runSequential(queue, (account, signal) => previewMode
        ? wait(250, signal)
        : confirmedList === 'following' ? gateway.unfollow(account.id, signal) : gateway.removeFollower(account.id, signal), controller.signal, {
        delayMs: delaySeconds * 1_000, batchSize: 5, batchDelayMs: batchMinutes * 60_000,
        onResult: (account, ok, completed, total) => { results.set(account.id, ok ? 'ok' : 'error'); selected.delete(account.id); progress = Math.round((completed / total) * 100); setStatus('status_queue_progress', { completed, total }); render(); },
      });
      setStatus('status_queue_complete');
    } catch {
      setStatus(controller.signal.aborted ? 'status_queue_cancelled' : 'unexpected_error');
    } finally { mode = 'ready'; progress = 100; controller = undefined; confirmedQueue = []; render(); }
  };

  const setView = (next: View): void => { view = next; render(); };
  const setList = (next: ListKind): void => {
    listKind = next; view = 'nonmutual'; query = ''; get<HTMLInputElement>('#search').value = '';
    progress = workspaces[next].accounts.length > 0 ? 100 : 0;
    setStatus(workspaces[next].accounts.length > 0 ? 'status_complete' : 'status_ready', { count: workspaces[next].accounts.length });
    render();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && get<HTMLDetailsElement>('#language-menu').open) {
      get<HTMLDetailsElement>('#language-menu').open = false; get<HTMLElement>('#language-summary').focus();
    }
  };
  const close = (): void => { controller?.abort(); document.removeEventListener('keydown', onKeyDown); host.remove(); };

  get<HTMLButtonElement>('#close').addEventListener('click', close);
  get<HTMLButtonElement>('#scan').addEventListener('click', () => void scan());
  get<HTMLButtonElement>('#cancel').addEventListener('click', () => controller?.abort());
  get<HTMLButtonElement>('#run').addEventListener('click', openConfirmation);
  get<HTMLButtonElement>('#confirm-action').addEventListener('click', () => { get<HTMLDialogElement>('#confirm-dialog').close(); void runConfirmed(); });
  get<HTMLButtonElement>('#select-visible').addEventListener('click', () => {
    const { selected, results } = workspaces[listKind];
    const selectable = visibleAccounts().filter(account => !protectedIds.has(account.id) && results.get(account.id) !== 'ok');
    const allSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));
    for (const account of selectable) { if (allSelected) selected.delete(account.id); else selected.add(account.id); }
    render();
  });
  get<HTMLButtonElement>('#export').addEventListener('click', () => exportCsv(visibleAccounts()));
  get<HTMLInputElement>('#search').addEventListener('input', event => { query = (event.currentTarget as HTMLInputElement).value; render(); });
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view as View)));
  root.querySelectorAll<HTMLButtonElement>('[data-list]').forEach(button => button.addEventListener('click', () => setList(button.dataset.list as ListKind)));
  get<HTMLButtonElement>('#nav-protected').addEventListener('click', () => setView('protected'));
  get<HTMLButtonElement>('#nav-settings').addEventListener('click', () => get<HTMLDialogElement>('#settings-dialog').showModal());
  root.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog')?.close()));
  root.querySelectorAll<HTMLDialogElement>('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => button.addEventListener('click', () => {
    locale = button.dataset.locale as Locale; copy = translations[locale]; safeSet(LOCALE_KEY, locale);
    get<HTMLDetailsElement>('#language-menu').open = false; applyCopy(); render();
  }));
  get<HTMLButtonElement>('#theme-toggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark'; get<HTMLElement>('.app').dataset.theme = theme; safeSet(THEME_KEY, theme); updateThemeControl();
  });
  root.addEventListener('click', event => {
    const menu = get<HTMLDetailsElement>('#language-menu');
    if (menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', onKeyDown);
  applyCopy(); render();
  if (previewMode) void scan();
}

function loadProtected(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROTECTED_KEY) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)).slice(0, 10_000) : []);
  } catch { safeSet(PROTECTED_KEY, '[]'); return new Set(); }
}

function saveProtected(ids: ReadonlySet<string>, copy: Copy): void {
  try { localStorage.setItem(PROTECTED_KEY, JSON.stringify([...ids].slice(0, 10_000))); }
  catch { alert(copy.protected_save_error); }
}

function safeGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function safeSet(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* Preferences remain session-only. */ } }
function initialTheme(): Theme {
  const saved = safeGet(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function numberInput(input: HTMLInputElement, min: number, max: number, fallback: number): number {
  const value = Number(input.value); const normalized = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  input.value = String(normalized); return normalized;
}
function exportCsv(accounts: readonly Account[]): void {
  const cell = (value: string | boolean): string => {
    const raw = String(value); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = accounts.map(account => [account.id, account.username, account.name, account.followsYou, account.youFollow, account.isPrivate, account.isVerified].map(cell).join(','));
  const url = URL.createObjectURL(new Blob([['id,username,name,follows_you,you_follow,private,verified', ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `follow-audit-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

async function previewAccounts(kind: ListKind, signal: AbortSignal): Promise<readonly Account[]> {
  await wait(500, signal);
  const base = new URL('./avatars/', location.href);
  return [
    ['101', 'avamartin', 'Ava Martin', false, false, true, 'ava-martin.png'], ['102', 'liam.chen', 'Liam Chen', true, false, false, 'liam-chen.png'],
    ['103', 'noahpatel', 'Noah Patel', false, true, false, 'noah-patel.png'], ['104', 'isabellarossi', 'Isabella Rossi', true, false, false, 'isabella-rossi.png'],
    ['105', 'masonlee', 'Mason Lee', false, false, false, 'mason-lee.png'], ['106', 'sophiedubois', 'Sophie Dubois', true, true, false, 'sophie-dubois.png'],
  ].map(([id, username, name, followsYou, isPrivate, isVerified, avatar]) => ({
    id: String(id), username: String(username), name: String(name), avatarUrl: new URL(String(avatar), base).href,
    followsYou: kind === 'followers' || Boolean(followsYou), youFollow: kind === 'following' || Boolean(followsYou),
    isPrivate: Boolean(isPrivate), isVerified: Boolean(isVerified),
  }));
}

function layout(copy: Copy, locale: Locale, theme: Theme): string {
  const language = locale === 'pt-BR' ? 'PT' : locale.toUpperCase();
  return `<div class="app" data-theme="${theme}" lang="${locale}">
    <aside class="sidebar">
      <div class="brand"><img src="${logoUrl}" alt=""><strong>Follow Audit</strong></div>
      <nav aria-label="Follow Audit">
        <button type="button" data-list="following" data-active="true" data-copy-aria="following" aria-label="${copy.following}">${icon('review')}<span data-copy="following">${copy.following}</span></button>
        <button type="button" data-list="followers" data-copy-aria="followers" aria-label="${copy.followers}">${icon('followers')}<span data-copy="followers">${copy.followers}</span></button>
        <button id="nav-protected" type="button" data-copy-aria="protected" aria-label="${copy.protected}">${icon('shield')}<span data-copy="protected">${copy.protected}</span></button>
        <button id="nav-settings" type="button" data-copy-aria="settings" aria-label="${copy.settings}">${icon('settings')}<span data-copy="settings">${copy.settings}</span></button>
      </nav>
      <section id="sidebar-summary" class="sidebar-summary" hidden><div><strong id="total-count">0</strong><span id="total-label">${copy.following}</span></div><div><strong id="nonmutual-count">0</strong><span id="nonmutual-label">${copy.view_nonfollowers}</span></div><div><strong id="protected-count">0</strong><span data-copy="protected_label">${copy.protected_label}</span></div></section>
      <div class="local-note"><span class="local-dot"></span><div><strong data-copy="privacy_title">${copy.privacy_title}</strong><small data-copy="privacy_body">${copy.privacy_body}</small></div></div><span class="route-line" aria-hidden="true"></span>
    </aside>
    <section class="shell">
      <header class="topbar">
        <div class="mobile-brand"><img src="${logoUrl}" alt=""><strong>Follow Audit</strong></div>
        <div class="session" role="status" aria-live="polite"><span id="status-dot"></span><span id="status">${copy.status_ready}</span></div>
        <div class="top-actions">
          <details id="language-menu" class="language-menu"><summary id="language-summary" data-copy-aria="language" aria-label="${copy.language}">${icon('globe')}<span id="active-language">${language}</span>${icon('chevron')}</summary>
            <div class="language-popover" role="menu"><p data-copy="language">${copy.language}</p>
              <button type="button" data-locale="en" aria-label="English"><span>EN</span><strong>English</strong>${icon('check')}</button><button type="button" data-locale="pt-BR" aria-label="Português"><span>PT</span><strong>Português</strong>${icon('check')}</button><button type="button" data-locale="es" aria-label="Español"><span>ES</span><strong>Español</strong>${icon('check')}</button><button type="button" data-locale="fr" aria-label="Français"><span>FR</span><strong>Français</strong>${icon('check')}</button><button type="button" data-locale="de" aria-label="Deutsch"><span>DE</span><strong>Deutsch</strong>${icon('check')}</button>
            </div></details>
          <button id="theme-toggle" class="theme-toggle" type="button" aria-label="${copy.theme_dark}"><span>${icon('sun')}</span><span>${icon('moon')}</span><i></i></button>
          <button id="close" class="icon-button" type="button" data-copy-aria="close" aria-label="${copy.close}">${icon('close')}</button>
        </div>
      </header><progress id="progress" max="100" value="0" style="visibility:hidden"></progress>
      <main class="workspace">
        <section class="page-heading"><div><h1 id="page-title">${copy.following_title}</h1><p id="page-body">${copy.following_body}</p></div><div class="scan-actions"><button id="cancel" class="secondary danger" type="button" hidden><span data-copy="cancel">${copy.cancel}</span></button><button id="scan" class="primary" type="button">${icon('scan')}<span id="scan-label">${copy.audit}</span></button></div></section>
        <section class="toolbar" aria-label="Account controls">
          <div class="list-switch" role="tablist"><button type="button" role="tab" data-list="following" data-copy="following">${copy.following}</button><button type="button" role="tab" data-list="followers" data-copy="followers">${copy.followers}</button></div>
          <label class="search">${icon('search')}<span class="sr-only" data-copy="search">${copy.search}</span><input id="search" type="search" data-copy-placeholder="search" placeholder="${copy.search}"></label>
          <div class="view-switch" role="group" aria-label="View"><button type="button" data-view="nonmutual">${copy.view_nonfollowers}</button><button type="button" data-view="all" data-copy="view_all">${copy.view_all}</button><button type="button" data-view="protected" data-copy="view_protected">${copy.view_protected}</button></div>
          <span class="toolbar-spacer"></span><button id="select-visible" class="secondary" type="button">${icon('select')}<span id="select-visible-label">${copy.select_visible}</span></button><button id="export" class="secondary" type="button">${icon('download')}<span data-copy="export">${copy.export}</span></button>
        </section>
        <section class="table" role="table" aria-label="Accounts"><div class="table-head" role="row"><span></span><span data-copy="account">${copy.account}</span><span data-copy="username">${copy.username}</span><span id="relationship-label">${copy.following_you}</span><span data-copy="protection">${copy.protection}</span></div><div id="accounts" class="accounts"></div></section>
      </main>
      <footer class="actionbar"><div class="safety-mark">${icon('shield')}</div><div class="safety-copy"><strong id="safety-title">${copy.safety_title}</strong><span id="safety-body">${copy.safety_body}</span></div><div class="selection"><strong id="selection-count">${copy.selection_none}</strong><span id="selection-context">${copy.following_body}</span></div><button id="run" class="primary action" type="button" disabled><span id="run-label">${format(copy, 'review_unfollow', { count: 0 })}</span>${icon('arrow')}</button></footer>
    </section>
    <dialog id="settings-dialog" class="dialog side-dialog"><form method="dialog" class="dialog-panel"><header><div><h2 data-copy="settings_title">${copy.settings_title}</h2><p data-copy="settings_body">${copy.settings_body}</p></div><button type="submit" class="icon-button" data-close-dialog data-copy-aria="close" aria-label="${copy.close}">${icon('close')}</button></header><div class="setting-row"><label for="delay" data-copy="delay_label">${copy.delay_label}</label><div><input id="delay" type="number" min="2" max="120" value="4"><span data-copy="delay_unit">${copy.delay_unit}</span></div></div><div class="setting-row"><label for="batch-delay" data-copy="batch_label">${copy.batch_label}</label><div><input id="batch-delay" type="number" min="1" max="30" value="5"><span data-copy="batch_unit">${copy.batch_unit}</span></div></div><p class="notice">${icon('info')}<span data-copy="limits_notice">${copy.limits_notice}</span></p><button type="submit" class="primary full" data-close-dialog data-copy="done">${copy.done}</button></form></dialog>
    <dialog id="confirm-dialog" class="dialog confirm-dialog"><section class="dialog-panel"><header><div><span class="dialog-icon">${icon('shield')}</span><h2 data-copy="confirm_title">${copy.confirm_title}</h2><p id="confirm-body"></p></div><button type="button" class="icon-button" data-close-dialog data-copy-aria="close" aria-label="${copy.close}">${icon('close')}</button></header><p class="list-label" data-copy="confirm_list">${copy.confirm_list}</p><div id="confirm-accounts" class="confirm-accounts"></div><footer><button type="button" class="secondary" data-close-dialog data-copy="confirm_cancel">${copy.confirm_cancel}</button><button id="confirm-action" type="button" class="primary danger-primary"><span id="confirm-action-label"></span>${icon('arrow')}</button></footer></section></dialog>
  </div>`;
}

type IconName = 'arrow' | 'check' | 'chevron' | 'close' | 'download' | 'followers' | 'globe' | 'info' | 'moon' | 'review' | 'scan' | 'search' | 'select' | 'settings' | 'shield' | 'shield-check' | 'sun';
function icon(name: IconName): string {
  const paths: Record<IconName, string> = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', check: '<path d="m5 12 4 4L19 6"/>', chevron: '<path d="m8 10 4 4 4-4"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14"/>', followers: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>', moon: '<path d="M20 15.2A8 8 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/>',
    review: '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11l2 2 4-4"/>', scan: '<path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3M7 12h10"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', select: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 3 3 5-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    shield: '<path d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z"/>', 'shield-check': '<path d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

const styles = `
  @font-face{font-family:FollowAudit;src:url("${fontUrl}") format("truetype");font-weight:200 800;font-display:swap}
  :host{all:initial;position:fixed;inset:0;z-index:2147483647;font:14px/1.45 FollowAudit,ui-sans-serif,system-ui,sans-serif}
  *{box-sizing:border-box}[hidden]{display:none!important}button,input{font:inherit}button{cursor:pointer}button:disabled{cursor:not-allowed;opacity:.42}
  button:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid var(--focus);outline-offset:2px}svg{width:20px;height:20px;flex:0 0 auto}
  .app{--bg:#fff;--surface:#fff;--subtle:#f6f8fa;--active:#eef9fc;--text:#07162d;--muted:#5c687a;--quiet:#8894a3;--border:#d9e0e7;--strong:#b9c5d1;--navy:#031a33;--navy2:#062a50;--cyan:#079ec3;--cyan2:#16c1e7;--orange:#ff8a00;--positive:#078a58;--negative:#df3c2f;--focus:#ff9b1c;--shadow:0 18px 55px rgba(1,18,37,.15);position:fixed;inset:0;display:grid;grid-template-columns:260px minmax(0,1fr);overflow:hidden;color:var(--text);background:var(--bg);color-scheme:light}
  .app[data-theme=dark]{--bg:#07182c;--surface:#0a2038;--subtle:#0d2945;--active:#0d324f;--text:#f6f9fc;--muted:#a8b7c9;--quiet:#788ba1;--border:#264058;--strong:#3c5870;--cyan:#26c6e8;--cyan2:#57d8ef;--positive:#42d49b;--negative:#ff7569;--shadow:0 20px 70px rgba(0,0,0,.35);color-scheme:dark}
  .sidebar{position:relative;display:flex;flex-direction:column;min-width:0;padding:26px 16px 24px;overflow:hidden;color:#f7fbff;background:var(--navy)}
  .sidebar:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 92% 4%,rgba(18,193,231,.13),transparent 27%)}
  .brand{position:relative;display:flex;align-items:center;gap:12px;padding:0 10px 30px;font-size:19px;letter-spacing:-.025em}.brand img,.mobile-brand img{width:45px;height:45px;object-fit:contain}
  nav{position:relative;display:grid;gap:7px}nav button{position:relative;display:flex;align-items:center;gap:14px;min-height:58px;border:0;border-radius:9px;padding:0 16px;color:#bdccdc;background:transparent;text-align:left;font-weight:650}
  nav button:before{content:"";position:absolute;left:-16px;width:4px;height:0;border-radius:0 4px 4px 0;background:var(--cyan2);transition:height .18s ease}nav button:hover{color:#fff;background:rgba(255,255,255,.055)}nav button[data-active=true]{color:#fff;background:#0b3964}nav button[data-active=true]:before{height:38px}
  .sidebar-summary{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:32px 8px 0;padding-top:22px;border-top:1px solid #254560}.sidebar-summary strong,.sidebar-summary span{display:block}.sidebar-summary strong{font-size:22px;letter-spacing:-.04em}.sidebar-summary span{margin-top:2px;color:#7f98ae;font-size:9px;line-height:1.25;text-transform:uppercase;letter-spacing:.06em}
  .local-note{position:relative;display:flex;align-items:flex-start;gap:10px;margin:auto 10px 28px;padding-top:22px;border-top:1px solid #254560}.local-note strong,.local-note small{display:block}.local-note strong{font-size:12px;font-weight:650}.local-note small{margin-top:3px;color:#8fa6ba;font-size:11px}.local-dot{width:8px;height:8px;margin-top:5px;border-radius:50%;background:#21cc78;box-shadow:0 0 0 4px rgba(33,204,120,.09)}
  .route-line{position:absolute;right:0;bottom:19px;width:83%;height:1px;background:#0ab4db}.route-line:before{content:"";position:absolute;left:-3px;top:-4px;width:7px;height:7px;border:1px solid #20cdec;border-radius:50%;background:var(--navy)}
  .shell{min-width:0;min-height:0;display:grid;grid-template-rows:70px 3px minmax(0,1fr) auto;background:var(--bg)}.topbar{display:flex;align-items:center;gap:22px;padding:0 28px;border-bottom:1px solid var(--border);background:var(--surface)}.mobile-brand{display:none}.session{display:flex;align-items:center;gap:10px;min-width:0;color:var(--muted);font-size:13px}#status{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #status-dot{width:9px;height:9px;border-radius:50%;background:#1ebd70;box-shadow:0 0 0 4px rgba(30,189,112,.08)}#status-dot[data-mode=scanning],#status-dot[data-mode=running]{background:var(--orange);box-shadow:0 0 0 4px rgba(255,138,0,.1)}#status-dot[data-mode=error]{background:var(--negative)}
  .top-actions{display:flex;align-items:center;gap:10px;margin-left:auto}.icon-button,.language-menu summary,.theme-toggle{display:grid;place-items:center;min-width:42px;height:42px;border:1px solid var(--border);border-radius:9px;color:var(--text);background:var(--surface)}.icon-button{padding:0}.icon-button:hover,.language-menu summary:hover{border-color:var(--strong);background:var(--subtle)}
  .language-menu{position:relative}.language-menu summary{display:flex;gap:8px;min-width:88px;padding:0 11px;cursor:pointer;list-style:none;font-weight:650}.language-menu summary::-webkit-details-marker{display:none}.language-menu summary svg:first-child{width:17px}.language-menu summary svg:last-child{width:14px}
  .language-popover{position:absolute;z-index:10;top:calc(100% + 10px);right:0;width:230px;padding:8px;border:1px solid var(--border);border-radius:12px;background:var(--surface);box-shadow:var(--shadow)}.language-popover p{margin:5px 9px 8px;color:var(--quiet);font-size:10px;font-weight:750;letter-spacing:.1em;text-transform:uppercase}.language-popover button{display:grid;grid-template-columns:32px 1fr 20px;align-items:center;width:100%;min-height:42px;border:0;border-radius:7px;padding:0 9px;color:var(--text);background:transparent;text-align:left}.language-popover button:hover{background:var(--subtle)}.language-popover button>span{color:var(--quiet);font-size:11px;font-weight:750}.language-popover button>strong{font-size:13px;font-weight:600}.language-popover button svg{display:none;width:16px;color:var(--cyan)}.language-popover button[data-active=true]{color:var(--cyan);background:var(--active)}.language-popover button[data-active=true] svg{display:block}
  .theme-toggle{position:relative;display:grid;grid-template-columns:36px 36px;width:76px;padding:2px;overflow:hidden;border-radius:24px}.theme-toggle span{z-index:1;display:grid;place-items:center}.theme-toggle svg{width:17px}.theme-toggle i{position:absolute;top:3px;left:3px;width:34px;height:34px;border-radius:50%;background:var(--navy);transition:transform .2s ease}.theme-toggle span:first-child{color:#fff}.theme-toggle span:nth-child(2){color:var(--muted)}.app[data-theme=dark] .theme-toggle i{transform:translateX(36px);background:#e9f7ff}.app[data-theme=dark] .theme-toggle span:first-child{color:var(--muted)}.app[data-theme=dark] .theme-toggle span:nth-child(2){color:var(--navy)}
  progress{display:block;width:100%;height:3px;appearance:none;border:0;background:transparent}progress::-webkit-progress-bar{background:transparent}progress::-webkit-progress-value{background:var(--cyan);transition:width .2s ease}
  .workspace{min-height:0;overflow:auto;padding:48px clamp(26px,4vw,62px) 32px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:36px}.page-heading h1{margin:0;color:var(--text);font-size:clamp(34px,4vw,46px);line-height:1.05;letter-spacing:-.048em}.page-heading p{margin:12px 0 0;color:var(--muted);font-size:16px}.scan-actions{display:flex;gap:9px}
  .primary,.secondary,.protect{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:42px;border-radius:8px;padding:0 16px;font-weight:680;transition:border-color .15s ease,background .15s ease,transform .15s ease}.primary{border:1px solid var(--cyan);color:#fff;background:var(--navy)}.primary:hover:not(:disabled){transform:translateY(-1px);background:var(--navy2)}.secondary,.protect{border:1px solid var(--border);color:var(--text);background:var(--surface)}.secondary:hover:not(:disabled),.protect:hover:not(:disabled){border-color:var(--strong);background:var(--subtle)}.secondary.danger{color:var(--negative)}
  .toolbar{display:flex;align-items:center;gap:10px;margin-bottom:18px}.search{position:relative;display:flex;align-items:center;width:min(330px,31vw)}.search>svg{position:absolute;left:13px;width:18px;color:var(--quiet);pointer-events:none}.search input{width:100%;height:44px;border:1px solid var(--border);border-radius:8px;padding:0 14px 0 42px;color:var(--text);background:var(--surface)}.search input::placeholder{color:var(--quiet)}
  .list-switch{display:flex;align-items:center;padding:3px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}.list-switch button{min-height:36px;border:0;border-radius:6px;padding:0 14px;color:var(--muted);background:transparent;font-weight:680}.list-switch button[data-active=true]{color:#fff;background:var(--navy)}
  .view-switch{display:flex;align-items:center;padding:3px;border:1px solid var(--border);border-radius:9px;background:var(--subtle)}.view-switch button{min-height:36px;border:0;border-radius:6px;padding:0 12px;color:var(--muted);background:transparent;font-size:12px;font-weight:630}.view-switch button[data-active=true]{color:var(--text);background:var(--surface);box-shadow:0 1px 3px rgba(5,23,42,.08)}.toolbar-spacer{flex:1}.toolbar .secondary{min-height:44px;white-space:nowrap}.toolbar .secondary svg{width:17px}
  .table{overflow:hidden;border:1px solid var(--border);border-radius:10px;background:var(--surface)}.table-head,.account-row{display:grid;grid-template-columns:42px minmax(190px,1.2fr) minmax(140px,1fr) 150px 160px;align-items:center;column-gap:14px}.table-head{min-height:48px;padding:0 18px;border-bottom:1px solid var(--border);color:var(--muted);background:var(--subtle);font-size:11px;font-weight:720;letter-spacing:.055em;text-transform:uppercase}
  .account-row{min-height:76px;padding:10px 18px;border-bottom:1px solid var(--border);transition:background .15s ease}.account-row:last-child{border-bottom:0}.account-row:hover{background:var(--subtle)}.account-row[data-selected=true]{background:var(--active)}.account-row[data-result=ok]{opacity:.56}.account-row[data-result=error]{box-shadow:inset 3px 0 var(--negative)}
  .check{position:relative;display:inline-grid;place-items:center;width:22px;height:22px}.check input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:inherit}.check span{display:grid;place-items:center;width:20px;height:20px;border:1.5px solid var(--strong);border-radius:4px;background:var(--surface)}.check input:checked+span{border-color:var(--cyan);background:var(--cyan)}.check input:checked+span:after{content:"";width:8px;height:4px;border:solid #fff;border-width:0 0 2px 2px;transform:translateY(-1px) rotate(-45deg)}.check input:disabled+span{opacity:.45}.check input:focus-visible+span{outline:3px solid var(--focus);outline-offset:2px}
  .account-cell{min-width:0;display:flex;align-items:center;gap:13px}.avatar{width:44px;height:44px;flex:0 0 auto;border-radius:50%;object-fit:cover;background:var(--subtle)}.identity{min-width:0}.identity a,.identity span,.identity small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.identity a{width:fit-content;max-width:100%;color:var(--text);font-weight:670;text-decoration:none}.identity a:hover{color:var(--cyan);text-decoration:underline}.identity small{min-height:16px;margin-top:3px;color:var(--quiet);font-size:10px;text-transform:uppercase;letter-spacing:.045em}.mobile-handle{display:none!important;color:var(--muted);font-size:12px}.handle{min-width:0;overflow:hidden;color:var(--muted);text-overflow:ellipsis;white-space:nowrap}.follows{width:fit-content;font-weight:650}.follows.yes{color:var(--positive)}.follows.no{color:var(--negative)}
  .protect{justify-self:start;min-width:112px;min-height:38px;color:var(--cyan)}.protect svg{width:18px}.protect[data-active=true]{border-color:transparent;color:var(--positive);background:color-mix(in srgb,var(--positive) 11%,transparent)}
  .empty{display:grid;justify-items:center;padding:clamp(58px,9vh,100px) 24px;text-align:center}.empty>svg{width:38px;height:38px;margin-bottom:20px;color:var(--cyan)}.empty h2{margin:0;color:var(--text);font-size:24px;letter-spacing:-.025em}.empty p{max-width:430px;margin:9px 0 0;color:var(--muted)}.empty-action{margin-top:24px}
  .actionbar{position:relative;display:grid;grid-template-columns:auto minmax(230px,1fr) minmax(180px,.65fr) auto;align-items:center;gap:18px;min-height:104px;padding:16px clamp(26px,4vw,62px);border-top:1px solid var(--border);background:var(--surface)}.actionbar:before{content:"";position:absolute;top:-1px;right:0;width:28%;height:1px;background:var(--cyan)}.safety-mark{display:grid;place-items:center;width:46px;height:46px;color:var(--navy)}.app[data-theme=dark] .safety-mark{color:var(--cyan)}.safety-mark svg{width:36px;height:36px}.safety-copy strong,.safety-copy span,.selection strong,.selection span{display:block}.safety-copy strong,.selection strong{color:var(--text);font-size:13px}.safety-copy span,.selection span{margin-top:3px;color:var(--muted);font-size:11px}.selection{padding-left:24px;border-left:1px solid var(--border)}.action{min-width:220px;min-height:54px;border-color:var(--orange);background:var(--orange);font-size:15px}.action:hover:not(:disabled){background:#f27f00}
  .dialog{position:fixed;inset:0;width:100vw;max-width:none;height:100vh;max-height:none;margin:0;border:0;padding:0;color:var(--text);background:transparent;overflow:visible}.dialog[open]{display:grid;place-items:center}.dialog::backdrop{background:rgba(1,13,27,.68);backdrop-filter:blur(4px)}.dialog-panel{display:block;width:min(560px,calc(100vw - 34px));max-height:min(760px,calc(100vh - 34px));overflow:auto;border:1px solid var(--border);border-radius:14px;padding:26px;color:var(--text);background:var(--surface);box-shadow:var(--shadow)}.dialog-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.dialog-panel h2{margin:0;font-size:25px;line-height:1.15;letter-spacing:-.035em}.dialog-panel header p{margin:8px 0 0;color:var(--muted)}.dialog-panel .icon-button{flex:0 0 auto}.side-dialog[open]{place-items:center end;padding-right:22px}.side-dialog .dialog-panel{width:min(440px,calc(100vw - 34px))}
  .setting-row{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-top:28px;padding-bottom:20px;border-bottom:1px solid var(--border)}.setting-row label{font-weight:650}.setting-row>div{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:12px}.setting-row input{width:72px;height:40px;border:1px solid var(--border);border-radius:7px;padding:0 8px;color:var(--text);background:var(--subtle);text-align:center}.notice{display:flex;gap:10px;margin:24px 0;padding:14px;border-left:2px solid var(--cyan);color:var(--muted);background:var(--subtle);font-size:12px}.notice svg{width:18px;color:var(--cyan)}.full{width:100%}
  .dialog-icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:20px;border-radius:50%;color:var(--orange);background:color-mix(in srgb,var(--orange) 12%,transparent)}.dialog-icon svg{width:25px;height:25px}.list-label{margin:24px 0 9px;color:var(--quiet);font-size:10px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}.confirm-accounts{max-height:265px;overflow:auto;border-block:1px solid var(--border)}.confirm-account{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;min-height:54px;border-bottom:1px solid var(--border)}.confirm-account:last-child{border-bottom:0}.confirm-account img{width:32px;height:32px;border-radius:50%;object-fit:cover}.confirm-account span{font-weight:630}.confirm-account small{color:var(--muted)}.confirm-dialog footer{display:flex;justify-content:flex-end;gap:9px;margin-top:24px}.danger-primary{border-color:var(--orange);background:var(--orange)}.danger-primary:hover:not(:disabled){background:#f27f00}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  @media(max-width:1250px){.app{grid-template-columns:88px minmax(0,1fr)}.brand{justify-content:center;padding-inline:0}.brand strong,.local-note div,.sidebar-summary{display:none}nav span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}nav button{justify-content:center;padding:0}.local-note{justify-content:center;margin-inline:0}.route-line{width:58%}.toolbar{flex-wrap:wrap}.toolbar-spacer{display:none}.search{flex:1;width:auto;min-width:250px}.table-head,.account-row{grid-template-columns:36px minmax(180px,1.2fr) minmax(125px,1fr) 110px 130px;column-gap:10px}.protect{min-width:104px}}
  @media(max-width:820px){.app{grid-template-columns:1fr}.sidebar{display:none}.topbar{padding-inline:16px}.mobile-brand{display:flex;align-items:center;gap:8px}.mobile-brand img{width:36px;height:36px}.mobile-brand strong{display:none}.session{flex:1}.workspace{padding:30px 16px 22px}.page-heading{align-items:flex-start}.page-heading p{font-size:14px}.view-switch{order:3;width:100%}.view-switch button{flex:1}.table-head{display:none}.table{border-inline:0;border-radius:0}.account-row{grid-template-columns:34px minmax(0,1fr) 70px 112px;padding-inline:4px}.handle{display:none}.mobile-handle{display:block!important}.actionbar{grid-template-columns:auto 1fr auto;padding-inline:16px}.selection{display:none}.safety-copy span{display:none}.action{min-width:185px}}
  @media(max-width:600px){.shell{grid-template-rows:62px 3px minmax(0,1fr) auto}.topbar{gap:8px}.session{display:none}.language-menu summary{min-width:72px}.language-menu summary svg:first-child{display:none}.theme-toggle{width:68px;grid-template-columns:32px 32px}.theme-toggle i{width:30px;height:30px}.app[data-theme=dark] .theme-toggle i{transform:translateX(32px)}.page-heading{display:grid;margin-bottom:26px}.page-heading h1{font-size:32px}.scan-actions{width:100%}.scan-actions button{flex:1}.search{min-width:100%}.toolbar .secondary{flex:1}.view-switch{overflow-x:auto}.view-switch button{min-width:max-content}.account-row{grid-template-columns:30px minmax(0,1fr) 62px;min-height:84px}.account-row .protect{grid-column:2;min-width:0;width:fit-content;margin-top:-8px}.avatar{width:40px;height:40px}.follows{justify-self:end}.actionbar{grid-template-columns:1fr;min-height:82px;padding-block:12px}.safety-mark,.safety-copy{display:none}.action{width:100%;min-height:50px}.confirm-dialog footer{flex-direction:column-reverse}.confirm-dialog footer button{width:100%}}
  @media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition:none!important}}
`;

if (!instagramHost && !previewMode) alert('Open Instagram before running Follow Audit.');
else if (!document.getElementById(HOST_ID)) start();
