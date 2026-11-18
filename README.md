<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/followaudit-logo-dark.svg">
    <img src="assets/brand/followaudit-logo.svg" width="360" alt="FollowAudit">
  </picture>
</p>

<p align="center">
  A private, local-first workspace for reviewing who you follow and who follows you on Instagram and TikTok.
  <br>
  Inspect first. Protect what matters. Act only when you are ready.
</p>

<p align="center">
  <a href="https://marquezinii.github.io/follow-audit/"><strong>Open FollowAudit — copy the script</strong></a>
  ·
  <a href="https://marquezinii.github.io/follow-audit/preview.html">Live preview</a>
</p>

<p align="center">
  <a href="https://marquezinii.github.io/follow-audit/">English</a> ·
  <a href="https://marquezinii.github.io/follow-audit/pt-br/">Português</a> ·
  <a href="https://marquezinii.github.io/follow-audit/es/">Español</a> ·
  <a href="https://marquezinii.github.io/follow-audit/fr/">Français</a> ·
  <a href="https://marquezinii.github.io/follow-audit/de/">Deutsch</a>
</p>

<p align="center">
  <a href="https://github.com/marquezinii/follow-audit/actions/workflows/ci.yml"><img alt="Quality" src="https://github.com/marquezinii/follow-audit/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-0a5cff.svg"></a>
  <img alt="Zero runtime dependencies" src="https://img.shields.io/badge/runtime_dependencies-0-12c7b4.svg">
</p>

<p align="center">
  <img src="public/screenshots/panel-report-light.png" width="300" alt="FollowAudit side panel showing the account report">
  <img src="public/screenshots/panel-list-dark.png" width="300" alt="FollowAudit list of accounts that don't follow back, in dark mode">
</p>

---

FollowAudit runs entirely inside your browser. On Instagram it scans both sides of your connections and offers an explicit, rate-aware review flow for account actions. On TikTok it reads the follower and following JSON files from your official data export, compares them locally, and keeps all account changes manual.

No account data is sent to a project server. Session credentials are read only when a request needs them and are never stored.

> [!CAUTION]
> Instagram support relies on private web endpoints. They can change without notice, and high-volume account actions may trigger platform limits. TikTok support is read-only and uses only files you explicitly select. This project is not affiliated with or endorsed by Instagram, Meta, TikTok, or ByteDance.

## Features

| Capability | Behavior |
| --- | --- |
| One two-sided audit | A single audit loads Following and Followers once each, page by page, deduplicates, and matches every relationship locally. |
| Report-first side panel | Docks to the right of Instagram or TikTok and opens as an account report: both counts on one axis, mutuals, and ranked segments that open their lists. |
| Who unfollowed you | Each followers audit is compared with the previous snapshot stored in this browser and lists the accounts that left. |
| Follower history | One point per audit: a chart of your follower count over time and, per audit, who arrived and who left. |
| Focused segments | Don’t follow you back, you don’t follow back, unfollowed you, protected, everyone you follow, everyone who follows you, and follow requests you sent — with instant search and filters (verified, private, no profile photo). |
| Fast selection | Shift+click ranges, “select the first N”, select visible, and keyboard shortcuts (<kbd>/</kbd> search, <kbd>J</kbd>/<kbd>K</kbd> move, <kbd>X</kbd> select, <kbd>A</kbd> select visible, <kbd>P</kbd> protect, <kbd>?</kbd> help, <kbd>Esc</kbd> back). Hovering an account shows a larger preview beside the panel, built from data already loaded. |
| Protected accounts | Stored locally and permanently excluded from action queues. Export and import the list as a JSON backup. |
| Safe action queue | Instagram unfollows, follower removals, follow-backs and request cancellations run one at a time after confirmation, with a no-op pre-check, varied pauses, a rolling hourly cap, a time-left estimate, and an automatic stop on rate limits, refusals, or repeated failures. |
| Resume and undo | A confirmed queue is saved, so it can be resumed after it pauses itself or the tab closes. The activity log lists every action, and unfollows can be undone by following again. |
| Sent follow requests | Import `pending_follow_requests.json` from Instagram’s data download and withdraw the requests you no longer want. |
| TikTok, read-only | Imports the official `Follower.json` / `Following.json` export and offers a guided, one-profile-at-a-time manual review. |
| Minimize | Collapse the panel into a small pill and keep browsing while an audit or queue runs. |
| Portable results | Exports the current view as spreadsheet-safe CSV, Excel (`.xlsx`) or JSON. |
| Compact list | A denser list for long reviews, remembered in this browser. |
| Five languages | English, Português, Español, Français, Deutsch, plus light and dark themes. |

## FAQ

### How do I see who doesn't follow me back on Instagram?

Copy the script from the [website](https://marquezinii.github.io/follow-audit/), open instagram.com on a computer while logged in, paste it into the browser console and press <kbd>Enter</kbd>. One audit loads who you follow and who follows you, then lists every account that doesn't follow you back. Nothing changes on your account until you confirm.

### Can I see who unfollowed me on Instagram?

Instagram doesn't show this itself. FollowAudit saves your follower list in your browser after each audit and compares the next audit against it, so the first audit has nothing to compare with and every later one lists who left and who is new.

### Does it need my password or an app?

No. It runs in the Instagram tab you already have open and uses that session. There is no app, extension, login, server or analytics.

### Does it work on TikTok?

Yes, read-only: import `Follower.json` and `Following.json` from your official TikTok data export, compare them locally and review each profile manually.

### Can I get banned for using it?

No tool can promise that, and Instagram's terms restrict automated access, so use it at your own risk. FollowAudit is built to be gentle: lists are read page by page, unfollows run one at a time with pauses, are never retried and stop as soon as Instagram pushes back.

## Safety by construction

The destructive path is intentionally slower than the review path:

- unfollow and follower-removal requests are never retried automatically;
- every run requires an explicit confirmation listing the selected accounts;
- protected accounts cannot be selected;
- the queue is sequential, cancellable, and delay-controlled, with ±30% variation, a doubled pause after a failure, and a rolling hourly cap (40 actions by default);
- before the first action, a pre-check that changes nothing (unfollowing your own account) confirms Instagram still accepts the requests; if Instagram answers with its web page instead, nothing is changed and the panel asks you to get the latest version;
- follow requests imported from an export are dropped when the account already appears in Following, so cancelling a request can never unfollow someone;
- the queue stops itself when Instagram answers with a rate limit, a challenge, or an HTTP 200 refusal body, and after three consecutive failures;
- malformed API payloads fail closed instead of reaching the interface;
- exported CSV cells are escaped against spreadsheet formula injection;
- cookies and CSRF tokens never enter storage, exports, logs, or application state.

## Quick start

1. Open the [FollowAudit website](https://marquezinii.github.io/follow-audit/) and select **Copy script**.
2. Open [Instagram](https://www.instagram.com/) or [TikTok](https://www.tiktok.com/) in a desktop browser.
3. Open Developer Tools (<kbd>F12</kbd>, or <kbd>Cmd</kbd>+<kbd>Option</kbd>+<kbd>J</kbd> on macOS), switch to **Console**, paste the script, and press <kbd>Enter</kbd>. Chrome may ask you to type `allow pasting` the first time.
4. On Instagram, choose a list and run the audit. On TikTok, import the extracted `Follower.json` and `Following.json` files from **Settings and privacy → Account → Download your data** (request JSON format).

**Without the console:** install the [userscript](https://marquezinii.github.io/follow-audit/followaudit.user.js) in Tampermonkey or Violentmonkey (it adds a small launcher button and updates itself), or download the [browser extension](https://marquezinii.github.io/follow-audit/followaudit-extension.zip) and load it unpacked in Chrome, Edge or Firefox. The extension only asks for `activeTab` and `scripting`: it can touch a page only after you click its button on that tab.

Running the script again restores a minimized panel instead of opening a second one. The bundle refuses to start outside `instagram.com` or `tiktok.com`, except on localhost where it enters preview mode; add `?platform=tiktok` to inspect the TikTok state.

## How it works

```mermaid
flowchart LR
    A{Platform} -->|Instagram| B[Authenticated paginated scan]
    A -->|TikTok| C[Official JSON export]
    B --> D[Runtime payload validation]
    C --> D
    D --> E[Local review workspace]
    D --> S[(Follower snapshot)] --> E
    E --> F{User decision}
    F -->|Protect| G[Local protected IDs]
    F -->|Export| H[CSV file]
    F -->|Instagram confirmation| I[Sequential, self-halting queue]
    F -->|TikTok| J[Guided manual profile review]
```

The interface is a Shadow DOM side panel, isolated from the platform's styles and keyboard shortcuts, that leaves the page beside it usable. The production bundle is a single ~130 KB file with no framework and zero runtime dependencies; the brand font is subset to Latin and embedded as WOFF2.

## Development

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/marquezinii/follow-audit.git
cd follow-audit
npm ci
npm run dev
```

The local server prints two URLs: the live preview (`/`) with deterministic sample data — it never contacts either platform and cannot perform real actions — and the website (`/index.html`). Set `PORT` to use another port.

### Quality gate

```bash
npm run check
```

Runs ESLint, the Node test suite (including contract tests against anonymized Instagram response fixtures), TypeScript type checking, website validation (translations, CSP hash, per-language pages, hreflang, structured data, asset references), and the production build. CI runs the same gate plus `npm audit`, verifies that the committed distributables (`public/dist.js`, the userscript and the extension zip) match the sources, and runs the Playwright end-to-end suite (`npm run test:e2e`) against the local preview.

### Project map

```text
src/
├── core.ts          # validation, pagination, queue (halting, pacing hooks, ETA), snapshots, CSV
├── actions.ts       # resumable queue, action log, pacing, history, request import, JSON export
├── xlsx.ts          # dependency-free .xlsx writer
├── version.ts       # release version and date baked into every copy
├── instagram.ts     # authenticated Instagram request boundary, pre-check and refusal detection
├── tiktok.ts        # official export parser and relationship comparison
├── storage.ts       # validated localStorage access, snapshots, protected-list backups
├── preview.ts       # deterministic sample data for local development
├── i18n.ts          # interface strings for five locales
├── main.ts          # panel controller and browser state
├── ui/              # layout template, styles, icons
└── assets/          # brand mark and subset font embedded in the bundle
tests/               # deterministic checks for the critical logic, plus Instagram contract fixtures
e2e/                 # Playwright end-to-end tests against the local preview
public/              # GitHub Pages website (English source page, five translated pages generated at build) and the distributable dist.js
assets/brand/        # source logo and mark files
scripts/             # site checks, language pages and sitemap generation, build copy, userscript and extension packaging, local static server
```

## Privacy model

| Data | Handling |
| --- | --- |
| Session cookies | Sent by the browser with same-origin requests. FollowAudit reads only your numeric user ID (`ds_user_id`) to build list URLs and key your snapshot; cookies are never persisted. |
| CSRF token | Read immediately before an action request; never exported or logged. |
| Following and follower lists | Held in memory for the current run. Selected TikTok files are never uploaded. |
| Follower snapshot | Follower IDs, usernames, and names from the last followers audit, stored in this browser's `localStorage` per account for change tracking. Clear it any time in **Settings → Clear audit history**. |
| Protected IDs | Stored only in this browser's `localStorage`; exportable as a JSON file you control. |
| Queue, activity log, history | The pending queue, the log of actions made through FollowAudit and the per-audit history (counts plus usernames that arrived or left) are stored in this browser's `localStorage` per account. **Clear audit history** also removes the log and history. |
| Sent follow requests | The selected `pending_follow_requests.json` is read locally and kept only in memory. Cancelling a request reads that profile's public page once to find its numeric ID. |
| Analytics / backend | None. |

## Known constraints

- Instagram can change its internal request contracts at any time.
- A successful HTTP response does not guarantee that the platform will allow continued high-volume activity.
- Instagram audits must run in the same browser profile as the authenticated session.
- Very large follower lists (roughly 30,000+) are not snapshotted, so change tracking is skipped for them.
- TikTok exports can lag behind recent account changes and must be requested in JSON format and extracted before import.
- Closing or reloading the tab ends the active scan; an unfinished action queue can be resumed from the report.
- Instagram's web app doesn't list follow requests you sent, so they come from its data download, which can be out of date.
- Because Instagram's content policy blocks requests to other sites, a console copy can't check for updates; it shows a notice when it is more than 45 days old. The userscript updates itself.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Changes to request handling or destructive actions must include focused tests and preserve the safety properties above. Security-sensitive reports belong in a private [GitHub Security Advisory](https://github.com/marquezinii/follow-audit/security/advisories/new); see [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE). Copyright © 2026 marquezinii. The bundled Manrope font is licensed under the [SIL Open Font License](public/fonts/OFL.txt).
