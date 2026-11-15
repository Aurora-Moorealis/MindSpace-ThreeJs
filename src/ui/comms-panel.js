/**
 * Communications console. A full-screen terminal with five tabs: reports,
 * contracts, forecast, supplies and data sources. Only this console can turn
 * samples into reports; the panel stays live while the outpost clock runs.
 */

import { STRINGS } from '../data/strings.js';
import { EVENTS } from '../data/events.js';
import { SUBMISSIONS } from '../data/submissions.js';
import { MACHINES } from '../data/machines.js';
import { getSource } from '../data/sources.js';
import { ECONOMY, formatMissionTime } from '../data/economy.js';
import { escapeHtml, formatTicks, sourceBadge } from './helpers.js';
import { icon, iconForResource } from './icons.js';
import { sourcesMarkup } from './sources-view.js';

const TABS = [
  { id: 'reports', label: 'Reports', icon: 'report' },
  { id: 'contracts', label: 'Contracts', icon: 'contract' },
  { id: 'forecast', label: 'Forecast', icon: 'storm' },
  { id: 'supplies', label: 'Supplies', icon: 'supply' },
  { id: 'sources', label: 'Data Sources', icon: 'source' },
];

function statusBadge(status) {
  const map = {
    active: ['ACTIVE', 'active'],
    ready: ['READY TO CLAIM', 'ready'],
    claimed: ['CLAIMED', 'claimed'],
    missed: ['MISSED', 'missed'],
  };
  const [label, cls] = map[status] ?? ['ACTIVE', 'active'];
  return `<span class="status-chip ${cls}">${label}</span>`;
}

function resourceChips(reward, scale = 1) {
  return Object.entries(reward)
    .map(
      ([id, amount]) =>
        `<span class="reward-chip">${iconForResource(id)} ${STRINGS[`resource.${id}`] ?? id} +${Math.round(
          amount * scale
        )}</span>`
    )
    .join('');
}

export class CommsPanel {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
    this.tab = 'reports';
    this.signature = '';
  }

  open(sim, world, { tab = null } = {}) {
    this.sim = sim;
    this.world = world;
    this.closeNode();
    if (tab) this.tab = tab;
    else if (sim.state.samples.length) this.tab = 'reports';
    else if (sim.getSubmissionRows().some((row) => row.state.status === 'ready')) this.tab = 'contracts';
    this.node = document.createElement('div');
    this.node.className = 'modal-shell comms-shell';
    this.node.innerHTML = `
      <div class="modal-backdrop"></div>
      <section class="modal-panel comms-panel" role="dialog" aria-modal="true" aria-label="Communications console">
        <header class="comms-head">
          <div class="comms-title">
            <div class="comms-logo">${icon('comms', 22)}</div>
            <div>
              <div class="modal-eyebrow">DEEP SPACE NETWORK · MINDSPACE</div>
              <h2>COMMUNICATIONS</h2>
            </div>
          </div>
          <div class="comms-status">
            <div class="comms-clock">${formatMissionTime(sim.state.tick)}</div>
            <div class="comms-link" id="comms-link"></div>
            <button class="link-btn" data-glossary="dsn" aria-label="Glossary: Deep Space Network">${STRINGS['comms.glossary']}</button>
          </div>
          <button class="modal-close" data-action="close" aria-label="Close">${icon('close', 20)}</button>
        </header>
        <div class="comms-body">
          <nav class="comms-nav">
            ${TABS.map(
              (tabRow) => `<button class="comms-tab" data-tab="${tabRow.id}">
                ${icon(tabRow.icon, 17)}
                <span>${tabRow.label}</span>
                <em data-tab-badge="${tabRow.id}"></em>
              </button>`
            ).join('')}
          </nav>
          <div class="comms-content" id="comms-content"></div>
        </div>
        <footer class="comms-foot">
          <span id="comms-foot-left"></span>
          <span class="comms-hint">ESC to close · connection stays live</span>
        </footer>
      </section>
    `;
    this.host.append(this.node);
    this.node.classList.add('visible');
    this._bind();
    this.signature = '';
    this.refresh(sim, true);
    return this.node;
  }

  closeNode() {
    if (this.node) {
      this.node.remove();
      this.node = null;
    }
  }

  close() {
    if (!this.node) return;
    this.closeNode();
    this.signature = '';
    this.callbacks.onClose?.();
  }

  isOpen() {
    return Boolean(this.node);
  }

  refresh(sim, force = false) {
    if (!this.node) return;
    this.sim = sim;
    const active = sim.activeEvents();
    const sig = [
      this.tab,
      sim.state.tick,
      sim.state.resources.energy,
      sim.state.resources.water,
      sim.state.resources.food,
      sim.state.resources.o2,
      sim.state.scans.join(','),
      sim.state.samples.join(','),
      sim.state.reports.join(','),
      sim.state.reportQueue.length,
      sim.state.reportQueue.map((row) => `${row.poiId}:${row.queuedTick}`).join(','),
      sim.nextRelayTick(),
      sim.getSubmissionRows().map((row) => row.state.status).join(','),
      sim.getForecast().map((row) => `${row.id}:${row.inTicks}`).join(','),
      active.map((row) => `${row.id}:${row.remaining}`).join(','),
      sim.isCommsOutage(),
      sim.state.supply.cooldown,
      sim.state.supply.pending ? 'pending' : '',
      sim.energyCapacity,
      Math.round(sim.state.resources.energy),
    ].join('|');
    // The header clock updates on every tick even when content is unchanged.
    const clock = this.node.querySelector('.comms-clock');
    if (clock) clock.textContent = formatMissionTime(sim.state.tick);
    const link = this.node.querySelector('#comms-link');
    if (link) {
      const rtt = STRINGS['comms.rtt'] ?? `${ECONOMY.comms.lightDelayRoundTripSeconds} s round trip`;
      link.innerHTML = sim.isCommsOutage()
        ? `<span class="link-status outage">${icon('alert', 12)} DSN OUTAGE</span>`
        : `<span class="link-status ok">${icon('check', 12)} LINK OK · ${escapeHtml(rtt)}</span>`;
    }
    if (!force && sig === this.signature) return;
    this.signature = sig;
    this._renderContent(sim);
    this._renderNavBadges(sim);
  }

  _renderNavBadges(sim) {
    const samples = sim.state.samples.length;
    const queued = sim.state.reportQueue.length;
    const ready = sim.getSubmissionRows().filter((row) => row.state.status === 'ready').length;
    const badges = {
      reports: samples + queued || '',
      contracts: ready || '',
      forecast: sim.isCommsOutage() ? '!' : '',
      supplies: sim.state.supply.pending ? '…' : '',
      sources: '',
    };
    for (const [tab, value] of Object.entries(badges)) {
      const node = this.node.querySelector(`[data-tab-badge="${tab}"]`);
      if (node) {
        node.textContent = value;
        node.classList.toggle('alert', value === '!');
      }
    }
    this.node.querySelectorAll('.comms-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === this.tab);
    });
    const left = this.node.querySelector('#comms-foot-left');
    if (left) {
      left.innerHTML = `REPORTS <strong>${sim.state.reports.length}/3</strong> · CONTRACTS <strong>${
        sim.getSubmissionRows().filter((row) => row.state.status === 'claimed').length
      }/4</strong> · T+${String(sim.state.tick).padStart(3, '0')}H`;
    }
  }

  _renderContent(sim) {
    const host = this.node.querySelector('#comms-content');
    if (!host) return;
    if (this.tab === 'reports') host.innerHTML = this._reports(sim);
    else if (this.tab === 'contracts') host.innerHTML = this._contracts(sim);
    else if (this.tab === 'forecast') host.innerHTML = this._forecast(sim);
    else if (this.tab === 'supplies') host.innerHTML = this._supplies(sim);
    else host.innerHTML = sourcesMarkup({ compact: true });
    host.scrollTop = 0;
  }

  _reports(sim) {
    const rows = sim.getPoiRows();
    const queue = sim.state.reportQueue;
    const relay = sim.getRelayStatus();
    const countdown =
      relay.inTicks > 0
        ? (STRINGS['comms.passIn'] ?? 'in {n} h').replace('{n}', relay.inTicks)
        : STRINGS['comms.passNow'] ?? 'open now';
    const poiName = (id) => {
      const poi = rows.find((row) => row.id === id);
      return poi ? STRINGS[poi.nameKey] : id;
    };
    const queueRows = queue
      .map((item) => {
        const queuedAt = STRINGS['comms.queuedAt'].replace('{tick}', String(item.queuedTick).padStart(3, '0'));
        return `<div class="relay-queue-row">
          <span class="relay-queue-poi">${icon('report', 13)} ${escapeHtml(poiName(item.poiId))}</span>
          <span class="relay-queue-time">${escapeHtml(queuedAt)}</span>
        </div>`;
      })
      .join('');
    return `
      <div class="content-head">
        <div>
          <div class="content-eyebrow">PRIMARY MISSION</div>
          <h3>Science reports <span>${sim.state.reports.length}/3</span></h3>
          <p>Only this console can convert a surface sample into a report. Samples are carried automatically after a scan.</p>
        </div>
        <div class="content-badge">${icon('report', 18)} ${sim.state.samples.length} sample${sim.state.samples.length === 1 ? '' : 's'} aboard</div>
      </div>
      <div class="relay-queue">
        <div class="relay-queue-head">
          <strong>${STRINGS['comms.queueTitle']}</strong>
          <span class="relay-countdown">${icon('clock', 12)} ${STRINGS['comms.nextPass']} ${countdown}</span>
        </div>
        ${queue.length ? queueRows : `<div class="relay-queue-empty muted">${STRINGS['comms.queueEmpty']}</div>`}
        ${
          relay.outage
            ? `<div class="relay-queue-note">${icon('alert', 12)} ${STRINGS['comms.outageQueue']}</div>`
            : ''
        }
        <div class="relay-queue-note">${STRINGS['comms.lightNote']}</div>
      </div>
      <div class="report-list">
        ${rows
          .map((poi) => {
            const queued = !poi.reported && queue.some((item) => item.poiId === poi.id);
            const status = poi.reported
              ? 'sent'
              : queued
                ? 'queued'
                : poi.sampled
                  ? 'ready'
                  : poi.scanned
                    ? 'scanned'
                    : 'unscanned';
            const statusLabel =
              status === 'sent'
                ? 'REPORT SENT'
                : status === 'queued'
                  ? STRINGS['comms.queued']
                  : status === 'ready'
                    ? 'SAMPLE READY'
                    : status === 'scanned'
                      ? 'NO SAMPLE'
                      : 'NOT SURVEYED';
            return `<article class="report-card ${status}">
              <div class="report-index">${poi.code}</div>
              <div class="report-copy">
                <div class="report-head">
                  <strong>${escapeHtml(STRINGS[poi.nameKey])}</strong>
                  <span class="status-chip ${status}">${statusLabel}</span>
                </div>
                <p>${escapeHtml(STRINGS[poi.descriptionKey])}</p>
                ${
                  poi.scanned
                    ? `<div class="science-note">${icon('sample', 13)} ${escapeHtml(STRINGS[poi.scienceKey])}</div>`
                    : ''
                }
                ${
                  poi.reported
                    ? `<div class="report-sent-line">${icon('check', 13)} ${escapeHtml(STRINGS[poi.reportKey])} delivered to Mission Control.</div>`
                    : ''
                }
                ${
                  queued
                    ? `<div class="report-queued-line">${icon('clock', 13)} ${STRINGS['comms.waitingPass']}</div>`
                    : ''
                }
              </div>
              <div class="report-action">
                ${
                  poi.sampled
                    ? `<button class="btn btn-primary" data-action="send-report" data-poi="${poi.id}">${icon(
                        'report',
                        14
                      )} Send report</button>`
                    : poi.reported
                      ? `<span class="done-mark">${icon('check', 18)}</span>`
                      : queued
                        ? `<span class="muted">${icon('clock', 14)} ${countdown}</span>`
                        : `<span class="muted">Scan Site ${poi.code} first</span>`
                }
              </div>
            </article>`;
          })
          .join('')}
      </div>
      <div class="content-note">Reports are never blocked by a DSN outage. The backup channel is purpose-built for science delivery.</div>
    `;
  }

  _contracts(sim) {
    const rows = sim.getSubmissionRows();
    return `
      <div class="content-head">
        <div>
          <div class="content-eyebrow">MISSION CONTROL CONTRACTS</div>
          <h3>Optional objectives <span>${sim.log.submissionsClaimed()}/4</span></h3>
          <p>Four fixed conditions, evaluated against the live outpost. Claim rewards here; they convert directly into resources.</p>
        </div>
        <div class="content-badge">${icon('contract', 18)} ${rows.filter((row) => row.state.status === 'ready').length} ready</div>
      </div>
      <div class="contract-grid">
        ${rows
          .map((row) => {
            const status = row.state.status;
            const rewardScale = sim.stats.submission_reward;
            const progress = this._contractProgress(sim, row);
            return `<article class="contract-card ${status}">
              <div class="contract-card-head">
                <div class="contract-number">${String(SUBMISSIONS.indexOf(SUBMISSIONS.find((s) => s.id === row.id)) + 1).padStart(
                  2,
                  '0'
                )}</div>
                <div>
                  <strong>${escapeHtml(STRINGS[row.nameKey])}</strong>
                  ${statusBadge(status)}
                </div>
              </div>
              <p>${escapeHtml(STRINGS[row.descriptionKey])}</p>
              <div class="contract-progress">${progress}</div>
              <div class="contract-reward">${resourceChips(row.reward, rewardScale)}</div>
              <div class="contract-actions">
                ${
                  status === 'ready'
                    ? `<button class="btn btn-primary" data-action="claim" data-submission="${row.id}">${icon(
                        'check',
                        14
                      )} Claim reward</button>`
                    : status === 'claimed'
                      ? `<span class="done-line">${icon('check', 13)} Reward claimed</span>`
                      : status === 'missed'
                        ? `<span class="missed-line">${icon('alert', 13)} Missed this run</span>`
                        : `<span class="muted">Keep the outpost running</span>`
                }
              </div>
            </article>`;
          })
          .join('')}
      </div>
      <div class="content-note">Contract rewards are simulated tuning, not a NASA figure. The science conditions are educational fiction.</div>
    `;
  }

  _contractProgress(sim, row) {
    if (row.condition === 'counter_reached' && row.params.counter === 'scans') {
      const value = Math.min(sim.state.scans.length, row.params.target);
      return `<span>Scans</span><div class="mini-progress"><div style="width:${Math.min(100, (value / row.params.target) * 100)}%"></div></div><strong>${value}/${row.params.target}</strong>`;
    }
    if (row.condition === 'total_reports_sent') {
      const value = Math.min(sim.state.reports.length, row.params.target);
      return `<span>Reports</span><div class="mini-progress"><div style="width:${Math.min(100, (value / row.params.target) * 100)}%"></div></div><strong>${value}/${row.params.target}</strong>`;
    }
    if (row.condition === 'reading_before_event') {
      const event = EVENTS.find((e) => e.id === row.params.eventId);
      const done = sim.state.scanLog.some((scan) => scan.tick <= event.onset);
      return `<span>Reading before ${escapeHtml(STRINGS[event.nameKey])}</span><strong>${done ? 'captured' : 'pending'}</strong>`;
    }
    if (row.condition === 'resource_below_and_repaired') {
      const value = sim.state.resources[row.params.resource];
      const machine = sim.state.machines[row.params.machineId];
      return `<span>${escapeHtml(STRINGS[`resource.${row.params.resource}`])} below ${row.params.threshold}% with a working ${
        STRINGS[MACHINES[row.params.machineId].nameKey]
      }</span><strong>${Math.round(value)}% · ${Math.round(machine.condition)}%</strong>`;
    }
    return '';
  }

  _forecast(sim) {
    if (sim.isCommsOutage()) {
      return `<div class="content-head">
          <div><div class="content-eyebrow">SURFACE FORECAST</div><h3>Deep Space Network outage</h3></div>
        </div>
        <div class="forecast-outage-big">${icon('alert', 30)}<h4>FORECAST UNAVAILABLE</h4><p>Mission Control cannot uplink the next event window. Supply requests are also blocked. Science reports still use the backup channel.</p></div>`;
    }
    const active = sim.activeEvents();
    const future = sim.getForecast();
    const rows = [
      ...active.map(
        (row) => `<article class="forecast-event active">
          <div class="forecast-icon">${icon(row.archetype === 'radiation_window' ? 'storm' : 'alert', 20)}</div>
          <div class="forecast-copy">
            <div class="forecast-head"><strong>${escapeHtml(STRINGS[row.nameKey])}</strong><span class="status-chip active">ACTIVE</span></div>
            <p>${escapeHtml(STRINGS[row.descriptionKey])}</p>
            <div class="forecast-meta">${row.remaining} h remaining · intensity ${row.intensityNow.toFixed(2)}×</div>
          </div>
          <div class="forecast-source">${sourceBadge(getSource(row.source))}${
            getSource(row.source).url
              ? `<button class="link-btn" data-action="source" data-source="${row.source}">Archive ${icon('arrow', 10)}</button>`
              : ''
          }</div>
        </article>`
      ),
      ...future.map(
        (row) => `<article class="forecast-event ${row.archetype === 'radiation_window' ? 'radiation' : ''}">
          <div class="forecast-icon">${icon(
            row.archetype === 'radiation_window' ? 'storm' : row.archetype === 'comms_outage' ? 'comms' : 'alert',
            20
          )}</div>
          <div class="forecast-copy">
            <div class="forecast-head"><strong>${escapeHtml(STRINGS[row.nameKey])}</strong><span class="forecast-eta">in ${formatTicks(
              row.inTicks
            )}</span></div>
            <p>${escapeHtml(STRINGS[row.descriptionKey])}</p>
            <div class="forecast-meta">${row.duration} h window · peak intensity ${row.intensity.peak.toFixed(2)}×</div>
          </div>
          <div class="forecast-source">${sourceBadge(getSource(row.source))}${
            getSource(row.source).url
              ? `<button class="link-btn" data-action="source" data-source="${row.source}">Archive ${icon('arrow', 10)}</button>`
              : ''
          }</div>
        </article>`
      ),
    ];
    return `<div class="content-head">
        <div>
          <div class="content-eyebrow">SURFACE FORECAST</div>
          <h3>Next windows <span>${future.length}</span></h3>
          <p>Radiation windows are scaled from archived NASA DONKI events. Event timing and intensity are gameplay tuning.</p>
        </div>
        <div class="content-badge">${icon('storm', 18)} ${sim.getStorm() ? 'window active' : 'clear'}</div>
      </div>
      <div class="forecast-list">${rows.join('')}</div>
      <div class="content-note">Outside the habitat, dose rises with the window intensity. Inside, a small leak remains unless the storm shelter is sealed. Radiation never decays.</div>`;
  }

  _supplies(sim) {
    const cfg = ECONOMY.supply;
    const outage = sim.isCommsOutage();
    const pending = sim.state.supply.pending;
    const cooldown = sim.state.supply.cooldown;
    const canRequest = !outage && !pending && cooldown <= 0 && sim.state.resources.energy >= cfg.cost;
    let reason = '';
    if (outage) reason = 'DSN outage — requests blocked';
    else if (pending) reason = `Drop in transit · arrives in ${Math.max(0, pending.arriveTick - sim.state.tick)} h`;
    else if (cooldown > 0) reason = `Request cooldown · ${cooldown} h`;
    else if (sim.state.resources.energy < cfg.cost) reason = `Not enough power · ${cfg.cost} required`;
    return `
      <div class="content-head">
        <div>
          <div class="content-eyebrow">LOGISTICS</div>
          <h3>Supply requests <span>${pending ? 'INBOUND' : cooldown > 0 ? 'COOLDOWN' : 'READY'}</span></h3>
          <p>Mission Control can drop a small emergency cache. Requests are blocked during a DSN outage; science reports are not.</p>
        </div>
        <div class="content-badge">${icon('supply', 18)} ${Math.round(sim.state.resources.energy)} kWh available</div>
      </div>
      <div class="supply-card ${outage ? 'blocked' : ''}">
        <div class="supply-visual">${icon('supply', 40)}</div>
        <div class="supply-copy">
          <strong>Emergency resupply cache</strong>
          <p>One pallet of consumables, delivered to the airlock pad after ${cfg.delayTicks} game hours.</p>
          <div class="supply-give">
            ${Object.entries(cfg.give)
              .map(([id, amount]) => `<span class="reward-chip">${iconForResource(id)} ${STRINGS[`resource.${id}`]} +${amount}</span>`)
              .join('')}
          </div>
          <div class="supply-meta">Cost ${cfg.cost} power · cooldown ${cfg.cooldownTicks} h · ${reason || 'all conditions green'}</div>
        </div>
        <button class="btn btn-primary" data-action="supply" ${canRequest ? '' : 'disabled'}>${icon('supply', 15)} Request drop</button>
      </div>
      <div class="outage-note ${outage ? 'visible' : ''}">${icon('alert', 14)} A DSN outage blocks forecast and supply requests. Reports are delivered on the backup science channel.</div>
      <div class="content-note">Supply amounts are simulated gameplay tuning. The underlying consumable ratios are inspired by NASA life-support references.</div>
    `;
  }

  _bind() {
    if (!this.node) return;
    this.node.querySelectorAll('.comms-tab').forEach((button) => {
      button.addEventListener('click', () => {
        this.tab = button.dataset.tab;
        this.signature = '';
        this.refresh(this.sim, true);
      });
    });
    this.node.querySelector('[data-action="close"]')?.addEventListener('click', () => this.close());
    this.node.querySelector('.modal-backdrop')?.addEventListener('click', () => this.close());
    this.node.addEventListener('click', (event) => {
      const glossary = event.target.closest('[data-glossary]');
      if (glossary) {
        this.callbacks.onGlossary?.(glossary.dataset.glossary);
        return;
      }
      const button = event.target.closest('[data-action]');
      if (!button) return;
      if (button.dataset.action === 'send-report') this.callbacks.onSendReport?.(button.dataset.poi);
      if (button.dataset.action === 'claim') this.callbacks.onClaim?.(button.dataset.submission);
      if (button.dataset.action === 'supply') this.callbacks.onSupply?.();
      if (button.dataset.action === 'source') this.callbacks.onSource?.(button.dataset.source);
    });
  }
}

