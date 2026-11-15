/**
 * Non-comms menus: pause, controls, and the hub mission board.
 */

import { STRINGS } from '../data/strings.js';
import { getSource } from '../data/sources.js';
import { formatMissionTime } from '../data/economy.js';
import { escapeHtml, formatTicks, sourceBadge } from './helpers.js';
import { icon } from './icons.js';

const CONTROLS = [
  ['W A S D / Arrows', 'Move the astronaut'],
  ['Shift (hold)', 'Sprint while moving'],
  ['E', 'Interact, inspect a machine, start a scan'],
  ['1–5 / Wheel', 'Select inventory slot (Shift+Wheel zoom)'],
  ['Q', 'Drop item from selected inventory slot'],
  ['F', 'Refine selected mineral for ISRU resources'],
  ['P', 'Pause the mission clock'],
  ['Esc', 'Close a panel or open pause'],
  ['M', 'Mute / unmute sound'],
  ['F1', 'Debug overlay (development)'],
];

export function controlsMarkup() {
  return `<div class="controls-grid">${CONTROLS.map(
    ([key, label]) => `<div class="control-row"><kbd>${escapeHtml(key)}</kbd><span>${escapeHtml(label)}</span></div>`
  ).join('')}</div>
  <div class="controls-note">${icon('alert', 13)} Desktop keyboard required. The mission runs in real time; pause before stepping away.</div>`;
}

export class PauseMenu {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
  }

  open(sim, { autoPaused = false, muted = false } = {}) {
    this.close();
    const reports = sim.state.reports.length;
    const scans = sim.state.scans.length;
    this.node = document.createElement('div');
    this.node.className = 'modal-shell pause-shell';
    this.node.innerHTML = `
      <div class="modal-backdrop"></div>
      <section class="modal-panel pause-panel" role="dialog" aria-modal="true" aria-label="Pause menu">
        <header class="modal-head">
          <div>
            <div class="modal-eyebrow">${autoPaused ? 'AUTO-PAUSED' : 'MISSION PAUSED'}</div>
            <h2>${autoPaused ? 'Window lost focus' : 'Paused'}</h2>
            <p class="modal-sub">${autoPaused ? 'The clock stopped when the window lost focus.' : formatMissionTime(sim.state.tick)} · ${scans}/3 scans · ${reports}/3 reports</p>
          </div>
          <button class="modal-close" data-action="resume" aria-label="Resume">${icon('play', 18)}</button>
        </header>
        <div class="pause-actions">
          <button class="btn btn-primary" data-action="resume">${icon('play', 16)} Resume mission</button>
          <button class="btn btn-secondary" data-action="sources">${icon('source', 16)} Data sources</button>
          <button class="btn btn-ghost" data-action="sound">${icon(muted ? 'mute' : 'sound', 16)} Sound ${muted ? 'off' : 'on'}</button>
          <button class="btn btn-ghost" data-action="restart">${icon('wrench', 16)} Restart mission</button>
          <button class="btn btn-danger" data-action="menu">${icon('arrow', 16)} Abandon to menu</button>
        </div>
        <div class="pause-section">
          <div class="section-title"><span>CONTROLS</span><span>DESKTOP</span></div>
          ${controlsMarkup()}
        </div>
        <footer class="pause-foot">${STRINGS['ui.pauseSaveNote']}</footer>
      </section>
    `;
    this.host.append(this.node);
    this.node.classList.add('visible');
    this.node.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'resume') this.close(this.callbacks.onResume);
        else if (action === 'sources') this.callbacks.onSources?.();
        else if (action === 'sound') this.callbacks.onSound?.();
        else if (action === 'restart') this.callbacks.onRestart?.();
        else if (action === 'menu') this.callbacks.onMenu?.();
      });
    });
    this.node.querySelector('.modal-backdrop').addEventListener('click', () => this.close(this.callbacks.onResume));
    return this.node;
  }

  close(callback = null) {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    callback?.();
  }

  isOpen() {
    return Boolean(this.node);
  }
}

export class ControlsModal {
  constructor(host) {
    this.host = host;
    this.node = null;
  }

  open() {
    this.close();
    this.node = document.createElement('div');
    this.node.className = 'modal-shell controls-shell';
    this.node.innerHTML = `
      <div class="modal-backdrop"></div>
      <section class="modal-panel controls-panel" role="dialog" aria-modal="true" aria-label="Controls">
        <header class="modal-head">
          <div><div class="modal-eyebrow">FIELD MANUAL</div><h2>Controls</h2><p class="modal-sub">One astronaut. One outpost. Keep the numbers moving.</p></div>
          <button class="modal-close" aria-label="Close">${icon('close', 20)}</button>
        </header>
        <div class="modal-body">${controlsMarkup()}</div>
      </section>
    `;
    this.host.append(this.node);
    this.node.classList.add('visible');
    this.node.querySelector('.modal-close').addEventListener('click', () => this.close());
    this.node.querySelector('.modal-backdrop').addEventListener('click', () => this.close());
  }

  close() {
    if (this.node) {
      this.node.remove();
      this.node = null;
    }
  }

  isOpen() {
    return Boolean(this.node);
  }
}

export class MissionBoardPanel {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
    this.signature = '';
  }

  open(sim, world, { objectiveLabel = '' } = {}) {
    this.sim = sim;
    this.world = world;
    this.objectiveLabel = objectiveLabel;
    this.signature = '';
    this.render(true);
    return this.node;
  }

  close() {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    this.signature = '';
    this.callbacks.onClose?.();
  }

  isOpen() {
    return Boolean(this.node);
  }

  refresh(sim, objectiveLabel) {
    if (!this.node) return;
    this.sim = sim;
    if (objectiveLabel) this.objectiveLabel = objectiveLabel;
    const sig = [
      sim.state.scans.join(','),
      sim.state.reports.join(','),
      sim.getSubmissionRows().map((row) => row.state.status).join(','),
      sim.getForecast().map((row) => `${row.id}:${row.inTicks}`).join(','),
      sim.state.tick,
    ].join('|');
    if (sig === this.signature) return;
    this.signature = sig;
    this.render(false);
  }

  render(full = true) {
    const sim = this.sim;
    if (!sim) return;
    const scans = sim.state.scans.length;
    const reports = sim.state.reports.length;
    const contracts = sim.getSubmissionRows();
    const claimed = contracts.filter((row) => row.state.status === 'claimed').length;
    const forecast = sim.getForecast();
    const html = `
      <div class="drawer-backdrop"></div>
      <section class="drawer mission-board" role="dialog" aria-label="Mission board">
        <header class="drawer-head">
          <div>
            <div class="drawer-eyebrow">CENTRAL HUB · MISSION CONTROL INTERFACE</div>
            <h2>Mission Board</h2>
            <div class="drawer-status"><span class="status-dot"></span>${formatMissionTime(sim.state.tick)}</div>
          </div>
          <button class="modal-close" data-action="close" aria-label="Close">${icon('close', 20)}</button>
        </header>
        <div class="drawer-body">
          <div class="mission-hero">
            <div class="mission-hero-title">SCIENCE MISSION</div>
            <div class="mission-hero-body">Scan three survey sites on the lunar surface, then send three reports from the comms console. Keep the outpost alive until the reports are away.</div>
            <div class="mission-progress">
              <div><span>SCANS</span><strong>${scans}/3</strong></div>
              <div><span>REPORTS</span><strong>${reports}/3</strong></div>
              <div><span>CONTRACTS</span><strong>${claimed}/4</strong></div>
            </div>
          </div>
          <div class="drawer-section">
            <div class="section-title"><span>CURRENT OBJECTIVE</span><span>${reports >= 3 ? 'COMPLETE' : 'ACTIVE'}</span></div>
            <div class="board-objective">${icon('target', 20)}<strong>${escapeHtml(this.objectiveLabel || 'Check the HUD objective tracker')}</strong></div>
          </div>
          <div class="drawer-section">
            <div class="section-title"><span>CONTRACTS</span><span>${claimed}/4 claimed</span></div>
            <div class="board-contracts">
              ${contracts
                .map(
                  (row) => `<div class="board-contract ${row.state.status}">
                    <span class="contract-dot"></span>
                    <span>${escapeHtml(STRINGS[row.nameKey])}</span>
                    <em>${row.state.status.toUpperCase()}</em>
                  </div>`
                )
                .join('')}
            </div>
          </div>
          <div class="drawer-section">
            <div class="section-title"><span>NEXT SURFACE WINDOW</span><span>${sim.isCommsOutage() ? 'DSN OUTAGE' : 'FORECAST'}</span></div>
            ${
              sim.isCommsOutage()
                ? `<div class="board-forecast outage">${icon('alert', 18)} Forecast unavailable while the DSN is down.</div>`
                : forecast.length
                  ? `<div class="board-forecast">
                      ${icon(forecast[0].archetype === 'radiation_window' ? 'storm' : 'alert', 18)}
                      <div><strong>${escapeHtml(STRINGS[forecast[0].nameKey])}</strong><small>in ${formatTicks(forecast[0].inTicks)} · ${sourceBadge(
                        getSource(forecast[0].source)
                      )}</small></div>
                    </div>`
                  : `<div class="board-forecast">${icon('check', 18)} No scheduled events.</div>`
            }
          </div>
          <div class="drawer-section">
            <div class="section-title"><span>QUICK CONTROLS</span><span>KEYBOARD</span></div>
            ${controlsMarkup()}
          </div>
        </div>
        <footer class="drawer-foot">
          <button class="btn btn-ghost" data-action="close">Back to game</button>
          <button class="link-btn" data-action="sources">All data sources ${icon('arrow', 11)}</button>
        </footer>
      </section>
    `;
    if (full || !this.node) {
      if (this.node) this.node.remove();
      this.node = document.createElement('div');
      this.node.className = 'drawer-shell';
      this.node.innerHTML = html;
      this.host.append(this.node);
      this.node.classList.add('visible');
      this._bind();
    } else {
      this.node.innerHTML = html;
      this._bind();
    }
  }

  _bind() {
    if (!this.node) return;
    this.node.querySelectorAll('[data-action="close"]').forEach((button) => button.addEventListener('click', () => this.close()));
    this.node.querySelector('.drawer-backdrop')?.addEventListener('click', () => this.close());
    this.node.querySelector('[data-action="sources"]')?.addEventListener('click', () => this.callbacks.onSources?.());
  }
}
