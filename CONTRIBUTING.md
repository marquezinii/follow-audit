# Contributing to FollowAudit

Thank you for helping improve the project. Keep changes focused, reviewable, and safe for an application that handles authenticated Instagram requests and local TikTok exports.

## Development setup

```bash
npm ci
npm run dev
```

Node.js 22 or newer is required. `npm run dev` builds the bundle and serves:

- `http://127.0.0.1:8080/` — the live preview with deterministic sample data (add `?platform=tiktok` for the TikTok state). It never contacts either platform.
- `http://127.0.0.1:8080/index.html` — the project website.

## Before opening a pull request

```bash
npm run check
```

Then commit the regenerated `public/dist.js` if anything under `src/` changed — CI fails when it is stale.

Request-handling changes must cover malformed payloads, non-success responses, refusal bodies, cancellation, timeouts, and retry boundaries where applicable. Account actions must remain explicitly confirmed, cancellable, sequential, self-halting, and free from automatic retries.

## Where things live

- `src/core.ts` — deterministic, platform-free logic (validation, pagination, queue, snapshots, CSV). Prefer adding testable logic here.
- `src/instagram.ts` — the only place that talks to Instagram.
- `src/tiktok.ts` — TikTok export parsing; TikTok stays read-only.
- `src/storage.ts` — every `localStorage` read and write, always validated on the way back in.
- `src/main.ts` — the panel controller; `src/ui/` holds the layout, styles, and icons.
- `src/i18n.ts` and `public/site.js` — interface strings. Add every new key to all five locales; `npm run check` verifies the website translations.
- `public/index.html` has a Content-Security-Policy with a hash for its single inline script. If you change that script, `npm run check:site` prints the new hash.

## Style

- Prefer the browser platform and existing code over new dependencies. The bundle has zero runtime dependencies and should stay that way.
- Follow the brand tokens in `src/ui/styles.ts` and `public/site.css`; see `assets/brand/README.md`.
- Keep text contrast at WCAG AA (4.5:1) in both themes, keep keyboard access and visible focus, and respect `prefers-reduced-motion`.
- Never commit credentials, session data, real account responses, or real usernames. Do not edit `public/dist.js` by hand.

## Security

Report sensitive findings privately as described in [SECURITY.md](SECURITY.md).
