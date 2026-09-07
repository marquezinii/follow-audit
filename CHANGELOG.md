# Changelog

All notable project changes are documented here.

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
