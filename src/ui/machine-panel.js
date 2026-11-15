/**
 * Machine inspector drawer. Opened by walking to a machine and pressing E.
 * Shows live rates, condition, repair/upgrade actions, power toggles and the
 * provenance of every number. The simulation keeps running behind it.
 */

import { STRINGS } from '../data/strings.js';
import { MACHINES } from '../data/machines.js';
import { getSource } from '../data/sources.js';
import { ECONOMY } from '../data/economy.js';
import { escapeHtml, sourceBadge } from './helpers.js';
import { icon, iconForResource } from './icons.js';

const STATUS_LABEL = {
  online: 'ONLINE',
  standby: 'STANDBY',
  repairing: 'WORK IN PROGRESS',
  broken: 'BROKEN',
  off: 'SWITCHED OFF',
  night: 'NIGHT — NO SUN',
  starved: 'NO INPUT',
};

function resourceName(id) {
  return STRINGS[`resource.${id}`] ?? id;
}

function rate(value, sign = '') {
  if (!Number.isFinite(value)) return '—';
  return `${sign}${value.toFixed(2)}/h`;
}

function bar(value, className = '') {
  return `<div class="drawer-bar"><div class="drawer-bar-fill ${className}" style="width:${Math.max(0, Math.min(100, value))}%"></div></div>`;
}

export class MachinePanel {
  constructor(host, callbacks = {}) {
    this.host = host;
    this.callbacks = callbacks;
    this.node = null;
    this.machineId = null;
    this.signature = '';
  }

  open(sim, machineId, world) {
    this.sim = sim;
    this.world = world;
    this.machineId = machineId;
    this.signature = '';
    this.render(true);
    return this.node;
  }

  close() {
    if (!this.node) return;
    this.node.remove();
    this.node = null;
    this.machineId = null;
    this.signature = '';
    this.callbacks.onClose?.();
  }

  isOpen() {
    return Boolean(this.node);
  }

  refresh(sim) {
    if (!this.node || !this.machineId) return;
    this.sim = sim;
    const view = sim.machineView(this.machineId);
    if (!view) return;
    const sig = [
      this.machineId,
      Math.round(view.condition),
      view.status,
      view.job ? `${view.job.type}:${view.job.remainingTicks}` : '',
      view.machine.enabled,
      view.machine.upgrades.join(','),
      Math.round(sim.state.resources.energy),
      Math.round(sim.state.resources.water),
      Math.round(sim.state.resources.food),
      Math.round(sim.state.resources.o2),
      Math.round(sim.state.dust),
      sim.state.shelterLocked,
      sim.state.suit,
      sim.state.suitJob?.remainingTicks ?? '',
      sim.state.reports.length,
      sim.isCommsOutage(),
      sim.state.lastPower.shed.join(','),
      sim.state.toggles.lights,
    ].join('|');
    if (sig === this.signature) return;
    this.signature = sig;
    this.render(false);
  }

  render(full = true) {
    const sim = this.sim;
    const world = this.world;
    if (!sim || !this.machineId) return;
    const view = sim.machineView(this.machineId);
    if (!view) return;
    const row = MACHINES[this.machineId];
    if (!row) return;
    const statusLabel = STATUS_LABEL[view.status] ?? view.status.toUpperCase();
    const sourceRefs = (row.sourceRefs ?? []).map((id) => getSource(id));
    const upgrades = view.availableUpgrades;
    const energy = sim.state.resources.energy;
    const canAfford = (cost) => energy >= cost;
    const job = view.job;
    const primary = this._primaryAction(view, sim);

    const html = `
      <div class="drawer-backdrop"></div>
      <section class="drawer machine-drawer" role="dialog" aria-label="${escapeHtml(STRINGS[row.nameKey])}">
        <header class="drawer-head">
          <div>
            <div class="drawer-eyebrow">${escapeHtml(STRINGS[row.roomKey] ?? '')} · MACHINE ${row.id.toUpperCase()}</div>
            <h2>${escapeHtml(STRINGS[row.nameKey])}</h2>
            <div class="drawer-status status-${view.status}"><span class="status-dot"></span>${statusLabel}</div>
          </div>
          <button class="modal-close" data-action="close" aria-label="Close">${icon('close', 20)}</button>
        </header>
        <div class="drawer-body">
          <p class="drawer-description">${escapeHtml(STRINGS[row.descriptionKey])}</p>

          <div class="drawer-section">
            <div class="section-title"><span>CONDITION</span><span>${Math.round(view.condition)}%</span></div>
            ${bar(view.condition, view.condition < 35 ? 'critical' : view.condition < 60 ? 'warning' : 'good')}
            <div class="drawer-meta-row">
              <span>Output factor ${view.conditionFactor.toFixed(2)}×</span>
              <span>Wear ${row.conditionDecay.toFixed(2)}%/h</span>
            </div>
            ${
              job
                ? `<div class="job-card">
                    <div class="job-title">${job.type === 'repair' ? 'REPAIR IN PROGRESS' : 'INSTALLING UPGRADE'}</div>
                    <div class="job-track"><div class="job-fill" style="width:${Math.round(((job.totalTicks - job.remainingTicks) / job.totalTicks) * 100)}%"></div></div>
                    <div class="job-meta">${job.remainingTicks} game hour${job.remainingTicks > 1 ? 's' : ''} remaining</div>
                  </div>`
                : ''
            }
          </div>

          ${this._ratesSection(view, sim)}
          ${this._specialSection(view, sim, world)}

          <div class="drawer-actions">
            ${primary}
            ${
              view.kind === 'production'
                ? `<button class="btn btn-ghost" data-action="toggle">${view.machine.enabled ? 'Switch OFF' : 'Switch ON'}</button>`
                : ''
            }
            ${
              view.condition < 99.5
                ? `<button class="btn btn-secondary" data-action="repair" ${
                    job || energy < ECONOMY.repair.energyCost ? 'disabled' : ''
                  }>${icon('wrench', 15)} Repair · ${ECONOMY.repair.energyCost} power · ${Math.max(1, Math.round(ECONOMY.repair.ticks * sim.stats.repair_time))} h</button>`
                : ''
            }
          </div>

          <div class="drawer-section">
            <div class="section-title"><span>UPGRADES</span><span>${view.machine.upgrades.length}/${upgrades.length}</span></div>
            <div class="upgrade-list">
              ${upgrades
                .map((upgrade) => {
                  const installed = upgrade.installed;
                  const disabled = installed || job || !canAfford(upgrade.cost);
                  return `<div class="upgrade-row ${installed ? 'installed' : ''}">
                    <div class="upgrade-copy">
                      <div class="upgrade-name">${escapeHtml(STRINGS[upgrade.nameKey])}</div>
                      <div class="upgrade-desc">${escapeHtml(STRINGS[upgrade.descriptionKey])}</div>
                    </div>
                    <button class="btn btn-small ${installed ? 'btn-done' : 'btn-secondary'}" data-action="upgrade" data-upgrade="${upgrade.id}" ${
                      disabled ? 'disabled' : ''
                    }>${installed ? 'INSTALLED' : `${upgrade.cost} PWR`}</button>
                  </div>`;
                })
                .join('')}
            </div>
          </div>

          <div class="drawer-section source-section">
            <div class="section-title"><span>PROVENANCE</span><span>${row.real_data ? 'NASA' : 'SIMULATED'}</span></div>
            <div class="source-chips">
              ${sourceRefs
                .map((source) => `<button class="source-chip" data-source="${source.id}">${sourceBadge(source, { short: true })}<span>${escapeHtml(
                  source.short
                )}</span></button>`)
                .join('')}
            </div>
            <div class="drawer-note">Reliability, repair cost and tuning are simulated. Rates are anchored to the cited NASA reference where noted.</div>
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

  _primaryAction(view, sim) {
    if (view.kind === 'comms') {
      return `<button class="btn btn-primary" data-action="comms">${icon('comms', 15)} Open comms terminal</button>`;
    }
    if (view.kind === 'shelter') {
      const locked = sim.state.shelterLocked;
      return `<button class="btn ${locked ? 'btn-secondary' : 'btn-primary'}" data-action="shelter">${icon(
        locked ? 'unlock' : 'lock',
        15
      )} ${locked ? 'Unlock shelter' : 'Lock shelter'}</button>`;
    }
    if (view.kind === 'solar') {
      return `<button class="btn btn-primary" data-action="clean" ${
        sim.state.dust < 1 || view.condition <= 0 ? 'disabled' : ''
      }>${icon('energy', 15)} Clean panels · +${ECONOMY.radiation.cleanPanelDose.toFixed(1)} dose</button>`;
    }
    if (view.kind === 'bench') {
      return `<button class="btn btn-primary" data-action="suit-repair" ${
        sim.state.suit >= 99.5 || sim.state.suitJob || sim.state.resources.energy < ECONOMY.suit.repairCost ? 'disabled' : ''
      }>${icon('suit', 15)} Repair suit · ${ECONOMY.suit.repairCost} power</button>`;
    }
    if (view.kind === 'battery') {
      return `<button class="btn btn-ghost" data-action="sources">${icon('source', 15)} Power data</button>`;
    }
    return '';
  }

  _ratesSection(view, sim) {
    if (view.kind === 'solar') {
      return `<div class="drawer-section">
        <div class="section-title"><span>POWER OUTPUT</span><span>${(view.outputs?.energy ?? 0).toFixed(2)} kW</span></div>
        <div class="rate-grid">
          <div class="rate-row"><span>${icon('energy', 14)} Output</span><strong>${rate(view.outputs?.energy ?? 0, '+')}</strong></div>
          <div class="rate-row"><span>${icon('storm', 14)} Dust</span><strong>${Math.round(sim.state.dust)}%</strong></div>
          <div class="rate-row"><span>${icon('power', 14)} Condition factor</span><strong>${view.conditionFactor.toFixed(2)}×</strong></div>
          <div class="rate-row"><span>${icon('clock', 14)} Daylight</span><strong>${sim.isDay ? 'YES' : 'NO'}</strong></div>
        </div>
        <div class="drawer-meta-row"><span>Cleaning costs dose and 4 s outside.</span><span>Dust also settles at night.</span></div>
      </div>`;
    }
    if (view.kind === 'battery') {
      const charge = (sim.state.resources.energy / Math.max(1, sim.energyCapacity)) * 100;
      return `<div class="drawer-section">
        <div class="section-title"><span>STORAGE</span><span>${Math.round(sim.state.resources.energy)} / ${sim.energyCapacity} kWh</span></div>
        ${bar(charge, charge < 25 ? 'critical' : charge < 50 ? 'warning' : 'good')}
        <div class="rate-grid">
          <div class="rate-row"><span>${icon('energy', 14)} Usable capacity</span><strong>${sim.energyCapacity} kWh</strong></div>
          <div class="rate-row"><span>${icon('power', 14)} Current charge</span><strong>${charge.toFixed(0)}%</strong></div>
          <div class="rate-row"><span>${icon('gauge', 14)} Battery health</span><strong>${Math.round(view.condition)}%</strong></div>
        </div>
        <div class="drawer-note">If the battery bank is broken, usable capacity collapses to 30 kWh. Repair it before the lunar night.</div>
      </div>`;
    }
    if (view.kind === 'distributor') {
      const power = sim.state.lastPower;
      const toggles = [
        ['lights', 'Lights', sim.state.toggles.lights],
        ['hydroponics', 'Hydroponics', sim.state.machines.hydroponics.enabled],
        ['water_recycler', 'Water recycler', sim.state.machines.water_recycler.enabled],
        ['o2_system', 'O2 system', sim.state.machines.o2_system.enabled],
      ];
      return `<div class="drawer-section">
        <div class="section-title"><span>POWER BUS</span><span>${power.demand.toFixed(1)} kW load</span></div>
        <div class="rate-grid">
          <div class="rate-row"><span>${icon('energy', 14)} Solar input</span><strong>${power.solar.toFixed(1)} kW</strong></div>
          <div class="rate-row"><span>${icon('power', 14)} Load</span><strong>${power.demand.toFixed(1)} kW</strong></div>
          <div class="rate-row"><span>${icon('alert', 14)} Load shed</span><strong>${power.shed.length ? power.shed.join(', ') : 'none'}</strong></div>
        </div>
        <div class="toggle-list">
          ${toggles
            .map(
              ([id, label, on]) => `<div class="toggle-row">
                <span>${escapeHtml(label)}</span>
                <button class="switch ${on ? 'on' : 'off'}" data-action="power-toggle" data-system="${id}">${on ? 'ON' : 'OFF'}</button>
              </div>`
            )
            .join('')}
        </div>
        <div class="drawer-note"><strong>Shed priority:</strong> ${escapeHtml(ECONOMY.power.shedOrderLabel)}. The O2 system is always last.</div>
      </div>`;
    }
    if (view.kind === 'bench') {
      const suitJob = sim.state.suitJob;
      return `<div class="drawer-section">
        <div class="section-title"><span>CREW SUIT</span><span>${Math.round(sim.state.suit)}% integrity</span></div>
        ${bar(sim.state.suit, sim.state.suit < 40 ? 'critical' : sim.state.suit < 65 ? 'warning' : 'good')}
        <div class="rate-grid">
          <div class="rate-row"><span>${icon('radiation', 14)} Dose multiplier</span><strong>${(sim.suitDoseFactor() * sim.stats.suit_shield).toFixed(2)}×</strong></div>
          <div class="rate-row"><span>${icon('suit', 14)} Repair cost</span><strong>${ECONOMY.suit.repairCost} power</strong></div>
          <div class="rate-row"><span>${icon('clock', 14)} Repair time</span><strong>${Math.max(1, Math.round(ECONOMY.suit.repairTicks * sim.stats.repair_time))} h</strong></div>
        </div>
        ${
          suitJob
            ? `<div class="job-card"><div class="job-title">SUIT REPAIR IN PROGRESS</div><div class="job-track"><div class="job-fill" style="width:${Math.round(
                ((suitJob.totalTicks - suitJob.remainingTicks) / suitJob.totalTicks) * 100
              )}%"></div></div><div class="job-meta">${suitJob.remainingTicks} h remaining</div></div>`
            : ''
        }
        <div class="drawer-note">Low suit integrity increases radiation dose. Suit Mk II is installed below.</div>
      </div>`;
    }
    if (view.kind === 'comms') {
      return `<div class="drawer-section">
        <div class="section-title"><span>DEEP SPACE NETWORK</span><span>${sim.isCommsOutage() ? 'OUTAGE' : 'LINK OK'}</span></div>
        <div class="rate-grid">
          <div class="rate-row"><span>${icon('report', 14)} Reports sent</span><strong>${sim.state.reports.length} / 3</strong></div>
          <div class="rate-row"><span>${icon('sample', 14)} Samples carried</span><strong>${sim.state.samples.length}</strong></div>
          <div class="rate-row"><span>${icon('clock', 14)} Forecast</span><strong>${sim.isCommsOutage() ? 'blocked' : 'live'}</strong></div>
          <div class="rate-row"><span>${icon('supply', 14)} Supply requests</span><strong>${sim.isCommsOutage() ? 'blocked' : 'available'}</strong></div>
        </div>
        <div class="drawer-note">Reports remain available during a DSN outage. Forecast and supply requests do not.</div>
      </div>`;
    }
    if (view.kind === 'shelter') {
      return `<div class="drawer-section">
        <div class="section-title"><span>RADIATION SHIELD</span><span>${sim.state.shelterLocked ? 'SEALED' : 'OPEN'}</span></div>
        <div class="rate-grid">
          <div class="rate-row"><span>${icon('radiation', 14)} Sheltered dose</span><strong>${(ECONOMY.radiation.shelterPerTick * (sim.getStorm()?.intensityNow ?? 1) * sim.stats.shelter_shield).toFixed(2)}/h</strong></div>
          <div class="rate-row"><span>${icon('radiation', 14)} Habitat dose</span><strong>${(ECONOMY.radiation.insideStormPerTick * (sim.getStorm()?.intensityNow ?? 1)).toFixed(2)}/h</strong></div>
          <div class="rate-row"><span>${icon('radiation', 14)} Surface dose</span><strong>${(ECONOMY.radiation.outsidePerTick * (sim.getStorm()?.intensityNow ?? 1) * sim.suitDoseFactor()).toFixed(2)}/h</strong></div>
        </div>
        <div class="drawer-note">The shield only protects you while you are inside the pod and it is locked. Radiation never decays.</div>
      </div>`;
    }
    // Production machines.
    const inputs = Object.entries(view.inputs ?? {});
    const outputs = Object.entries(view.outputs ?? {});
    return `<div class="drawer-section">
      <div class="section-title"><span>PRODUCTION</span><span>${view.plan?.reason === 'standby' ? 'STANDBY' : view.status.toUpperCase()}</span></div>
      <div class="rate-grid">
        <div class="rate-row"><span>${icon('power', 14)} Power draw</span><strong>${view.power.toFixed(2)} kW</strong></div>
        ${inputs
          .map(
            ([id, amount]) => `<div class="rate-row"><span>${iconForResource(id)} ${resourceName(id)} input</span><strong>-${amount.toFixed(2)}/h</strong></div>`
          )
          .join('')}
        ${outputs
          .map(
            ([id, amount]) => `<div class="rate-row"><span>${iconForResource(id)} ${resourceName(id)} output</span><strong>+${amount.toFixed(2)}/h</strong></div>`
          )
          .join('')}
      </div>
      ${
        view.plan?.reason === 'standby'
          ? `<div class="drawer-note">The tank is full. The machine is standing by and saving power and water.</div>`
          : view.plan?.reason === 'starved'
            ? `<div class="drawer-note danger">Missing input. Production is halted until the input tank recovers.</div>`
            : ''
      }
    </div>`;
  }

  _specialSection(view, sim) {
    if (view.kind === 'production' && view.id === 'hydroponics') {
      return `<div class="drawer-note">Hydroponics is the only food producer. In a power crisis it is shed before the recycler and the O2 system.</div>`;
    }
    if (view.kind === 'production' && view.id === 'o2_system') {
      return `<div class="drawer-note">If the O2 tank empties, the suit reserve gives the crew ${ECONOMY.emergencyO2.ticks} game hours. Repair this machine first.</div>`;
    }
    return '';
  }

  _bind() {
    if (!this.node) return;
    this.node.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.action;
        const machineId = this.machineId;
        if (action === 'close') this.close();
        else if (action === 'repair') this.callbacks.onRepair?.(machineId);
        else if (action === 'upgrade') this.callbacks.onUpgrade?.(machineId, button.dataset.upgrade);
        else if (action === 'toggle') this.callbacks.onToggle?.(machineId);
        else if (action === 'power-toggle') this.callbacks.onPowerToggle?.(button.dataset.system);
        else if (action === 'clean') this.callbacks.onClean?.(machineId);
        else if (action === 'shelter') this.callbacks.onShelter?.();
        else if (action === 'suit-repair') this.callbacks.onSuitRepair?.();
        else if (action === 'comms') this.callbacks.onOpenComms?.();
        else if (action === 'sources') this.callbacks.onSources?.();
      });
    });
    this.node.querySelectorAll('[data-source]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSource?.(button.dataset.source);
      });
    });
    const backdrop = this.node.querySelector('.drawer-backdrop');
    backdrop?.addEventListener('click', () => this.close());
  }
}
