/**
 * DOM helpers shared by the UI modules.
 */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value) {
  return `${Math.round(value)}%`;
}

export function formatDelta(value) {
  if (Math.abs(value) < 0.01) return '±0.0';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

export function formatTicks(ticks) {
  if (ticks <= 0) return 'now';
  if (ticks < 24) return `${ticks} h`;
  const sols = Math.floor(ticks / 24);
  const hours = ticks % 24;
  return hours ? `${sols} sol ${hours} h` : `${sols} sol`;
}

export function sourceBadge(source, { short = false } = {}) {
  if (!source) return '';
  const real = source.real_data;
  return `<span class="source-badge ${real ? 'real' : 'sim'}">${
    real ? (short ? 'NASA' : 'NASA ARCHIVE') : 'SIMULATED'
  }</span>`;
}

export function statRow(label, value, cls = '') {
  return `<div class="stat-row ${cls}"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value">${escapeHtml(value)}</span></div>`;
}

export function chip(text, cls = '') {
  return `<span class="chip ${cls}">${escapeHtml(text)}</span>`;
}

export function nowClock() {
  const d = new Date();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}
