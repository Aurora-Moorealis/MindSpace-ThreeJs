/**
 * Notification center: transient toasts and event banners. It translates the
 * simulation's typed notifications into player-facing copy, attaches the
 * provenance badge, and requests the matching sound from the main loop.
 */

import { STRINGS } from '../data/strings.js';
import { getSource } from '../data/sources.js';
import { EVENTS } from '../data/events.js';
import { MACHINES } from '../data/machines.js';
import { POIS } from '../data/pois.js';
import { SUBMISSIONS } from '../data/submissions.js';
import { escapeHtml, sourceBadge } from './helpers.js';
import { icon } from './icons.js';

const RESOURCE_LABELS = { o2: 'Oxygen', water: 'Water', food: 'Food', energy: 'Power' };

function eventById(id) {
  return EVENTS.find((row) => row.id === id) ?? null;
}

function machineName(id) {
  return STRINGS[MACHINES[id]?.nameKey] ?? id;
}

function submissionName(id) {
  return STRINGS[SUBMISSIONS.find((row) => row.id === id)?.nameKey] ?? id;
}

function poiName(id) {
  const poi = POIS.find((row) => row.id === id);
  return poi ? `${STRINGS[poi.nameKey]}` : id;
}

function rewardText(reward = {}) {
  return Object.entries(reward)
    .map(([id, amount]) => `${RESOURCE_LABELS[id] ?? id} +${amount}`)
    .join(' · ');
}

export function describeNotification(notification, sim) {
  const { type, payload = {}, severity = 'info' } = notification;
  const soundMap = {
    event_start: 'event',
    storm_start: 'alarm',
    storm_end: 'click',
    event_end: 'click',
    machine_broken: 'alarm',
    machine_repaired: 'repair',
    repair_started: 'click',
    upgrade_started: 'click',
    upgrade_installed: 'repair',
    submission_ready: 'report',
    submission_claimed: 'report',
    submission_missed: 'click',
    scan_complete: 'scan',
    report_sent: 'report',
    supply_requested: 'click',
    supply_arrived: 'repair',
    low_resource: 'alarm',
    power_shed: 'click',
    power_toggle: 'click',
    o2_emergency: 'alarm',
    dose_threshold: 'alarm',
    dose_danger: 'alarm',
    shelter_used: 'click',
    shelter_toggle: 'click',
    solar_cleaned: 'repair',
    suit_repair_started: 'click',
    suit_repaired: 'repair',
    crew_damage: 'alarm',
    low_health: 'alarm',
    victory: 'report',
    defeat: 'alarm',
  };
  const sound = soundMap[type] ?? 'click';

  switch (type) {
    case 'event_start':
    case 'storm_start': {
      const event = eventById(payload.eventId);
      if (!event) return null;
      const isStorm = event.archetype === 'radiation_window';
      return {
        kind: isStorm ? 'storm' : 'warn',
        banner: true,
        title: STRINGS[event.nameKey],
        body: STRINGS[event.descriptionKey],
        sourceId: event.source,
        sound,
        icon: isStorm ? 'storm' : event.archetype === 'comms_outage' ? 'comms' : 'alert',
        tag: isStorm ? 'RADIATION ALERT' : 'OUTPOST ALERT',
      };
    }
    case 'storm_end': {
      const event = eventById(payload.eventId);
      return {
        kind: 'good',
        title: 'Radiation window over',
        body: 'Dose is cumulative and never decays. Check the crew and the next forecast.',
        sourceId: payload.source,
        icon: 'storm',
        sound,
      };
    }
    case 'event_end':
      return null;
    case 'machine_broken':
      return {
        kind: 'critical',
        title: 'MACHINE DOWN',
        body: `${machineName(payload.machineId)} needs a repair. Walk to it and press E.`,
        icon: 'alert',
        sound,
      };
    case 'machine_repaired':
      return {
        kind: 'good',
        title: 'Repair complete',
        body: `${machineName(payload.machineId)} is back online.`,
        icon: 'check',
        sound,
      };
    case 'repair_started':
      return {
        kind: 'info',
        title: 'Repair started',
        body: `${machineName(payload.machineId)} · ${payload.ticks} game hour${payload.ticks > 1 ? 's' : ''}.`,
        icon: 'wrench',
        sound,
      };
    case 'upgrade_started':
      return {
        kind: 'info',
        title: 'Upgrade in progress',
        body: `${machineName(payload.machineId)} · ${payload.ticks} game hours.`,
        icon: 'wrench',
        sound,
      };
    case 'upgrade_installed':
      return {
        kind: 'good',
        title: 'Upgrade installed',
        body: `${machineName(payload.machineId)} improved. Check its panel for the new numbers.`,
        icon: 'check',
        sound,
      };
    case 'submission_ready':
      return {
        kind: 'good',
        title: 'CONTRACT READY',
        body: `${submissionName(payload.submissionId)}. Claim it at the comms console.`,
        icon: 'contract',
        sound,
      };
    case 'submission_claimed':
      return {
        kind: 'good',
        title: 'Contract claimed',
        body: `${submissionName(payload.submissionId)} · ${rewardText(payload.reward)}`,
        icon: 'check',
        sound,
      };
    case 'submission_missed':
      return {
        kind: 'warn',
        title: 'Contract missed',
        body: `${submissionName(payload.submissionId)} can no longer be completed this run.`,
        icon: 'alert',
        sound,
      };
    case 'scan_complete': {
      const poi = POIS.find((row) => row.id === payload.poiId);
      return {
        kind: 'good',
        title: 'SAMPLE SECURED',
        body: `${poiName(payload.poiId)}. Take it to the comms console and send the report.`,
        icon: 'sample',
        sound,
      };
    }
    case 'report_sent':
      return {
        kind: 'good',
        title: 'REPORT SENT',
        body: `${poiName(payload.poiId)} · ${payload.count}/3 reports delivered to Mission Control.`,
        sourceId: 'mission',
        icon: 'report',
        sound,
      };
    case 'supply_requested':
      return {
        kind: 'info',
        title: 'Supply drop requested',
        body: `${payload.cost} power committed. Arrival in ${payload.ticks} game hours.`,
        icon: 'supply',
        sound,
      };
    case 'supply_arrived':
      return {
        kind: 'good',
        title: 'Supply drop on the pad',
        body: rewardText(payload.give),
        icon: 'supply',
        sound,
      };
    case 'low_resource':
      return {
        kind: 'critical',
        title: `${RESOURCE_LABELS[payload.resource] ?? payload.resource} critical`,
        body: `Reserve at ${Math.round(payload.value)}%. Fix the source before it cascades.`,
        sourceId: `${
          payload.resource === 'energy' ? 'ogs' : 'bvad'
        }`,
        icon: 'alert',
        sound,
      };
    case 'power_shed':
      return {
        kind: 'warn',
        title: 'Load shedding',
        body: `Power short. Shed this hour: ${payload.systems.map((id) => machineName(id) === id ? id.replaceAll('_', ' ') : machineName(id)).join(', ')}.`,
        icon: 'power',
        sound,
      };
    case 'power_toggle':
      return {
        kind: 'info',
        title: 'Power routing',
        body: `${payload.system === 'lights' ? 'Lights' : machineName(payload.system)} ${payload.on ? 'enabled' : 'disabled'}.`,
        icon: 'power',
        sound,
      };
    case 'o2_emergency':
      return {
        kind: 'critical',
        banner: true,
        title: 'OXYGEN RESERVE',
        body: `The O2 tank is empty. Suit reserve is counting down. Repair the O2 system now.`,
        sourceId: 'bvad',
        icon: 'oxygen',
        sound,
      };
    case 'dose_threshold':
      return {
        kind: 'warn',
        title: 'DOSE THRESHOLD CROSSED',
        body: `Above ${payload.threshold} dose your maximum health is capped. The dose will not decay.`,
        sourceId: 'crater',
        icon: 'radiation',
        sound,
      };
    case 'dose_danger':
      return {
        kind: 'critical',
        banner: true,
        title: 'RADIATION DAMAGE',
        body: `Dose above ${payload.threshold}. Health is dropping. Get to the storm shelter.`,
        sourceId: 'crater',
        icon: 'radiation',
        sound,
      };
    case 'shelter_used':
      return {
        kind: 'good',
        title: 'Shelter holding',
        body: 'The storm shelter is cutting your dose. Stay sealed until the window passes.',
        sourceId: 'crater',
        icon: 'lock',
        sound,
      };
    case 'shelter_toggle':
      return {
        kind: 'info',
        title: 'Storm shelter',
        body: payload.locked
          ? 'Sealed. Dose is reduced while you stay inside.'
          : 'Unsealed. Remember to lock it before the next radiation window.',
        icon: payload.locked ? 'lock' : 'unlock',
        sound,
      };
    case 'solar_cleaned':
      return {
        kind: 'good',
        title: 'Solar array cleaned',
        body: `Output restored. You received ${payload.dose.toFixed(2)} dose outside.`,
        sourceId: 'crater',
        icon: 'energy',
        sound,
      };
    case 'suit_repair_started':
      return {
        kind: 'info',
        title: 'Suit repair started',
        body: `${payload.ticks} game hour${payload.ticks > 1 ? 's' : ''} at the repair bench.`,
        icon: 'suit',
        sound,
      };
    case 'suit_repaired':
      return {
        kind: 'good',
        title: 'Suit integrity restored',
        body: `Suit at ${payload.suit}%. Lower integrity means more radiation dose.`,
        sourceId: 'crater',
        icon: 'suit',
        sound,
      };
    case 'crew_damage':
      return {
        kind: 'critical',
        title: 'CREW DAMAGE',
        body:
          payload.cause === 'radiation'
            ? 'Radiation is damaging the crew. Check the shelter.'
            : payload.cause === 'starvation'
              ? 'No food: nutrition is at zero and health is dropping.'
              : payload.cause === 'dehydration'
                ? 'No water: hydration is at zero and health is dropping.'
                : 'Life support failure is damaging the crew.',
        icon: 'health',
        sound,
      };
    case 'low_health':
      return {
        kind: 'critical',
        title: 'Health critical',
        body: `Crew health at ${payload.health}. Fix life support or reach the shelter.`,
        icon: 'health',
        sound,
      };
    case 'victory':
      return null;
    case 'defeat':
      return null;
    default:
      return null;
  }
}

export class NotificationCenter {
  constructor({ bannerLayer, toastLayer, onSource }) {
    this.bannerLayer = bannerLayer;
    this.toastLayer = toastLayer;
    this.onSource = onSource;
    this.bannerTimer = null;
    this.toastCount = 0;
  }

  handle(notifications, sim, { onSound } = {}) {
    for (const notification of notifications) {
      const described = describeNotification(notification, sim);
      if (!described) continue;
      if (described.sound && onSound) onSound(described.sound);
      if (described.banner) this.banner(described);
      else this.toast(described);
    }
  }

  banner({ kind = 'warn', title, body, sourceId, icon: iconName = 'alert', tag = 'OUTPOST ALERT' }) {
    const source = sourceId ? getSource(sourceId) : null;
    this.bannerLayer.innerHTML = `
      <div class="event-banner ${kind}">
        <div class="banner-accent"></div>
        <div class="banner-icon">${icon(iconName, 26)}</div>
        <div class="banner-copy">
          <div class="banner-tag">${escapeHtml(tag)}</div>
          <div class="banner-title">${escapeHtml(title)}</div>
          <div class="banner-body">${escapeHtml(body)}</div>
          <div class="banner-source">${sourceBadge(source)}${
            source?.url
              ? `<button class="link-btn" data-banner-source="${escapeHtml(source.id)}">View source ${icon('arrow', 11)}</button>`
              : ''
          }</div>
        </div>
        <button class="banner-close" aria-label="Dismiss">${icon('close', 16)}</button>
      </div>
    `;
    this.bannerLayer.querySelector('.banner-close').addEventListener('click', () => this.clearBanner());
    const sourceButton = this.bannerLayer.querySelector('[data-banner-source]');
    if (sourceButton) {
      sourceButton.addEventListener('click', () => this.onSource?.(sourceButton.dataset.bannerSource));
    }
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.clearBanner(), kind === 'storm' ? 11000 : 8000);
  }

  clearBanner() {
    clearTimeout(this.bannerTimer);
    this.bannerLayer.innerHTML = '';
  }

  toast({ kind = 'info', title, body, sourceId, icon: iconName = 'alert', duration = 6200 }) {
    if (this.toastCount >= 5) {
      const first = this.toastLayer.querySelector('.toast');
      first?.remove();
      this.toastCount = Math.max(0, this.toastCount - 1);
    }
    const source = sourceId ? getSource(sourceId) : null;
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.innerHTML = `
      <div class="toast-icon">${icon(iconName, 18)}</div>
      <div class="toast-copy">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-body">${escapeHtml(body)}</div>
        ${source ? `<div class="toast-source">${sourceBadge(source, { short: true })}</div>` : ''}
      </div>
    `;
    node.addEventListener('click', () => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 220);
      this.toastCount = Math.max(0, this.toastCount - 1);
    });
    this.toastLayer.append(node);
    this.toastCount += 1;
    requestAnimationFrame(() => node.classList.add('visible'));
    setTimeout(() => {
      if (!node.isConnected) return;
      node.classList.add('leaving');
      setTimeout(() => {
        node.remove();
        this.toastCount = Math.max(0, this.toastCount - 1);
      }, 220);
    }, duration);
    return node;
  }

  story(title, body, iconName = 'comms') {
    return this.toast({ kind: 'story', title, body, icon: iconName, duration: 9000 });
  }

  clear() {
    this.clearBanner();
    this.toastLayer.innerHTML = '';
    this.toastCount = 0;
  }
}
