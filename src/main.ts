import { runSequential, scanFollowing, wait, type Account } from './core';
import { InstagramGateway } from './instagram';
import logoUrl from './logo.png';

const HOST_ID = 'follow-audit-app';
const PROTECTED_KEY = 'follow-audit:protected';
const localPreview = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
const instagramHost = location.hostname === 'instagram.com' || location.hostname.endsWith('.instagram.com');

function start(): void {
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `${layout()}<style>${styles}</style>`;

  type Mode = 'idle' | 'scanning' | 'ready' | 'running';
  type View = 'nonfollowers' | 'all' | 'protected';

  const gateway = new InstagramGateway();
  let mode: Mode = 'idle';
  let view: View = 'nonfollowers';
  let accounts: readonly Account[] = [];
  let query = '';
  let progress = 0;
  let status = 'Ready to audit your following list.';
  let controller: AbortController | undefined;
  const selected = new Set<string>();
  const protectedIds = loadProtected();
  const results = new Map<string, 'ok' | 'error'>();

  const get = <T extends Element>(selector: string): T => {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing interface element: ${selector}`);
    }
    return element;
  };

  const visibleAccounts = (): readonly Account[] => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return accounts.filter(account => {
      if (view === 'nonfollowers' && account.followsYou) return false;
      if (view === 'protected' && !protectedIds.has(account.id)) return false;
      return normalizedQuery === ''
        || account.username.toLocaleLowerCase().includes(normalizedQuery)
        || account.name.toLocaleLowerCase().includes(normalizedQuery);
    });
  };

  const render = (): void => {
    const visible = visibleAccounts();
    const locked = mode === 'scanning' || mode === 'running';
    const nonfollowers = accounts.filter(account => !account.followsYou).length;

    get<HTMLElement>('#status').textContent = status;
    get<HTMLElement>('#status-dot').dataset.mode = mode;
    get<HTMLProgressElement>('#progress').value = progress;
    get<HTMLProgressElement>('#progress').hidden = progress === 0 || progress === 100;
    get<HTMLElement>('#total-count').textContent = String(accounts.length);
    get<HTMLElement>('#nonfollowers-count').textContent = String(nonfollowers);
    get<HTMLElement>('#protected-count').textContent = String(protectedIds.size);
    get<HTMLElement>('#selection-count').textContent = `${selected.size} selected`;
    get<HTMLButtonElement>('#scan').disabled = locked;
    get<HTMLButtonElement>('#run').disabled = locked || selected.size === 0;
    get<HTMLButtonElement>('#run').textContent = selected.size > 0 ? `Unfollow ${selected.size} account${selected.size === 1 ? '' : 's'}` : 'Run unfollows';
    get<HTMLButtonElement>('#cancel').hidden = mode !== 'scanning' && mode !== 'running';
    get<HTMLButtonElement>('#select-visible').disabled = locked || visible.length === 0;
    get<HTMLButtonElement>('#export').disabled = accounts.length === 0;
    get<HTMLSelectElement>('#view').disabled = locked;
    get<HTMLInputElement>('#search').disabled = locked;
    renderList(visible, locked);
  };

  const renderList = (visible: readonly Account[], locked: boolean): void => {
    const list = get<HTMLElement>('#accounts');
    list.replaceChildren();

    if (visible.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = accounts.length === 0
        ? 'Run an audit to load your following list.'
        : 'No accounts match this view.';
      list.append(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const account of visible) {
      const item = document.createElement('article');
      item.className = 'account';
      item.dataset.result = results.get(account.id) ?? '';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(account.id);
      checkbox.disabled = locked || protectedIds.has(account.id) || results.get(account.id) === 'ok';
      checkbox.setAttribute('aria-label', `Select @${account.username}`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          selected.add(account.id);
        } else {
          selected.delete(account.id);
        }
        render();
      });

      const avatar = document.createElement('img');
      avatar.className = 'avatar';
      avatar.src = account.avatarUrl;
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.referrerPolicy = 'no-referrer';

      const identity = document.createElement('div');
      identity.className = 'identity';
      const username = document.createElement('a');
      username.href = `https://www.instagram.com/${encodeURIComponent(account.username)}/`;
      username.target = '_blank';
      username.rel = 'noreferrer';
      username.textContent = `@${account.username}`;
      const name = document.createElement('span');
      name.textContent = account.name || 'No display name';
      const badges = document.createElement('small');
      badges.textContent = [
        account.followsYou ? 'follows you' : 'does not follow you',
        account.isPrivate ? 'private' : 'public',
        account.isVerified ? 'verified' : '',
        results.get(account.id) === 'ok' ? 'unfollowed' : '',
        results.get(account.id) === 'error' ? 'failed' : '',
      ].filter(Boolean).join(' · ');
      identity.append(username, name, badges);

      const protect = document.createElement('button');
      protect.className = 'protect';
      protect.type = 'button';
      protect.disabled = locked;
      protect.dataset.active = String(protectedIds.has(account.id));
      protect.textContent = protectedIds.has(account.id) ? 'Protected' : 'Protect';
      protect.setAttribute('aria-pressed', String(protectedIds.has(account.id)));
      protect.addEventListener('click', () => {
        if (protectedIds.has(account.id)) {
          protectedIds.delete(account.id);
        } else {
          protectedIds.add(account.id);
          selected.delete(account.id);
        }
        saveProtected(protectedIds);
        render();
      });

      item.append(checkbox, avatar, identity, protect);
      fragment.append(item);
    }
    list.append(fragment);
  };

  const scan = async (): Promise<void> => {
    controller = new AbortController();
    mode = 'scanning';
    progress = 1;
    results.clear();
    selected.clear();
    status = localPreview ? 'Loading preview…' : 'Loading your following list…';
    render();

    try {
      accounts = localPreview
        ? await previewAccounts(controller.signal)
        : await scanFollowing(
          (cursor, signal) => gateway.loadFollowing(cursor, signal),
          controller.signal,
          {
            onProgress: (loaded, total) => {
              progress = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 1;
              status = `${loaded} of approximately ${total} accounts loaded…`;
              render();
            },
          },
        );
      mode = 'ready';
      progress = 100;
      status = `Audit complete: ${accounts.length} accounts found.`;
    } catch (error) {
      mode = 'idle';
      progress = 0;
      status = controller.signal.aborted ? 'Audit cancelled.' : message(error);
    } finally {
      controller = undefined;
      render();
    }
  };

  const run = async (): Promise<void> => {
    const queue = accounts.filter(account => selected.has(account.id) && !protectedIds.has(account.id));
    if (queue.length === 0 || !confirm(`Unfollow ${queue.length} account${queue.length === 1 ? '' : 's'}? This action changes your Instagram account.`)) {
      return;
    }

    const delaySeconds = numberInput(get<HTMLInputElement>('#delay'), 2, 120, 4);
    const batchMinutes = numberInput(get<HTMLInputElement>('#batch-delay'), 1, 30, 5);
    controller = new AbortController();
    mode = 'running';
    progress = 1;
    status = 'Running the action queue…';
    render();

    try {
      await runSequential(
        queue,
        (account, signal) => localPreview ? wait(250, signal) : gateway.unfollow(account.id, signal),
        controller.signal,
        {
          delayMs: delaySeconds * 1_000,
          batchSize: 5,
          batchDelayMs: batchMinutes * 60_000,
          onResult: (account, ok, completed, total) => {
            results.set(account.id, ok ? 'ok' : 'error');
            selected.delete(account.id);
            progress = Math.round((completed / total) * 100);
            status = `${completed} of ${total} actions processed.`;
            render();
          },
        },
      );
      status = 'Queue complete. Review the result shown for each account.';
    } catch (error) {
      status = controller.signal.aborted ? 'Queue cancelled.' : message(error);
    } finally {
      mode = 'ready';
      progress = 100;
      controller = undefined;
      render();
    }
  };

  get<HTMLButtonElement>('#close').addEventListener('click', () => {
    controller?.abort();
    host.remove();
  });
  get<HTMLButtonElement>('#scan').addEventListener('click', () => void scan());
  get<HTMLButtonElement>('#cancel').addEventListener('click', () => controller?.abort());
  get<HTMLButtonElement>('#run').addEventListener('click', () => void run());
  get<HTMLButtonElement>('#select-visible').addEventListener('click', () => {
    const selectable = visibleAccounts().filter(account => !protectedIds.has(account.id) && results.get(account.id) !== 'ok');
    const allSelected = selectable.length > 0 && selectable.every(account => selected.has(account.id));
    for (const account of selectable) {
      if (allSelected) {
        selected.delete(account.id);
      } else {
        selected.add(account.id);
      }
    }
    render();
  });
  get<HTMLButtonElement>('#export').addEventListener('click', () => exportCsv(visibleAccounts()));
  get<HTMLSelectElement>('#view').addEventListener('change', event => {
    view = (event.currentTarget as HTMLSelectElement).value as View;
    render();
  });
  get<HTMLInputElement>('#search').addEventListener('input', event => {
    query = (event.currentTarget as HTMLInputElement).value;
    render();
  });

  render();
}

function loadProtected(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROTECTED_KEY) ?? '[]');
    const ids = Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)).slice(0, 10_000)
      : [];
    return new Set(ids);
  } catch {
    localStorage.removeItem(PROTECTED_KEY);
    return new Set();
  }
}

function saveProtected(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(PROTECTED_KEY, JSON.stringify([...ids].slice(0, 10_000)));
  } catch {
    alert('The protected list could not be saved in this browser.');
  }
}

function numberInput(input: HTMLInputElement, min: number, max: number, fallback: number): number {
  const value = Number(input.value);
  const normalized = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  input.value = String(normalized);
  return normalized;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}

function exportCsv(accounts: readonly Account[]): void {
  const cell = (value: string | boolean): string => {
    const text = String(value);
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = accounts.map(account => [
    account.id,
    account.username,
    account.name,
    account.followsYou,
    account.isPrivate,
    account.isVerified,
  ].map(cell).join(','));
  const csv = ['id,username,name,follows_you,private,verified', ...rows].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `follow-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function previewAccounts(signal: AbortSignal): Promise<readonly Account[]> {
  await wait(450, signal);
  return [
    ['101', 'aurora.arq', 'Aurora Lima', false, false, true],
    ['102', 'cafecomleo', 'Leo Martins', true, false, false],
    ['103', 'flora.digital', 'Flora Reis', false, true, false],
    ['104', 'noiteemclaro', 'Nina Duarte', false, false, false],
    ['105', 'pedraepapel', 'Caio Nunes', true, true, false],
  ].map(([id, username, name, followsYou, isPrivate, isVerified]) => ({
    id: String(id),
    username: String(username),
    name: String(name),
    avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(String(username))}`,
    followsYou: Boolean(followsYou),
    isPrivate: Boolean(isPrivate),
    isVerified: Boolean(isVerified),
  }));
}

function layout(): string {
  return `
    <div class="app">
      <header>
        <div class="brand"><img class="mark" src="${logoUrl}" alt=""><div><strong>Follow Audit</strong><small>local following review</small></div></div>
        <div class="session"><span id="status-dot"></span><span id="status">Inicializando…</span></div>
        <button id="close" class="quiet" type="button" aria-label="Close">Close</button>
      </header>
      <progress id="progress" max="100" value="0" hidden></progress>
      <main>
        <aside>
          <section class="intro">
            <p class="eyebrow">FOLLOWING AUDIT</p>
            <h1>Review first.<br>Decide second.</h1>
            <p>Load your list, protect the people who matter, and only then choose an unfollow.</p>
            <button id="scan" class="primary" type="button">Audit following list</button>
            <button id="cancel" class="danger" type="button" hidden>Cancel operation</button>
          </section>
          <section class="metrics" aria-label="Summary">
            <div><strong id="total-count">0</strong><span>following</span></div>
            <div><strong id="nonfollowers-count">0</strong><span>do not follow</span></div>
            <div><strong id="protected-count">0</strong><span>protected</span></div>
          </section>
          <section class="settings">
            <h2>Queue pace</h2>
            <label>Delay per action <span><input id="delay" type="number" min="2" max="120" value="4"> s</span></label>
            <label>Break every 5 <span><input id="batch-delay" type="number" min="1" max="30" value="5"> min</span></label>
            <p>Delays reduce speed, but they cannot guarantee protection from platform limits.</p>
          </section>
        </aside>
        <section class="workspace">
          <div class="toolbar">
            <label class="search"><span class="sr-only">Search accounts</span><input id="search" type="search" placeholder="Search by name or @username"></label>
            <label><span class="sr-only">View</span><select id="view"><option value="nonfollowers">Do not follow you</option><option value="all">All accounts</option><option value="protected">Protected</option></select></label>
            <button id="select-visible" class="quiet" type="button">Select visible</button>
            <button id="export" class="quiet" type="button">Export CSV</button>
          </div>
          <div class="list-heading"><div><p class="eyebrow">REVIEW</p><h2>Accounts found</h2></div><strong id="selection-count">0 selected</strong></div>
          <div id="accounts" class="accounts" aria-live="polite"></div>
          <footer><p>Protected accounts never enter the queue.</p><button id="run" class="primary" type="button" disabled>Run unfollows</button></footer>
        </section>
      </main>
    </div>`;
}

const styles = `
  :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; color: #132238; font: 15px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  button, input, select { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .45; }
  button:focus-visible, input:focus-visible, select:focus-visible, a:focus-visible { outline: 3px solid #ffb000; outline-offset: 2px; }
  .app { min-height: 100%; overflow: auto; background: #eef2f3; }
  header { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; min-height: 68px; padding: 10px clamp(18px, 4vw, 56px); border-bottom: 1px solid #cbd5d8; background: rgba(255,255,255,.94); backdrop-filter: blur(14px); }
  .brand, .session { display: flex; align-items: center; gap: 10px; }
  .brand small, .brand strong { display: block; }
  .brand small { color: #647482; font-size: 11px; letter-spacing: .04em; }
  .mark { width: 42px; height: 42px; object-fit: contain; }
  .session { color: #526671; font-size: 13px; }
  #status-dot { width: 9px; height: 9px; border-radius: 50%; background: #53b88c; box-shadow: 0 0 0 4px rgba(83,184,140,.16); }
  #status-dot[data-mode="scanning"], #status-dot[data-mode="running"] { background: #ff7a45; box-shadow: 0 0 0 4px rgba(255,122,69,.16); }
  header > button { justify-self: end; }
  progress { position: fixed; z-index: 3; top: 66px; left: 0; width: 100%; height: 3px; appearance: none; border: 0; }
  progress::-webkit-progress-bar { background: transparent; }
  progress::-webkit-progress-value { background: #ff7a45; }
  main { display: grid; grid-template-columns: minmax(280px, 340px) 1fr; min-height: calc(100vh - 68px); }
  aside { padding: clamp(28px, 4vw, 58px) clamp(22px, 3vw, 42px); color: #f8faf7; background: #123d4a; }
  .intro { position: sticky; top: 116px; }
  .eyebrow { margin: 0 0 10px; color: #ed6a3a; font-size: 11px; font-weight: 900; letter-spacing: .16em; }
  aside .eyebrow { color: #a9efcb; }
  h1 { margin: 0; font: 800 clamp(38px, 5vw, 64px)/.96 Georgia, serif; letter-spacing: -.05em; }
  .intro > p:not(.eyebrow) { margin: 20px 0 26px; color: #c0d2d4; }
  .primary, .danger, .quiet, .protect { min-height: 42px; border: 0; border-radius: 10px; padding: 0 15px; font-weight: 800; }
  .primary { color: #10232c; background: #b8f2d5; box-shadow: 0 4px 0 #071a21; }
  .primary:hover:not(:disabled) { transform: translateY(1px); box-shadow: 0 3px 0 #071a21; }
  .danger { display: block; margin-top: 10px; color: #fff; background: #c94737; }
  .quiet, .protect { min-height: 36px; border: 1px solid #cbd5d8; color: #29414d; background: #fff; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 42px; padding-top: 22px; border-top: 1px solid #416671; }
  .metrics strong, .metrics span { display: block; }
  .metrics strong { font: 700 28px/1 Georgia, serif; }
  .metrics span { margin-top: 5px; color: #9fb7bc; font-size: 11px; }
  .settings { margin-top: 34px; }
  .settings h2 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; }
  .settings label { display: flex; justify-content: space-between; gap: 12px; margin: 10px 0; color: #c0d2d4; font-size: 13px; }
  .settings input { width: 54px; border: 1px solid #587983; border-radius: 6px; color: #fff; background: #0d303a; text-align: center; }
  .settings p { color: #91aeb4; font-size: 11px; }
  .workspace { min-width: 0; padding: clamp(24px, 4vw, 56px); }
  .toolbar { display: flex; flex-wrap: wrap; gap: 9px; }
  .toolbar input, .toolbar select { min-height: 38px; border: 1px solid #c3ced1; border-radius: 10px; padding: 0 12px; color: #132238; background: #fff; }
  .search { flex: 1; min-width: 220px; }
  .search input { width: 100%; }
  .list-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin: 42px 0 18px; padding-bottom: 18px; border-bottom: 2px solid #123d4a; }
  .list-heading h2 { margin: 0; font: 800 clamp(28px, 4vw, 46px)/1 Georgia, serif; letter-spacing: -.035em; }
  .list-heading > strong { color: #536b75; font-size: 13px; }
  .accounts { display: grid; }
  .account { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto; align-items: center; gap: 14px; min-height: 78px; padding: 12px 4px; border-bottom: 1px solid #cbd5d8; }
  .account[data-result="ok"] { opacity: .55; }
  .account[data-result="error"] { border-left: 3px solid #c94737; padding-left: 10px; }
  .account input { width: 18px; height: 18px; accent-color: #ed6a3a; }
  .avatar { width: 46px; height: 46px; border-radius: 15px 6px 15px 6px; object-fit: cover; background: #dae3e5; }
  .identity { min-width: 0; }
  .identity a, .identity span, .identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .identity a { width: fit-content; color: #123d4a; font-weight: 900; text-decoration: none; }
  .identity a:hover { text-decoration: underline; }
  .identity span { color: #526671; }
  .identity small { color: #778891; font-size: 11px; }
  .protect[data-active="true"] { border-color: #123d4a; color: #fff; background: #123d4a; }
  .empty { margin: 0; padding: 54px 18px; border: 1px dashed #afbdc1; border-radius: 14px; color: #647482; text-align: center; }
  footer { position: sticky; bottom: 0; display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 22px; padding: 14px; border: 1px solid #cbd5d8; border-radius: 14px; background: rgba(255,255,255,.94); backdrop-filter: blur(14px); }
  footer p { margin: 0; color: #647482; font-size: 12px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  @media (max-width: 820px) { header { grid-template-columns: 1fr auto; } .session { grid-column: 1 / -1; grid-row: 2; margin-top: 5px; } main { grid-template-columns: 1fr; } .intro { position: static; } aside { padding-block: 28px; } .settings { display: none; } .workspace { padding: 22px 16px; } }
  @media (max-width: 520px) { .toolbar > * { width: 100%; } .account { grid-template-columns: auto auto minmax(0,1fr); } .protect { grid-column: 3; justify-self: start; } footer { align-items: stretch; flex-direction: column; } }
  @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; transition: none !important; } }
`;

if (!instagramHost && !localPreview) {
  alert('Open Instagram before running Follow Audit.');
} else if (!document.getElementById(HOST_ID)) {
  start();
}
