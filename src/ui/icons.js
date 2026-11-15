/**
 * Inline SVG icon set. All icons use currentColor so CSS can theme them.
 */

const paths = {
  oxygen: '<circle cx="12" cy="12" r="3.2"/><circle cx="6.2" cy="8" r="2.2"/><circle cx="17.8" cy="8" r="2.2"/><path d="M7.8 9.6 10.2 11M16.2 9.6 13.8 11"/>',
  water: '<path d="M12 3.2c3 4 5.2 6.5 5.2 9.2A5.2 5.2 0 0 1 12 17.6a5.2 5.2 0 0 1-5.2-5.2c0-2.7 2.2-5.2 5.2-9.2Z"/>',
  food: '<path d="M20 4C13 4 6.5 7.5 6.5 14.5c0 2.2 1.3 4 3.5 4C17 18.5 20 11 20 4Z"/><path d="M5 20c1.8-4 4.5-7 8-9"/>',
  energy: '<path d="M13 2 4.5 13.2H11l-1 8.8 9-12.2h-6.5L13 2Z"/>',
  health: '<path d="M12 20s-7.2-4.4-7.2-9.5A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.2 3.3C19.2 15.6 12 20 12 20Z"/>',
  radiation: '<circle cx="12" cy="12" r="2.2"/><path d="M12 2.8a9.2 9.2 0 0 1 5.3 1.7l-3.1 5.3M19.2 7.2a9.2 9.2 0 0 1 0 9.6l-5.3-3.1M16.8 19.2a9.2 9.2 0 0 1-9.6 0l3.1-5.3M4.8 16.8a9.2 9.2 0 0 1 0-9.6l5.3 3.1M7.2 4.8a9.2 9.2 0 0 1 4.8-2"/>',
  nutrition: '<path d="M12 8.5c0-2.6-2-4.3-4.6-4.3C4.7 4.2 3 6.4 3 9.4c0 5 4.6 10.4 6.6 10.4.7 0 1.2-.4 2.4-.4s1.7.4 2.4.4c2 0 6.6-5.4 6.6-10.4 0-3-1.7-5.2-4.4-5.2C14 4.2 12 5.9 12 8.5Z"/>',
  hydration: '<path d="M12 3.5c2.6 3.6 4.5 5.8 4.5 8.2a4.5 4.5 0 1 1-9 0c0-2.4 1.9-4.6 4.5-8.2Z"/><path d="M9.5 12.5a2.7 2.7 0 0 0 2.5 2.7"/>',
  suit: '<path d="M8 9.5a4 4 0 0 1 8 0V13a4 4 0 0 1-8 0V9.5Z"/><path d="M10 12.2h4M12 5.5V4M9.6 17.5 8 20M14.4 17.5 16 20"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.4l3.4 2"/>',
  alert: '<path d="M12 3.2 21 20H3L12 3.2Z"/><path d="M12 9v5M12 17.2v.2"/>',
  check: '<path d="m4.5 12.5 4.6 4.6L19.8 6.4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  source: '<ellipse cx="12" cy="6" rx="7.5" ry="3"/><path d="M4.5 6v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6"/><path d="M4.5 12v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
  comms: '<path d="M5 20v-8M12 20V6M19 20v-5"/><path d="M3.5 9.5 12 3l8.5 6.5"/>',
  scan: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 4"/>',
  report: '<path d="M6 2.8h8l4 4V21H6V2.8Z"/><path d="M14 2.8v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/>',
  unlock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 6.8-1.2"/>',
  wrench: '<path d="M14.2 6.2a4.2 4.2 0 0 0-5.6 5.2L3 17l4 4 5.6-5.6a4.2 4.2 0 0 0 5.2-5.6l-2.7 2.7-2.6-.7-.7-2.6 2.4-3Z"/>',
  power: '<path d="M12 2.5v8"/><path d="M6.5 6.5a7.5 7.5 0 1 0 11 0"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M8 5v14l11-7L8 5Z"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9h4l5-4v14l-5-4H4V9Z"/><path d="m16 9 5 6M21 9l-5 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  storm: '<path d="M7 15a4.5 4.5 0 1 1 2.2-8.4A5.5 5.5 0 0 1 19.5 9 3.5 3.5 0 0 1 19 16H7Z"/><path d="m13 14-3 5h4l-2 3"/>',
  sample: '<path d="M9 3h6M10 3v6l-4 9a2 2 0 0 0 1.8 3h8.4a2 2 0 0 0 1.8-3l-4-9V3"/><path d="M7 15h10"/>',
  contract: '<path d="M7 3h10v18l-5-3-5 3V3Z"/><path d="M10 8h4M10 12h4"/>',
  supply: '<path d="M3 8.5 12 4l9 4.5v7L12 20l-9-4.5v-7Z"/><path d="M3 8.5 12 13l9-4.5M12 13v7"/>',
  gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="m12 16 4-5"/><path d="M4 20h16"/>',
  pickaxe: '<path d="m14.5 5.5 4 4M4.5 19.5 15 9M11 4.5c3.5.5 6.5 3.5 8.5 8.5l-2.5-2.5-3.5-3.5L11 4.5Z"/>',
  mineral: '<path d="M12 3 4.5 8.5 7 19.5h10l2.5-11L12 3Z"/><path d="M12 3v16.5M4.5 8.5h15"/>',
  truck: '<rect x="2.5" y="7" width="12.5" height="8" rx="1.5"/><path d="M15 9h4l2.5 3v3H15V9Z"/><circle cx="6.5" cy="17" r="2"/><circle cx="11.5" cy="17" r="2"/><circle cx="18" cy="17" r="2"/>',
  github:
    '<path fill-rule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.34 1.12 2.91.86.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.2 9.2 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"/>',
};

// Brand marks are solid, so they opt out of the stroke treatment used by the
// rest of the mission-control icon set.
const filledIcons = new Set(['github']);

export function icon(name, size = 18, className = '') {
  const d = paths[name] ?? paths.target;
  const paint = filledIcons.has(name)
    ? 'fill="currentColor" stroke="none"'
    : 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint} aria-hidden="true">${d}</svg>`;
}

export function iconForResource(id) {
  return icon(id === 'o2' ? 'oxygen' : id === 'water' ? 'water' : id === 'food' ? 'food' : 'energy', 18);
}
