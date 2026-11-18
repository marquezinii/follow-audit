/** Release identity baked into every copy of the script. Keep VERSION in sync with package.json (a test enforces it). */
export const VERSION = '3.1.0';
/** Release date (UTC). Copies older than STALE_AFTER_DAYS suggest getting the latest version. */
export const RELEASED = '2026-11-18';
export const STALE_AFTER_DAYS = 45;
export const WEBSITE_URL = 'https://marquezinii.github.io/follow-audit/';

export function isStale(now: Date, released = RELEASED): boolean {
  return now.getTime() - Date.parse(`${released}T00:00:00Z`) > STALE_AFTER_DAYS * 86_400_000;
}
