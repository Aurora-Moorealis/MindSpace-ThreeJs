/**
 * Developer overlay (F1): live simulation values, hidden stats, event queue,
 * preset capture and the data audit. This is the Three.js counterpart of the
 * design's debug overlay + DataAudit.
 */

import { auditData } from '../core/audit.js';
import { DEMO_PRESETS, validatePreset } from '../data/demo-states.js';
import { MACHINES } from '../data/machines.js';
import { getClockLabel } from '../data/economy.js';
import { escapeHtml } from './helpers.js';
import { icon } from './icons.js';

export class DebugOverlay {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.visible = false;
    this.timer = 0;
    this.audit = auditData();
    this.presetChecks = DEMO_PRESETS.map((preset) => ({ preset, result: validatePreset(preset) }));
    this.captureStatus = '';
  }

  toggle(sim = null, ctx = null) {
    this.visible = !this.visible;
    this.host.classList.toggle('hidden', !this.visible);
    if (this.visible) {
      if (sim) this.sim = sim;
      if (ctx) this.ctx = ctx;
      this.render();
    } else {
      this.host.innerHTML = '';
    }
    return this.visible;
  }

  update(sim, ctx, dt = 0) {
    if (!this.visible) return;
    this.timer += dt;
    if (this.timer < 0.4) return;
    this.timer = 0;
    this.sim = sim;
    this.ctx = ctx;
    this.render();
  }

  render() {
    if (!this.visible || !this.sim) return;
    const sim = this.sim;
    const state = sim.state;
    const ctx = this.ctx ?? {};
    const machines = Object.entries(MACHINES).map(([id, row]) => {
      const machine = state.machines[id];
      const view = sim.machineView(id);
      return `<tr>
        <td>${id}</td>
        <td>${machine.condition.toFixed(0)}%</td>
        <td>${machine.enabled ? 'on' : 'off'}</td>
        <td>${view?.status ?? '—'}</td>
        <td>${machine.job ? `${machine.job.type}:${machine.job.remainingTicks}` : '—'}</td>
        <td>${machine.upgrades.length}</td>
      </tr>`;
    });
    const upcoming = sim.eventsData
      .filter((row) => row.onset > state.tick)
      .slice(0, 6)
      .map((row) => `<div class="dbg-line"><span>${row.id}</span><span>+${row.onset - state.tick}h · ${row.archetype}</span></div>`)
      .join('');

    this.host.innerHTML = `
      <div class="debug-head">
        <div class="debug-title">${icon('target', 14)} DEBUG · F1</div>
        <button class="dbg-close" data-action="close">${icon('close', 14)}</button>
      </div>
      <div class="debug-scroll">
        <section>
          <div class="dbg-section">CLOCK</div>
          <div class="dbg-grid">
            <span>tick</span><strong>${state.tick} / ${sim.economy.time.missionTicks}</strong>
            <span>sol / hour</span><strong>${sim.sol} / ${getClockLabel(state.tick)}</strong>
            <span>phase</span><strong>${ctx.phase ?? '—'} · ${sim.isDay ? 'day' : 'night'} · ×${ctx.speed ?? state.speed}</strong>
            <span>presence</span><strong>${ctx.presence?.outside ? 'outside' : 'inside'}${ctx.presence?.inShelter ? ' · shelter' : ''}</strong>
            <span>storm</span><strong>${sim.getStorm()?.id ?? 'none'} · outage ${sim.isCommsOutage() ? 'yes' : 'no'}</strong>
            <span>fps</span><strong>${ctx.fps ?? '—'}</strong>
          </div>
        </section>
        <section>
          <div class="dbg-section">RESOURCES</div>
          <div class="dbg-grid">
            ${['o2', 'water', 'food', 'energy']
              .map(
                (id) =>
                  `<span>${id}</span><strong>${state.resources[id].toFixed(2)} / ${sim.getResourceCapacity(id)} (${state.lastDelta[id].toFixed(
                    2
                  )}/h)</strong>`
              )
              .join('')}
            <span>capacity</span><strong>${sim.energyCapacity} kWh</strong>
            <span>demand / solar / shed</span><strong>${state.lastPower.demand} / ${state.lastPower.solar} / ${state.lastPower.shed.join(',') || 'none'}</strong>
          </div>
        </section>
        <section>
          <div class="dbg-section">CREW</div>
          <div class="dbg-grid">
            <span>health / max</span><strong>${state.health.toFixed(1)} / ${sim.maxHealth.toFixed(1)}</strong>
            <span>dose / peak</span><strong>${state.radiation.toFixed(2)} / ${state.stats.peakDose.toFixed(2)}</strong>
            <span>suit / job</span><strong>${state.suit.toFixed(1)}${state.suitJob ? ` · ${state.suitJob.remainingTicks}h` : ''}</strong>
            <span>nutrition / hydration</span><strong>${state.nutrition.toFixed(1)} / ${state.hydration.toFixed(1)}</strong>
            <span>emergency O2</span><strong>${state.emergencyO2} h</strong>
            <span>dose rate</span><strong>${sim.getDoseRate().toFixed(3)}/h</strong>
          </div>
        </section>
        <section>
          <div class="dbg-section">HIDDEN STATS</div>
          <pre class="dbg-pre">${escapeHtml(JSON.stringify(sim.stats, null, 1))}</pre>
        </section>
        <section>
          <div class="dbg-section">MACHINES</div>
          <table class="dbg-table">
            <thead><tr><th>id</th><th>cond</th><th>on</th><th>status</th><th>job</th><th>up</th></tr></thead>
            <tbody>${machines.join('')}</tbody>
          </table>
        </section>
        <section>
          <div class="dbg-section">EVENT QUEUE</div>
          ${upcoming || '<div class="dbg-line">empty</div>'}
        </section>
        <section>
          <div class="dbg-section">DEMO PRESETS</div>
          <div class="dbg-actions">
            <button data-action="preset" data-preset="demo_mid">load mid</button>
            <button data-action="preset" data-preset="demo_final">load final</button>
            <button data-action="capture">copy current state</button>
          </div>
          ${this.captureStatus ? `<div class="dbg-note">${escapeHtml(this.captureStatus)}</div>` : ''}
          ${this.presetChecks
            .map(
              ({ preset, result }) =>
                `<div class="dbg-line"><span>${preset.id}</span><span class="${result.ok ? 'ok' : 'bad'}">${
                  result.ok ? 'PASS' : result.errors.join('; ')
                }</span></div>`
            )
            .join('')}
        </section>
        <section>
          <div class="dbg-section">DATA AUDIT ${this.audit.ok ? '<span class="ok">PASS</span>' : '<span class="bad">FAIL</span>'}</div>
          ${this.audit.errors.length ? this.audit.errors.map((e) => `<div class="dbg-line bad">${escapeHtml(e)}</div>`).join('') : '<div class="dbg-line ok">All rows valid.</div>'}
          ${this.audit.warnings.length ? this.audit.warnings.map((w) => `<div class="dbg-line warn">${escapeHtml(w)}</div>`).join('') : ''}
        </section>
      </div>
    `;
    this.host.querySelector('[data-action="close"]').addEventListener('click', () => this.toggle());
    this.host.querySelectorAll('[data-action="preset"]').forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onLoadPreset?.(button.dataset.preset));
    });
    this.host.querySelector('[data-action="capture"]').addEventListener('click', async () => {
      const preset = sim.capturePreset(`capture_${state.tick}`, ctx.player ?? null);
      const json = JSON.stringify(preset, null, 2);
      try {
        await navigator.clipboard.writeText(json);
        this.captureStatus = `Copied ${preset.id} to clipboard (${json.length} bytes).`;
      } catch {
        this.captureStatus = 'Clipboard unavailable. Preset printed to the console.';
        console.log(json);
      }
      this.render();
    });
  }
}
