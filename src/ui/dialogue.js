/**
 * Mission Control dialogue box for the tutorial. The outpost clock is paused
 * while this is open; it is the only diegetic onboarding surface.
 */

import { icon } from './icons.js';
import { escapeHtml } from './helpers.js';

const PORTRAIT = `
<svg viewBox="0 0 120 120" width="76" height="76" aria-hidden="true">
  <defs>
    <linearGradient id="helmetGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef4f8"/>
      <stop offset="1" stop-color="#a9b6c3"/>
    </linearGradient>
    <linearGradient id="visorGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4de2ff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#0a3a52" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="46" fill="#0a1520" stroke="#4de2ff" stroke-opacity="0.35" stroke-width="2"/>
  <path d="M60 20c-20 0-32 14-32 34v10c0 8 6 14 14 14h36c8 0 14-6 14-14V54c0-20-12-34-32-34Z" fill="url(#helmetGrad)"/>
  <path d="M60 30c-14 0-22 10-22 24v6c0 5 4 8 9 8h26c5 0 9-3 9-8v-6c0-14-8-24-22-24Z" fill="url(#visorGrad)"/>
  <path d="M44 44c5-6 12-8 20-8" fill="none" stroke="#bff7ff" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>
  <circle cx="60" cy="88" r="5" fill="#ffb347"/>
  <rect x="38" y="94" width="44" height="4" rx="2" fill="#4de2ff" fill-opacity="0.4"/>
</svg>`;

export class DialogueBox {
  constructor(host) {
    this.host = host;
    this.node = null;
    this.lines = [];
    this.index = 0;
    this.onComplete = null;
    this.onSkip = null;
  }

  open({ lines, speaker = 'AURORA', tag = 'MISSION CONTROL', onComplete, onSkip }) {
    this.lines = lines;
    this.index = 0;
    this.onComplete = onComplete;
    this.onSkip = onSkip;
    this.node = document.createElement('div');
    this.node.className = 'dialogue-shell';
    this.node.innerHTML = `
      <div class="dialogue-box">
        <div class="dialogue-portrait">${PORTRAIT}</div>
        <div class="dialogue-main">
          <div class="dialogue-tag"><span class="live-dot"></span>${escapeHtml(tag)} · <span>${escapeHtml(speaker)}</span></div>
          <p class="dialogue-text" id="dialogue-text"></p>
          <div class="dialogue-meta">
            <div class="dialogue-dots" id="dialogue-dots"></div>
            <div class="dialogue-actions">
              <button class="link-btn" data-action="skip">SKIP TUTORIAL</button>
              <button class="btn btn-primary" data-action="next" id="dialogue-next">NEXT ${icon('arrow', 14)}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.host.append(this.node);
    this.node.querySelector('[data-action="next"]').addEventListener('click', () => this.advance());
    this.node.querySelector('[data-action="skip"]').addEventListener('click', () => this.skip());
    this.render();
    this.node.classList.add('visible');
    return this.node;
  }

  render() {
    if (!this.node) return;
    const text = this.node.querySelector('#dialogue-text');
    const dots = this.node.querySelector('#dialogue-dots');
    text.textContent = this.lines[this.index] ?? '';
    dots.innerHTML = this.lines
      .map((_, i) => `<span class="dialogue-dot ${i === this.index ? 'active' : i < this.index ? 'done' : ''}"></span>`)
      .join('');
    const next = this.node.querySelector('#dialogue-next');
    const last = this.index >= this.lines.length - 1;
    next.innerHTML = last ? `BEGIN MISSION ${icon('arrow', 14)}` : `NEXT ${icon('arrow', 14)}`;
    text.classList.remove('fade');
    void text.offsetWidth;
    text.classList.add('fade');
  }

  advance() {
    if (!this.node) return;
    if (this.index >= this.lines.length - 1) {
      this.close();
      this.onComplete?.();
      return;
    }
    this.index += 1;
    this.render();
  }

  skip() {
    if (!this.node) return;
    this.close();
    this.onSkip?.();
  }

  close() {
    if (!this.node) return;
    this.node.classList.add('leaving');
    const node = this.node;
    this.node = null;
    setTimeout(() => node.remove(), 240);
  }

  isOpen() {
    return Boolean(this.node);
  }
}
