# Contributing to Follow Audit

Thank you for helping improve the project. Keep changes focused, reviewable, and safe for an application that handles authenticated Instagram requests and local TikTok exports.

## Development setup

```bash
npm ci
npm run dev
```

Node.js 22 is required. The local preview uses sample data and never contacts either platform.

## Before opening a pull request

Run the complete quality gate:

```bash
npm run check
```

Request-handling changes must cover malformed payloads, non-success responses, cancellation, timeouts, and retry boundaries where applicable. Unfollow actions must remain explicitly confirmed, cancellable, sequential, and free from automatic retries.

## Scope and style

- Prefer the browser platform and existing code over new dependencies.
- Keep Instagram access inside `src/instagram.ts`.
- Keep TikTok export parsing inside `src/tiktok.ts`; TikTok actions remain read-only.
- Keep deterministic business logic inside `src/core.ts`.
- Never commit generated experiments, credentials, session data, or real account responses.
- Do not edit `public/dist.js` manually; regenerate it with `npm run build`.

## Security

Do not include cookies, CSRF tokens, usernames from a real account, or full platform responses in commits, issues, screenshots, or test fixtures. Report sensitive findings privately as described in [SECURITY.md](SECURITY.md).
