/**
 * Full-screen narrative screens: title, intro stills, evaluation.
 */

import { STRINGS } from '../data/strings.js';
import { getSource } from '../data/sources.js';
import { escapeHtml, sourceBadge } from './helpers.js';
import { icon } from './icons.js';
import { buildEvaluation } from '../core/evaluation.js';

export class TitleScreen {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
  }

  show() {
    if (this.node) {
      this.node.classList.remove('hidden');
      return this.node;
    }
    this.node = document.createElement('div');
    this.node.className = 'screen title-screen';
    this.node.innerHTML = `
      <div class="screen-grid-overlay"></div>
      <div class="title-wrap">
        <div class="title-main">
          <div class="title-kicker"><span class="kicker-dot"></span> NASA SPACE APPS · JUNIOR ASTRONAUT MISSION TRAINER</div>
          <h1 class="game-title">MIND<span>SPACE</span></h1>
          <p class="title-tagline">Keep the lunar outpost alive. Finish the science.</p>
          <div class="title-meta">SOLO · REAL-TIME (1s = 1m) · 4 RESOURCES · 3 SURVEY SITES · NASA DATA</div>

          <div class="mission-select">
            <button class="mission-card selected" data-mission="artemis">
              <div class="mission-card-top"><span class="mission-tag">ACTIVE SITE</span><span class="mission-check">${icon('check', 13)}</span></div>
              <strong>ARTEMIS RIDGE</strong>
              <span>Outpost survival · 5 rooms · 9 machines · ISRU mining</span>
            </button>
            <button class="mission-card disabled" disabled>
              <div class="mission-card-top"><span class="mission-tag">COMING SOON</span></div>
              <strong>SHACKLETON CRATER</strong>
              <span>Permanent shadow · deep ice ops</span>
            </button>
          </div>

          <div class="title-actions">
            <button class="btn btn-primary btn-large" data-action="start">${icon('play', 18)} START MISSION</button>
            <div class="demo-actions">
              <button class="btn btn-secondary" data-action="demo-mid">${icon('storm', 15)} DEMO · MID</button>
              <button class="btn btn-secondary" data-action="demo-final">${icon('comms', 15)} DEMO · FINAL</button>
            </div>
          </div>
          <div class="title-links">
            <button class="link-btn" data-action="sources">${icon('source', 13)} DATA SOURCES</button>
            <button class="link-btn" data-action="controls">${icon('target', 13)} CONTROLS</button>
            <span class="title-version">MINDSPACE · THREE.JS</span>
          </div>
          <p class="title-disclaimer">Independent educational game inspired by the NASA Space Apps Challenge. NASA data is cited, not endorsed.</p>
        </div>

        <aside class="title-side">
          <div class="side-card side-brief">
            <div class="side-eyebrow"><span class="kicker-dot"></span> MISSION BRIEF</div>
            <p>Manage oxygen, water, food and power across five habitat rooms while surveying three lunar sites and transmitting reports.</p>
            <div class="side-stats">
              <div><strong>300</strong><span>hours</span></div>
              <div><strong>4</strong><span>resources</span></div>
              <div><strong>3</strong><span>reports</span></div>
            </div>
          </div>
          <div class="side-card side-data">
            <div class="side-eyebrow"><span class="kicker-dot"></span> ARCHIVED NASA DATA</div>
            <div class="data-line"><span>01</span> DONKI CME / SEP / GST</div>
            <div class="data-line"><span>02</span> LRO CRaTER & BVAD</div>
            <div class="data-badge">1s = 1 GAME MIN · PAUSE ANYTIME (P)</div>
          </div>
        </aside>
      </div>
      <div class="title-footer">
        <span>MINDSPACE</span>
        <span>ARTEMIS RIDGE · LUNAR SOUTH POLE</span>
        <span>DESKTOP KEYBOARD & MOUSE</span>
      </div>
    `;
    this.host.append(this.node);
    this.node.querySelector('[data-action="start"]').addEventListener('click', () => this.callbacks.onStart?.());
    this.node.querySelector('[data-action="demo-mid"]').addEventListener('click', () => this.callbacks.onDemo?.('demo_mid'));
    this.node.querySelector('[data-action="demo-final"]').addEventListener('click', () => this.callbacks.onDemo?.('demo_final'));
    this.node.querySelector('[data-action="sources"]').addEventListener('click', () => this.callbacks.onSources?.());
    this.node.querySelector('[data-action="controls"]').addEventListener('click', () => this.callbacks.onControls?.());
    return this.node;
  }

  hide() {
    this.node?.classList.add('hidden');
  }

  destroy() {
    this.node?.remove();
    this.node = null;
  }
}

export class IntroScreen {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
    this.step = 0;
    this.steps = [
      {
        kicker: 'TRANSMISSION 01 · ARRIVAL',
        title: STRINGS['intro.1.title'],
        body: STRINGS['intro.1.body'],
        meta: 'ARTEMIS RIDGE · LUNAR SOUTH POLAR REGION',
      },
      {
        kicker: 'TRANSMISSION 02 · THE OUTPOST',
        title: STRINGS['intro.2.title'],
        body: STRINGS['intro.2.body'],
        meta: '5 ROOMS · 8 MACHINES · 4 RESOURCES · 1 CREW',
      },
      {
        kicker: 'TRANSMISSION 03 · MISSION CONTROL',
        title: STRINGS['intro.3.title'],
        body: STRINGS['intro.3.body'],
        meta: 'SCAN THREE SITES · SEND THREE REPORTS · SURVIVE',
      },
    ];
  }

  show() {
    this.node?.remove();
    this.node = document.createElement('div');
    this.node.className = 'screen intro-screen';
    this.node.innerHTML = `
      <div class="intro-vignette"></div>
      <div class="intro-topbar">
        <div class="intro-live"><span class="live-dot"></span> MISSION CONTROL UPLINK</div>
        <button class="link-btn intro-skip" data-action="skip">SKIP INTRO ${icon('arrow', 12)}</button>
      </div>
      <div class="intro-content">
        <div class="intro-step" id="intro-step"></div>
      </div>
      <div class="intro-progress"><div class="intro-progress-fill" id="intro-progress"></div></div>
      <div class="intro-controls">
        <span class="intro-counter" id="intro-counter">01 / 03</span>
        <button class="btn btn-primary" data-action="next" id="intro-next">CONTINUE ${icon('arrow', 15)}</button>
      </div>
    `;
    this.host.append(this.node);
    this.node.querySelector('[data-action="next"]').addEventListener('click', () => this.callbacks.onNext?.());
    this.node.querySelector('[data-action="skip"]').addEventListener('click', () => this.callbacks.onSkip?.());
    this.showStep(0);
    return this.node;
  }

  showStep(index) {
    this.step = index;
    const step = this.steps[index];
    if (!step || !this.node) return;
    const host = this.node.querySelector('#intro-step');
    host.innerHTML = `
      <div class="intro-kicker">${escapeHtml(step.kicker)}</div>
      <h2 class="intro-title">${escapeHtml(step.title)}</h2>
      <p class="intro-body">${escapeHtml(step.body)}</p>
      <div class="intro-meta">${escapeHtml(step.meta)}</div>
    `;
    host.classList.remove('visible');
    void host.offsetWidth;
    host.classList.add('visible');
    this.node.querySelector('#intro-counter').textContent = `${String(index + 1).padStart(2, '0')} / 03`;
    const next = this.node.querySelector('#intro-next');
    next.innerHTML = index >= this.steps.length - 1 ? `BEGIN MISSION ${icon('arrow', 15)}` : `CONTINUE ${icon('arrow', 15)}`;
    this.setProgress(0);
  }

  setProgress(value) {
    const bar = this.node?.querySelector('#intro-progress');
    if (bar) bar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  }

  hide() {
    this.node?.classList.add('hidden');
  }

  destroy() {
    this.node?.remove();
    this.node = null;
  }
}

export class EvaluationScreen {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
    this.result = null;
  }

  open(sim) {
    this.result = buildEvaluation(sim);
    this.node?.remove();
    const result = this.result;
    const gradeClass = `grade-${result.grade}`;
    this.node = document.createElement('div');
    this.node.className = `screen evaluation-screen ${result.victory ? 'victory' : 'defeat'}`;
    this.node.innerHTML = `
      <div class="eval-backdrop"></div>
      <div class="eval-wrap">
        <header class="eval-head">
          <div class="eval-headline">
            <div class="eval-kicker">${result.victory ? 'MINDSPACE · DEBRIEF' : 'MINDSPACE · INCIDENT REPORT'}</div>
            <h1>${escapeHtml(result.title)}</h1>
            <p>${escapeHtml(result.subtitle)}</p>
          </div>
          <div class="eval-grade ${gradeClass}" style="--p:${result.score}%">
            <div class="grade-letter">${result.grade}</div>
            <div class="grade-score">${result.score} / 100</div>
            <div class="grade-label">PERFORMANCE</div>
          </div>
        </header>

        <div class="eval-cards">
          ${result.cards
            .map(
              (card) => `<article class="eval-card ${card.tone}">
                <div class="eval-card-icon">${icon(card.icon, 20)}</div>
                <div class="eval-card-label">${escapeHtml(card.label)}</div>
                <div class="eval-card-value">${escapeHtml(card.value)}</div>
                <div class="eval-card-detail">${escapeHtml(card.detail)}</div>
              </article>`
            )
            .join('')}
        </div>

        <div class="eval-columns">
          <section class="eval-panel">
            <div class="eval-panel-title">${icon('check', 15)} WHAT WENT WELL</div>
            <ul>${result.wentWell.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
          </section>
          <section class="eval-panel">
            <div class="eval-panel-title">${icon('wrench', 15)} WHAT TO IMPROVE</div>
            <ul>${result.improve.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
          </section>
        </div>

        <div class="eval-lower">
          <section class="eval-panel timeline-panel">
            <div class="eval-panel-title">${icon('clock', 15)} MISSION TIMELINE</div>
            <div class="timeline-list">
              ${
                result.timeline.length
                  ? result.timeline
                      .map(
                        (entry) => `<div class="timeline-row">
                          <span class="timeline-tick">T+${String(entry.tick).padStart(3, '0')}H</span>
                          <span class="timeline-icon">${icon(entry.icon, 13)}</span>
                          <span class="timeline-text">${escapeHtml(entry.text)}</span>
                        </div>`
                      )
                      .join('')
                  : '<div class="timeline-empty">No events survived the run.</div>'
              }
            </div>
          </section>
          <section class="eval-panel sources-panel-mini">
            <div class="eval-panel-title">${icon('source', 15)} NASA DATA USED IN THIS RUN</div>
            <div class="eval-sources">
              ${result.sources
                .map((id) => {
                  const source = getSource(id);
                  if (!source) return '';
                  return `<div class="eval-source-row">
                    ${sourceBadge(source, { short: true })}
                    <span>${escapeHtml(source.short)}</span>
                    ${
                      source.url
                        ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">archive ${icon('arrow', 10)}</a>`
                        : ''
                    }
                  </div>`;
                })
                .join('')}
            </div>
            <div class="eval-source-note">Numbers are scaled for a readable mission. Open the full Data Sources panel for the policy.</div>
          </section>
        </div>

        <footer class="eval-actions">
          ${
            result.victory
              ? `<button class="btn btn-primary" data-action="freeplay">${icon('play', 16)} Continue (freeplay)</button>`
              : `<button class="btn btn-primary" data-action="retry">${icon('play', 16)} Run it again</button>`
          }
          ${result.victory ? `<button class="btn btn-secondary" data-action="retry">${icon('wrench', 16)} Run it again</button>` : ''}
          <button class="btn btn-secondary" data-action="sources">${icon('source', 16)} Data sources</button>
          <button class="btn btn-ghost" data-action="menu">${icon('arrow', 16)} Main menu</button>
          <span class="eval-note">No save file. This run ends here.</span>
        </footer>
      </div>
    `;
    this.host.append(this.node);
    this.node.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'freeplay') this.callbacks.onFreeplay?.();
        else if (action === 'retry') this.callbacks.onRetry?.();
        else if (action === 'sources') this.callbacks.onSources?.();
        else if (action === 'menu') this.callbacks.onMenu?.();
      });
    });
    this.node.classList.add('visible');
    return this.node;
  }

  close() {
    this.node?.remove();
    this.node = null;
  }

  isOpen() {
    return Boolean(this.node);
  }
}
