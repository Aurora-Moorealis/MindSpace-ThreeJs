/**
 * Heads-up display. Built once, then updated in place. The HUD is pointer-events
 * none except for its controls, so the 3D scene never fights for clicks.
 */

import { STRINGS } from '../data/strings.js';
import { getSource } from '../data/sources.js';
import { ECONOMY, getClockLabel, formatMissionTime } from '../data/economy.js';
import {
  clamp,
  escapeHtml,
  formatDelta,
  formatTicks,
  sourceBadge,
} from './helpers.js';
import { icon as svgIcon, iconForResource } from './icons.js';

const RESOURCE_SOURCES = {
  o2: 'bvad',
  water: 'bvad',
  food: 'bvad',
  energy: 'ogs',
};

function deltaClass(value) {
  if (value > 0.01) return 'positive';
  if (value < -0.01) return 'negative';
  return 'neutral';
}

export class HUD {
  constructor(root, callbacks = {}) {
    this.root = root;
    this.callbacks = callbacks;
    this.contractsSignature = '';
    this.forecastSignature = '';
    this.promptSignature = '';
    this.soundMuted = false;
    this._build();
  }

  _build() {
    this.root.innerHTML = `
      <div class="hud-scanlines" aria-hidden="true"></div>
      <header class="hud-top">
        <div class="hud-brand">
          <div class="brand-mark">OL</div>
          <div class="brand-copy">
            <div class="brand-title">OUTPOST LUNAR</div>
            <div class="brand-sub">ARTEMIS RIDGE · JUNIOR ASTRONAUT MISSION</div>
          </div>
        </div>
        <div class="hud-clock" title="One tick is one game hour. At ×1 a tick takes 60 real seconds.">
          <div class="clock-main"><span id="hud-sol">SOL 1</span><span id="hud-time">06:00</span></div>
          <div class="clock-sub"><span id="hud-phase">DAYLIGHT</span><span id="hud-tick">T+000H</span></div>
        </div>
        <div class="hud-actions">
          <div class="speed-group" role="group" aria-label="Time speed">
            <button class="speed-btn" data-speed="1" title="×1 — 60 s per game hour">×1</button>
            <button class="speed-btn" data-speed="5" title="×5 — 12 s per game hour">×5</button>
            <button class="speed-btn" data-speed="10" title="×10 — 6 s per game hour">×10</button>
          </div>
          <button class="icon-btn" data-action="pause" title="Pause (P)">${svgIcon('pause', 18)}</button>
          <button class="icon-btn" data-action="sound" title="Mute / unmute (M)">${svgIcon('sound', 18)}</button>
          <button class="icon-btn" data-action="menu" title="Pause menu (Esc)">${svgIcon('menu', 18)}</button>
        </div>
        <div class="demo-badge hidden" id="hud-demo">DEMO STATE · ×10</div>
      </header>

      <aside class="hud-left">
        <section class="panel resource-panel">
          <div class="panel-heading"><span>LIFE SUPPORT</span><span class="panel-hint">PER HOUR</span></div>
          <div id="hud-resources"></div>
        </section>
        <section class="panel vitals-panel">
          <div class="panel-heading"><span>CREW & SUIT</span><span class="panel-hint" id="hud-maxhp">MAX HP 100</span></div>
          <div class="vital-row" data-vital="health">
            <div class="vital-label">${svgIcon('health', 15)} HEALTH</div>
            <div class="vital-track"><div class="vital-fill health"></div><div class="vital-cap"></div></div>
            <div class="vital-value" data-value="health">100</div>
          </div>
          <div class="vital-row" data-vital="radiation">
            <div class="vital-label">${svgIcon('radiation', 15)} DOSE</div>
            <div class="vital-track"><div class="vital-fill radiation"></div><div class="vital-threshold" title="30: maximum health starts to drop"></div></div>
            <div class="vital-value" data-value="radiation">2.0</div>
          </div>
          <div class="vital-mini-grid">
            <div class="mini-vital" data-mini="nutrition">
              <span class="mini-label">${svgIcon('nutrition', 13)} NUTRITION</span>
              <span class="mini-value" data-value="nutrition">88%</span>
              <div class="mini-track"><div class="mini-fill"></div></div>
            </div>
            <div class="mini-vital" data-mini="hydration">
              <span class="mini-label">${svgIcon('hydration', 13)} HYDRATION</span>
              <span class="mini-value" data-value="hydration">88%</span>
              <div class="mini-track"><div class="mini-fill"></div></div>
            </div>
            <div class="mini-vital" data-mini="suit">
              <span class="mini-label">${svgIcon('suit', 13)} SUIT</span>
              <span class="mini-value" data-value="suit">100%</span>
              <div class="mini-track"><div class="mini-fill"></div></div>
            </div>
          </div>
          <div class="dose-rate"><span id="hud-doserate">+0.00 / h</span><span id="hud-zonerad">HABITAT SHIELDED</span></div>
        </section>
      </aside>

      <aside class="hud-right">
        <section class="panel objective-panel">
          <div class="panel-heading"><span>${svgIcon('target', 14)} PRIMARY MISSION</span><span class="panel-hint" id="hud-mission-time">SOL 1</span></div>
          <div class="objective-title" id="hud-objective-title">Scan three survey sites</div>
          <div class="mission-pips" id="hud-pips"></div>
          <div class="objective-target" id="hud-objective-target">
            <span class="target-arrow">${svgIcon('arrow', 14)}</span>
            <span id="hud-target-text">Next: Site A</span>
            <span class="target-distance" id="hud-target-distance"></span>
          </div>
        </section>

        <section class="panel contracts-panel">
          <div class="panel-heading"><span>${svgIcon('contract', 14)} CONTRACTS</span><span class="panel-hint" id="hud-contract-count">0/4</span></div>
          <div id="hud-contracts"></div>
        </section>

        <section class="panel forecast-panel">
          <div class="panel-heading"><span>${svgIcon('storm', 14)} SURFACE FORECAST</span><span class="panel-hint" id="hud-forecast-state">DSN</span></div>
          <div id="hud-forecast"></div>
        </section>
      </aside>

      <div class="zone-badge" id="hud-zone">${svgIcon('target', 14)} <span>HABITAT</span></div>
      <div class="hud-bottom">
        <div class="interaction-prompt hidden" id="hud-prompt">
          <span class="keycap" id="hud-key">E</span>
          <span class="prompt-text" id="hud-prompt-text"></span>
          <span class="prompt-hint" id="hud-prompt-hint"></span>
        </div>
        <div class="scan-hud hidden" id="hud-scan">
          <div class="scan-label"><span id="hud-scan-label">SCANNING</span><span id="hud-scan-pct">0%</span></div>
          <div class="scan-track"><div class="scan-fill" id="hud-scan-fill"></div></div>
          <div class="scan-hint">Stay still. Moving cancels the scan.</div>
        </div>
      </div>

      <div class="storm-strip hidden" id="hud-storm">
        <span class="storm-pulse"></span>
        <span class="storm-title" id="hud-storm-title">RADIATION WINDOW</span>
        <span class="storm-detail" id="hud-storm-detail"></span>
        <span class="storm-action" id="hud-storm-action"></span>
      </div>
    `;

    // Resource rows are static; update in place.
    const resHost = this.root.querySelector('#hud-resources');
    resHost.innerHTML = ['o2', 'water', 'food', 'energy']
      .map(
        (id) => `
        <div class="res-row" data-res="${id}">
          <div class="res-icon">${iconForResource(id)}</div>
          <div class="res-body">
            <div class="res-line">
              <span class="res-name">${STRINGS[`resource.${id}`].toUpperCase()}</span>
              <span class="res-value"><span data-res-value>0</span><small>%</small></span>
            </div>
            <div class="res-track"><div class="res-fill"></div></div>
            <div class="res-meta">
              <span class="res-delta" data-res-delta>±0.0</span>
              <span class="res-cap" data-res-cap>0 / 100</span>
            </div>
          </div>
          <button class="src-btn" data-source="${RESOURCE_SOURCES[id]}" title="Data source">i</button>
        </div>`
      )
      .join('');

    this.refs = {
      resources: Object.fromEntries(
        ['o2', 'water', 'food', 'energy'].map((id) => {
          const row = this.root.querySelector(`[data-res="${id}"]`);
          return [
            id,
            {
              row,
              fill: row.querySelector('.res-fill'),
              value: row.querySelector('[data-res-value]'),
              cap: row.querySelector('[data-res-cap]'),
              delta: row.querySelector('[data-res-delta]'),
            },
          ];
        })
      ),
      healthVal: this.root.querySelector('[data-value="health"]'),
      healthFill: this.root.querySelector('[data-vital="health"] .vital-fill'),
      healthCap: this.root.querySelector('[data-vital="health"] .vital-cap'),
      radVal: this.root.querySelector('[data-value="radiation"]'),
      radFill: this.root.querySelector('[data-vital="radiation"] .vital-fill'),
      minis: Object.fromEntries(
        ['nutrition', 'hydration', 'suit'].map((id) => {
          const node = this.root.querySelector(`[data-mini="${id}"]`);
          return [
            id,
            {
              value: node.querySelector('[data-value]'),
              fill: node.querySelector('.mini-fill'),
            },
          ];
        })
      ),
      speedBtns: Array.from(this.root.querySelectorAll('.speed-btn')),
      sol: this.root.querySelector('#hud-sol'),
      time: this.root.querySelector('#hud-time'),
      phase: this.root.querySelector('#hud-phase'),
      tick: this.root.querySelector('#hud-tick'),
      maxhp: this.root.querySelector('#hud-maxhp'),
      doserate: this.root.querySelector('#hud-doserate'),
      zonerad: this.root.querySelector('#hud-zonerad'),
      objectiveTitle: this.root.querySelector('#hud-objective-title'),
      pips: this.root.querySelector('#hud-pips'),
      targetText: this.root.querySelector('#hud-target-text'),
      targetDistance: this.root.querySelector('#hud-target-distance'),
      missionTime: this.root.querySelector('#hud-mission-time'),
      contracts: this.root.querySelector('#hud-contracts'),
      contractCount: this.root.querySelector('#hud-contract-count'),
      forecast: this.root.querySelector('#hud-forecast'),
      forecastState: this.root.querySelector('#hud-forecast-state'),
      zone: this.root.querySelector('#hud-zone'),
      prompt: this.root.querySelector('#hud-prompt'),
      key: this.root.querySelector('#hud-key'),
      promptText: this.root.querySelector('#hud-prompt-text'),
      promptHint: this.root.querySelector('#hud-prompt-hint'),
      scan: this.root.querySelector('#hud-scan'),
      scanLabel: this.root.querySelector('#hud-scan-label'),
      scanPct: this.root.querySelector('#hud-scan-pct'),
      scanFill: this.root.querySelector('#hud-scan-fill'),
      storm: this.root.querySelector('#hud-storm'),
      stormTitle: this.root.querySelector('#hud-storm-title'),
      stormDetail: this.root.querySelector('#hud-storm-detail'),
      stormAction: this.root.querySelector('#hud-storm-action'),
      demo: this.root.querySelector('#hud-demo'),
      sound: this.root.querySelector('[data-action="sound"]'),
    };

    this.refs.speedBtns.forEach((button) => {
      button.addEventListener('click', () => this.callbacks.onSpeed?.(Number(button.dataset.speed)));
    });
    this.root.querySelector('[data-action="pause"]').addEventListener('click', () => this.callbacks.onPause?.());
    this.root.querySelector('[data-action="menu"]').addEventListener('click', () => this.callbacks.onMenu?.());
    this.refs.sound.addEventListener('click', () => this.callbacks.onSound?.());
    this.root.querySelectorAll('.src-btn').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSource?.(button.dataset.source);
      });
    });
  }

  setSoundMuted(muted) {
    this.soundMuted = muted;
    this.refs.sound.innerHTML = muted ? svgIcon('mute', 18) : svgIcon('sound', 18);
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  updateScan(scan) {
    if (scan) {
      this.refs.scan.classList.remove('hidden');
      this.refs.scanLabel.textContent = scan.label;
      this.refs.scanPct.textContent = `${Math.round(scan.progress * 100)}%`;
      this.refs.scanFill.style.width = `${clamp(scan.progress * 100, 0, 100)}%`;
    } else {
      this.refs.scan.classList.add('hidden');
    }
  }

  update(sim, ctx) {
    const state = sim.state;
    const resources = state.resources;
    for (const id of ['o2', 'water', 'food', 'energy']) {
      const refs = this.refs.resources[id];
      const value = resources[id];
      const cap = sim.getResourceCapacity(id);
      const pct = cap > 0 ? (value / cap) * 100 : 0;
      const cfg = ECONOMY.resources[id];
      refs.fill.style.width = `${clamp(pct, 0, 100)}%`;
      refs.fill.classList.toggle('critical', pct <= cfg.critical);
      refs.fill.classList.toggle('warning', pct > cfg.critical && pct <= cfg.warning);
      refs.value.textContent = Math.round(pct);
      const o2Emergency = id === 'o2' && value <= 0;
      refs.row.classList.toggle('emergency', o2Emergency);
      if (o2Emergency) {
        refs.cap.textContent = `SUIT RESERVE ${state.emergencyO2} h`;
        refs.cap.classList.add('danger');
      } else if (id === 'energy' && state.lastPower.shed.length) {
        const shedShort = { lights: 'LIGHTS', hydroponics: 'HYDRO', water_recycler: 'RECYCLER', o2_system: 'O2' };
        refs.cap.textContent = `SHED: ${state.lastPower.shed.map((key) => shedShort[key] ?? key).join(' ')}`;
        refs.cap.classList.add('danger');
      } else {
        refs.cap.textContent = `${Math.round(value)} / ${Math.round(cap)}`;
        refs.cap.classList.remove('danger');
      }
      const delta = state.lastDelta[id] ?? 0;
      const deltaPct = cap > 0 ? (delta / cap) * 100 : 0;
      refs.delta.textContent = `${formatDelta(deltaPct)}/h`;
      refs.delta.className = `res-delta ${deltaClass(delta)}`;
    }

    const maxHealth = Math.round(sim.maxHealth);
    this.refs.healthVal.textContent = Math.round(state.health);
    this.refs.healthFill.style.width = `${clamp(state.health, 0, 100)}%`;
    this.refs.healthFill.classList.toggle('critical', state.health < 30);
    this.refs.healthCap.style.left = `${clamp(maxHealth, 0, 100)}%`;
    this.refs.healthCap.classList.toggle('hidden', maxHealth >= 99);
    this.refs.maxhp.textContent = `MAX HP ${maxHealth}`;
    this.refs.radVal.textContent = state.radiation.toFixed(1);
    this.refs.radFill.style.width = `${clamp(state.radiation, 0, 100)}%`;
    this.refs.radFill.classList.toggle('critical', state.radiation >= 70);
    this.refs.radFill.classList.toggle('warning', state.radiation >= 30 && state.radiation < 70);

    const minis = {
      nutrition: state.nutrition,
      hydration: state.hydration,
      suit: state.suit,
    };
    for (const [id, value] of Object.entries(minis)) {
      const refs = this.refs.minis[id];
      refs.value.textContent = `${Math.round(value)}%`;
      refs.fill.style.width = `${clamp(value, 0, 100)}%`;
      refs.fill.classList.toggle('critical', value < 25);
      refs.fill.classList.toggle('warning', value >= 25 && value < 45);
    }

    this.refs.sol.textContent = `SOL ${sim.sol}`;
    this.refs.time.textContent = getClockLabel(state.tick);
    this.refs.phase.textContent = sim.isDay ? 'DAYLIGHT' : 'LUNAR NIGHT';
    this.refs.phase.classList.toggle('night', !sim.isDay);
    this.refs.tick.textContent = `T+${String(state.tick).padStart(3, '0')}H`;
    const doseRate = sim.getDoseRate();
    this.refs.doserate.textContent = `${doseRate > 0 ? '+' : ''}${doseRate.toFixed(2)} / h`;
    this.refs.doserate.classList.toggle('danger', doseRate > 1);
    this.refs.zonerad.textContent =
      ctx.presence?.inShelter && state.shelterLocked
        ? 'SHELTER SHIELDED'
        : ctx.presence?.outside
          ? 'EVA — UNPROTECTED'
          : sim.getStorm()
            ? 'HABITAT LEAKAGE'
            : 'HABITAT SHIELDED';
    this.refs.zonerad.classList.toggle('danger', ctx.presence?.outside || Boolean(sim.getStorm()));

    // Speed buttons.
    this.refs.speedBtns.forEach((button) => {
      button.classList.toggle('active', Number(button.dataset.speed) === ctx.speed);
    });

    // Mission objective.
    const scans = state.scans.length;
    const reports = state.reports.length;
    let title = 'Scan three survey sites';
    if (reports >= 3) title = 'Primary mission complete';
    else if (scans >= 3) title = 'Send the reports from comms';
    else if (reports > 0 || state.samples.length > 0) title = 'Deliver the sample to comms';
    else if (scans > 0) title = 'Continue the surface survey';
    this.refs.objectiveTitle.textContent = title;
    this.refs.missionTime.textContent = formatMissionTime(state.tick);
    const pipsSignature = `${scans}|${reports}`;
    if (pipsSignature !== this.pipsSignature) {
      this.pipsSignature = pipsSignature;
      this.refs.pips.innerHTML = `
        <div class="pip-row"><span class="pip-label">SCANS</span>${[0, 1, 2]
          .map((i) => `<span class="pip ${i < scans ? 'done' : ''}">${i < scans ? svgIcon('check', 10) : i + 1}</span>`)
          .join('')}</div>
        <div class="pip-row"><span class="pip-label">REPORTS</span>${[0, 1, 2]
          .map((i) => `<span class="pip ${i < reports ? 'done' : ''}">${i < reports ? svgIcon('check', 10) : i + 1}</span>`)
          .join('')}</div>
      `;
    }
    if (ctx.objective) {
      this.refs.targetText.textContent = ctx.objective.label;
      this.refs.targetDistance.textContent =
        ctx.objective.distance != null ? `${Math.round(ctx.objective.distance)} m` : '';
    } else {
      this.refs.targetText.textContent = reports >= 3 ? 'Evaluation pending…' : 'Find the next objective';
      this.refs.targetDistance.textContent = '';
    }

    // Contracts.
    const subs = sim.getSubmissionRows();
    const claimed = subs.filter((row) => row.state.status === 'claimed').length;
    const ready = subs.filter((row) => row.state.status === 'ready').length;
    const contractSignature = `${claimed}|${ready}|${subs.map((row) => row.state.status).join(',')}`;
    if (contractSignature !== this.contractsSignature) {
      this.contractsSignature = contractSignature;
      this.refs.contractCount.textContent = `${claimed}/4`;
      this.refs.contracts.innerHTML = subs
        .map((row) => {
          const status = row.state.status;
          const statusLabel =
            status === 'claimed'
              ? 'DONE'
              : status === 'ready'
                ? 'CLAIM'
                : status === 'missed'
                  ? 'MISSED'
                  : 'ACTIVE';
          return `<div class="contract-row ${status}">
            <span class="contract-dot"></span>
            <span class="contract-name">${escapeHtml(STRINGS[row.nameKey])}</span>
            <span class="contract-state">${statusLabel}</span>
          </div>`;
        })
        .join('');
    }

    // Forecast.
    const outage = sim.isCommsOutage();
    const forecast = sim.getForecast();
    const active = sim.activeEvents();
    const forecastSignature = [
      outage,
      active.map((e) => `${e.id}:${e.remaining}`).join(','),
      forecast.map((e) => `${e.id}:${e.inTicks}`).join(','),
    ].join('|');
    if (forecastSignature !== this.forecastSignature) {
      this.forecastSignature = forecastSignature;
      if (outage) {
        this.refs.forecastState.textContent = 'OUTAGE';
        this.refs.forecastState.classList.add('danger');
        this.refs.forecast.innerHTML = `<div class="forecast-outage">${svgIcon('alert', 16)} DSN OUTAGE<br><span>Forecast unavailable. Reports still work.</span></div>`;
      } else {
        this.refs.forecastState.textContent = 'DSN';
        this.refs.forecastState.classList.remove('danger');
        const storm = sim.getStorm();
        const rows = [];
        if (storm) {
          rows.push(`<div class="forecast-row active-storm">
            <span class="forecast-icon">${svgIcon('storm', 16)}</span>
            <span class="forecast-copy"><strong>${escapeHtml(STRINGS[storm.nameKey])}</strong><small>ACTIVE · ${storm.remaining} h left · ×${Math.max(1, storm.intensityNow).toFixed(1)}</small></span>
            ${sourceBadge(getSource(storm.source), { short: true })}
          </div>`);
        }
        for (const event of forecast.slice(0, 2)) {
          rows.push(`<div class="forecast-row ${event.archetype === 'radiation_window' ? 'storm' : ''}">
            <span class="forecast-icon">${svgIcon(event.archetype === 'radiation_window' ? 'storm' : event.archetype === 'comms_outage' ? 'comms' : 'alert', 16)}</span>
            <span class="forecast-copy"><strong>${escapeHtml(STRINGS[event.nameKey])}</strong><small>${event.inTicks > 0 ? `in ${formatTicks(event.inTicks)}` : 'now'} · ${event.archetype.replaceAll('_', ' ')}</small></span>
            ${sourceBadge(getSource(event.source), { short: true })}
          </div>`);
        }
        this.refs.forecast.innerHTML = rows.length
          ? rows.join('')
          : `<div class="forecast-empty">No scheduled events</div>`;
      }
    }

    // Zone badge.
    const zoneLabel = ctx.zone?.label ?? 'HABITAT';
    const zoneIcon = ctx.presence?.outside ? 'radiation' : ctx.presence?.inShelter && state.shelterLocked ? 'lock' : 'target';
    const zoneSignature = `${zoneIcon}|${zoneLabel}`;
    if (zoneSignature !== this.zoneSignature) {
      this.zoneSignature = zoneSignature;
      this.refs.zone.innerHTML = `${svgIcon(zoneIcon, 14)} <span>${escapeHtml(zoneLabel)}</span>`;
    }
    this.refs.zone.classList.toggle('outside', Boolean(ctx.presence?.outside));
    this.refs.zone.classList.toggle('sheltered', Boolean(ctx.presence?.inShelter && state.shelterLocked));

    // Interaction prompt.
    const interaction = ctx.interaction;
    const promptSignature = interaction
      ? `${interaction.id}|${interaction.action}|${interaction.hint}|${interaction.key}`
      : '';
    if (promptSignature !== this.promptSignature) {
      this.promptSignature = promptSignature;
      if (interaction) {
        this.refs.prompt.classList.remove('hidden');
        this.refs.key.textContent = interaction.key ?? 'E';
        this.refs.promptText.textContent = `${interaction.action} — ${interaction.name}`;
        this.refs.promptHint.textContent = interaction.hint ?? '';
      } else {
        this.refs.prompt.classList.add('hidden');
      }
    }

    // Scan/task progress.
    this.updateScan(ctx.scan);

    // Storm strip.
    const storm = sim.getStorm();
    if (storm) {
      this.refs.storm.classList.remove('hidden');
      this.refs.stormTitle.textContent = STRINGS[storm.nameKey] ?? 'RADIATION WINDOW';
      this.refs.stormDetail.textContent = `${storm.remaining} h remaining · external dose ×${Math.max(1, storm.intensityNow).toFixed(1)}`;
      this.refs.stormAction.textContent =
        state.shelterLocked && ctx.presence?.inShelter
          ? 'SHELTER SEALED'
          : state.shelterLocked
            ? 'SHELTER LOCKED — GET INSIDE'
            : 'GET TO THE SHELTER';
      this.refs.stormAction.classList.toggle('safe', Boolean(state.shelterLocked && ctx.presence?.inShelter));
    } else {
      this.refs.storm.classList.add('hidden');
    }

    this.refs.demo.classList.toggle('hidden', !ctx.demo);
    if (ctx.demo) this.refs.demo.textContent = `DEMO STATE · ×${ctx.speed}`;
  }
}
