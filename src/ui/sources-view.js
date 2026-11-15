/**
 * Data provenance UI. Every number that comes from NASA is surfaced here with
 * its archive link, date and scale note. Simulated rows are labelled honestly.
 */

import { SOURCES, SOURCE_LIST, sourceBadgeLabel } from '../data/sources.js';
import { escapeHtml } from './helpers.js';
import { icon as svgIcon } from './icons.js';

const GROUP_ORDER = ['nasa', 'simulated'];

export function sourcesMarkup({ focusId = null, compact = false } = {}) {
  const groups = new Map(GROUP_ORDER.map((key) => [key, []]));
  for (const source of SOURCE_LIST) {
    const group = source.real_data ? 'nasa' : 'simulated';
    groups.get(group).push(source);
  }
  return `
    <div class="sources-intro">
      <div class="sources-policy">
        ${svgIcon('source', 18)}
        <div>
          <strong>Every gameplay number has a provenance row.</strong>
          <p>Archived NASA data is labelled <span class="source-badge real">NASA ARCHIVE</span>.
          Values tuned only for the game are labelled <span class="source-badge sim">SIMULATED</span>.
          The game makes no network requests; links open only when you click them.</p>
        </div>
      </div>
      <div class="sources-scale">
        <strong>Scale note</strong>
        <p>Crew rates come from NASA life-support references, then are normalised into 0-100 outpost units so a short mission is readable. Radiation is mapped onto a 300-hour dose budget; it is an educational abstraction, not a clinical model.</p>
      </div>
    </div>
    <div class="sources-groups">
      <section class="sources-group">
        <div class="sources-group-title"><span class="dot real"></span>NASA ARCHIVE <span>${groups.get('nasa').length} sources</span></div>
        <div class="sources-grid">
          ${groups
            .get('nasa')
            .map((source) => sourceCard(source, focusId, compact))
            .join('')}
        </div>
      </section>
      <section class="sources-group">
        <div class="sources-group-title"><span class="dot sim"></span>SIMULATED / DERIVED <span>${groups.get('simulated').length} sources</span></div>
        <div class="sources-grid">
          ${groups
            .get('simulated')
            .map((source) => sourceCard(source, focusId, compact))
            .join('')}
        </div>
      </section>
    </div>
    <div class="sources-footer">
      <div>
        <strong>MindSpace</strong> is an independent educational game inspired by the
        NASA Space Apps Challenge “Junior Astronaut Mission Trainer”. It is not an official NASA product.
      </div>
      <div class="sources-footer-links">
        <span>${svgIcon('report', 14)} Original design: <code>docs/designs/junior-astronauta-outpost-lunar.md</code></span>
      </div>
    </div>
  `;
}

function sourceCard(source, focusId, compact) {
  const focused = focusId === source.id;
  const real = source.real_data;
  return `
    <article class="source-card ${real ? 'real' : 'sim'} ${focused ? 'focused' : ''}" id="source-${escapeHtml(source.id)}">
      <div class="source-card-head">
        <div class="source-card-title">${escapeHtml(source.label)}</div>
        <span class="source-badge ${real ? 'real' : 'sim'}">${sourceBadgeLabel(source)}</span>
      </div>
      <div class="source-card-meta">
        <span>${escapeHtml(source.short)}</span>
        ${source.event_date ? `<span>Event ${escapeHtml(source.event_date.slice(0, 10))}</span>` : ''}
        <span>Archived ${escapeHtml(source.date_archived)}</span>
      </div>
      <p class="source-card-note">${escapeHtml(compact && source.note.length > 260 ? `${source.note.slice(0, 257)}…` : source.note)}</p>
      ${source.url ? `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">Open archive ${svgIcon('arrow', 12)}</a>` : ''}
    </article>
  `;
}

export class SourcesModal {
  constructor(host, { onClose } = {}) {
    this.host = host;
    this.onClose = onClose;
    this.node = null;
  }

  open(sourceId = null) {
    this.close();
    this.node = document.createElement('div');
    this.node.className = 'modal-shell sources-modal';
    this.node.innerHTML = `
      <div class="modal-backdrop"></div>
      <section class="modal-panel sources-panel" role="dialog" aria-modal="true" aria-label="Data sources">
        <header class="modal-head">
          <div>
            <div class="modal-eyebrow">${svgIcon('source', 15)} OPEN DATA</div>
            <h2>Data Sources</h2>
            <p class="modal-sub">What is NASA data, what is simulated, and how each number is scaled.</p>
          </div>
          <button class="modal-close" aria-label="Close">${svgIcon('close', 20)}</button>
        </header>
        <div class="modal-body sources-body">
          ${sourcesMarkup({ focusId: sourceId })}
        </div>
      </section>
    `;
    this.node.querySelector('.modal-close').addEventListener('click', () => this.close());
    this.node.querySelector('.modal-backdrop').addEventListener('click', () => this.close());
    this.host.append(this.node);
    this.node.classList.add('visible');
    if (sourceId) {
      requestAnimationFrame(() => {
        const target = this.node?.querySelector(`#source-${CSS.escape(sourceId)}`);
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
    return this.node;
  }

  close() {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    this.onClose?.();
  }

  isOpen() {
    return Boolean(this.node);
  }
}

export function sourceRow(sourceId) {
  const source = SOURCES[sourceId];
  if (!source) return '';
  return `
    <span class="inline-source">
      <span class="source-badge ${source.real_data ? 'real' : 'sim'}">${sourceBadgeLabel(source)}</span>
      ${escapeHtml(source.short)}
      ${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">archive</a>` : ''}
    </span>
  `;
}
