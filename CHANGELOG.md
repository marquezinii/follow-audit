# Changelog

All notable project changes are documented here.

## 3.0.0 — 2026-10-20

### Added

- New FollowAudit visual identity across the script, website, icons, social preview, and documentation.
- “Who unfollowed you”: each followers audit is compared with the previous local snapshot, with a dedicated view.
- Protected-list backup: export and import protected accounts as JSON.
- Minimize the panel into a floating pill and keep browsing while it works.
- One audit now loads Following and Followers together, once each, instead of re-downloading the opposite list for every scan.
- Time-left estimate while the action queue runs.
- Keyboard shortcut <kbd>/</kbd> to focus search; keystrokes no longer leak into the platform's shortcuts.
- Read-only TikTok audits from the official follower and following JSON export files, with automatic Instagram or TikTok mode selection.
- Website FAQ, feature overview, real product screenshots, Content-Security-Policy, and Open Graph image.
- Issue and pull-request templates, Dependabot, EditorConfig, and a CI check that `public/dist.js` matches the sources.

### Changed

- Rebuilt the interface as a side panel docked beside Instagram or TikTok that opens as an account report (both counts on a versus axis, ranked segments, then lists), with WCAG AA contrast in light and dark themes.
- Rebuilt the website around a versus layout that demonstrates the Following ↔ Followers matching, with real panel screenshots, a how-to-run guide, and an FAQ.
- Split the interface into focused modules (`ui/`, `storage.ts`, `preview.ts`).
- Embedded a Latin-subset WOFF2 font, shrinking the bundle from about 310 KB to about 130 KB.
- Large lists render in pages of 200 rows; progress no longer rebuilds the whole table.
- When the opposite list was already loaded in the session, Instagram scans reuse it instead of downloading it again.
- Updated development dependencies and resolved the reported `brace-expansion` advisory.

### Fixed

- The action queue now stops on rate limits (HTTP 429), session or challenge errors, HTTP 200 refusal bodies, and after three consecutive failures, instead of continuing to hit Instagram.
- Progress shows an indeterminate state instead of a misleading percentage when Instagram does not report a total.
- CSV downloads no longer revoke the file URL before the browser starts the download.
- Missing or expired profile pictures fall back to a neutral avatar.
- Running the script twice restores the existing panel instead of doing nothing.
- Followers removed through FollowAudit are no longer reported as having unfollowed you.
- An HTTP 200 web page (login or checkpoint) after an action now counts as a refusal instead of a success.
- Protection cannot change while a queue runs, and protected accounts are re-checked right before every action.
- "Select visible" selects only rows actually shown on screen.
- Copying the script now works in Safari, which requires the clipboard write inside the click.

## 2.1.0 — 2026-09-07

### Added

- Follower audits and explicitly confirmed follower removal alongside the existing following workflow.
- Independent review state for Following and Followers.

### Fixed

- Anchored hidden checkboxes to their rows so selecting the last account cannot scroll the overlay out of view.
- Bypassed stale browser and CDN caches when copying or previewing the distributable bundle.
- Stopped repeated pagination cursors before they can generate unnecessary Instagram requests.
- Cleared protected accounts from both action selections and recovered safely from unavailable local storage.

### Changed

- Moved live announcements from the account table to the concise audit status message.

## 2.0.0 — 2026-09-06

### Added

- Local-first review workspace mounted in Shadow DOM.
- Paginated following audit with payload validation and bounded read retries.
- Search, relationship views, protected accounts, CSV export, and local preview data.
- Explicitly confirmed, sequential, cancellable unfollow queue.
- Automated linting, tests, type checking, dependency audit, and production builds.

### Changed

- Rebuilt the application around browser-native APIs and zero runtime dependencies.
- Consolidated the codebase into three focused TypeScript modules.
- Reworked the project website, documentation, visual identity, and contributor guidance.
