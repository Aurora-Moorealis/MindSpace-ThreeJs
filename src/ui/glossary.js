/**
 * Glossary modal. A plain-language dictionary of the mission vocabulary.
 * Related terms stay inside the modal so a player can follow an idea without
 * leaving the current screen.
 */

import { GLOSSARY } from '../data/glossary.js';
import { STRINGS } from '../data/strings.js';
import { escapeHtml } from './helpers.js';
import { icon } from './icons.js';

function termLabel(id) {
  return escapeHtml(STRINGS[`glossary.${id}.term`] ?? id);
}

function relatedMarkup(entry) {
  if (!entry.related.length) return '';
  return `<div class="glossary-related"><span>${escapeHtml(STRINGS['glossary.seeAlso'])}</span>${entry.related
    .map(
      (id) =>
        `<button class="link-btn" data-glossary-term="${escapeHtml(id)}">${termLabel(id)}</button>`
    )
    .join('')}</div>`;
}

export function glossaryMarkup() {
  return `<div class="glossary-list">
    ${GLOSSARY.map(
      (entry) => `<article class="glossary-entry" id="glossary-${escapeHtml(entry.id)}">
        <h3>${termLabel(entry.id)}</h3>
        <p>${escapeHtml(STRINGS[entry.definitionKey] ?? '')}</p>
        ${relatedMarkup(entry)}
      </article>`
    ).join('')}
  </div>`;
}

export class GlossaryModal {
  constructor(host, { onClose } = {}) {
    this.host = host;
    this.onClose = onClose;
    this.node = null;
  }

  open(termId = null) {
    this.close();
    this.node = document.createElement('div');
    this.node.className = 'modal-shell glossary-shell';
    this.node.innerHTML = `
      <div class="modal-backdrop"></div>
      <section class="modal-panel glossary-panel" role="dialog" aria-modal="true" aria-label="${escapeHtml(
        STRINGS['glossary.title']
      )}">
        <header class="modal-head">
          <div>
            <div class="modal-eyebrow">${icon('source', 15)} FIELD TERMS</div>
            <h2>${escapeHtml(STRINGS['glossary.title'])}</h2>
            <p class="modal-sub">${escapeHtml(STRINGS['glossary.subtitle'])}</p>
            <p class="glossary-note">${escapeHtml(STRINGS['time.modelNote'])}</p>
            <p class="glossary-note">${escapeHtml(STRINGS['time.compressionNote'])}</p>
          </div>
          <button class="modal-close" data-action="close" aria-label="${escapeHtml(
            STRINGS['glossary.close']
          )}">${icon('close', 20)}</button>
        </header>
        <div class="modal-body glossary-body">
          ${glossaryMarkup()}
        </div>
      </section>
    `;
    this.node.querySelector('[data-action="close"]').addEventListener('click', () => this.close());
    this.node.querySelector('.modal-backdrop').addEventListener('click', () => this.close());
    this.node.querySelectorAll('[data-glossary-term]').forEach((button) => {
      button.addEventListener('click', () => this.focus(button.dataset.glossaryTerm));
    });
    this.host.append(this.node);
    this.node.classList.add('visible');
    if (termId) this.focus(termId);
    return this.node;
  }

  focus(termId) {
    if (!this.node || !termId) return;
    const target = this.node.querySelector(`#glossary-${CSS.escape(termId)}`);
    if (!target) return;
    this.node.querySelectorAll('.glossary-entry.focused').forEach((entry) => entry.classList.remove('focused'));
    target.classList.add('focused');
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => {
      if (!this.node) return;
      target.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    });
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
