export type IconName =
  | 'arrow' | 'check' | 'chevron-left' | 'chevron-right' | 'close' | 'download' | 'info' | 'lock' | 'minimize' | 'moon' | 'scan'
  | 'search' | 'select' | 'settings' | 'shield' | 'shield-check' | 'sun' | 'trash' | 'upload' | 'user-minus'
  | 'activity' | 'chart' | 'external' | 'filter' | 'keyboard' | 'play' | 'undo' | 'user-plus' | 'user-x';

const paths: Record<IconName, string> = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'chevron-left': '<path d="m15 6-6 6 6 6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  minimize: '<path d="M5 19h14"/>',
  moon: '<path d="M20 15.2A8 8 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/>',
  scan: '<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M8 12h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  select: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  shield: '<path d="M12 21s7.5-3.4 7.5-9.6V5.6L12 3 4.5 5.6v5.8C4.5 17.6 12 21 12 21Z"/>',
  'shield-check': '<path d="M12 21s7.5-3.4 7.5-9.6V5.6L12 3 4.5 5.6v5.8C4.5 17.6 12 21 12 21Z"/><path d="m8.8 11.8 2.2 2.2 4.3-4.6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
  upload: '<path d="M12 20V9m0 0 4 4m-4-4-4 4M5 4h14"/>',
  'user-minus': '<circle cx="9" cy="8" r="4"/><path d="M2 20a7 7 0 0 1 14 0M16 11h6"/>',
  activity: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  chart: '<path d="M4 4v16h16"/><path d="m7 15 4-4 3 3 5-6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  'user-plus': '<circle cx="9" cy="8" r="4"/><path d="M2 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/>',
  'user-x': '<circle cx="9" cy="8" r="4"/><path d="M2 20a7 7 0 0 1 14 0M17 9l4 4M21 9l-4 4"/>',
};

/** Returns an inline, decorative SVG icon that inherits the current text color. */
export function icon(name: IconName): string {
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}
