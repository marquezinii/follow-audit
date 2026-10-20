# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences in equal measure (confirmed):

- **Everyday account owners** — personal Instagram/TikTok accounts, low technical confidence, who want to know who doesn't follow them back and who unfollowed them, and tidy up without risking their account.
- **Creators, small brands and social media managers** — larger accounts, recurring audits, who need search, filters, protection lists, CSV export and a predictable, rate-aware action queue.

Both arrive at the website first, copy one script, paste it into the browser console on instagram.com or tiktok.com, and work inside an overlay on top of the platform.

## Product Purpose

FollowAudit lets people review both sides of their follower relationships and act deliberately, entirely inside their own browser. Success: the user understands their follower situation within a minute of the first audit, protects the accounts that matter, and changes only what they explicitly confirm — without their account being flagged.

## Positioning

No app, extension, login, or server: a readable open-source script that runs in the user's own logged-in tab. Data never leaves the browser; the queue paces itself and stops when Instagram pushes back. TikTok support is read-only, from the official data export.

## Operating Context

- Desktop browsers only (Chrome, Edge, Firefox, Safari); the console is required, so no mobile.
- The overlay lives on top of instagram.com / tiktok.com and must coexist with the platform: the user opens profiles, keeps browsing, minimizes it while a long queue runs. The overlay is docked as a **side panel** so the platform stays visible beside it (confirmed).
- Audits can take minutes (pagination); action queues can take tens of minutes (deliberate pauses).
- The website (GitHub Pages) is the only distribution point: its job is to earn trust and get the script copied.

## Capabilities and Constraints

- Instagram: scan Following / Followers, relationship derived from the opposite list, search, views (not following back, you don't follow back, all, protected, unfollowed you), protected accounts with JSON backup, CSV export, confirmed sequential unfollow / follower removal with pacing, ETA, and automatic halt.
- TikTok: import `Follower.json` + `Following.json`, compare locally, guided one-by-one manual review. No automated TikTok actions.
- Change tracking: follower snapshot per account in `localStorage`.
- Five locales: en, pt-BR, es, fr, de. Light and dark themes.
- Single bundled file pasted into the console: zero runtime dependencies, Shadow DOM isolation, must respect the host page's CSP.
- Static site, no backend, no analytics.

## Brand Commitments

- Name is always **FollowAudit** (one word). Logo and mark in `assets/brand/` are the official artwork and replace all previous branding (user directive).
- Palette from the brand: blue `#0A5CFF` → cyan `#0AA3EC` → teal `#12C7B4` gradient, ink `#172235`, soft gray `#C3CCDD`. Manrope typeface.
- Must not feel like: a generic SaaS template, a suspicious hack/bot tool, or cold and bureaucratic (confirmed). Trust and warmth for non-technical users matter as much as density for power users.

## Evidence on Hand

- Real product screenshots generated from the live preview (`public/screenshots/`), using clearly fictional sample accounts (`src/preview.ts`, avatars in `public/avatars/`).
- Open-source repository, MIT license, CI.
- No testimonials, user counts, press, ratings, or benchmarks exist. Do not fabricate them.

## Product Principles

1. Review before action: reading is fast, changing is slow and explicit.
2. The user's data stays in the user's browser.
3. Protect relationships first: protected accounts are never touched.
4. Honest about risk: platform limits and private endpoints are disclosed plainly.
5. Readable by anyone: the script is inspectable, the interface is understandable without technical knowledge.

## Accessibility & Inclusion

WCAG 2.2 AA: 4.5:1 text contrast in both themes, full keyboard operation, visible focus, screen-reader names for icon controls, `prefers-reduced-motion` respected. Five languages with varying text lengths (German is longest).
