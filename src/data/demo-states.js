/**
 * Demo state presets.
 *
 * Two explicit constructors, one just before a radiation window and one in the
 * final mission hour. They are not save games: they are debug/demo entry points
 * validated against invariants before they can be loaded. The debug overlay can
 * capture the live state into the same shape.
 */

import { ECONOMY } from './economy.js';
import { EVENTS } from './events.js';
import { MACHINES } from './machines.js';
import { POIS } from './pois.js';
import { SUBMISSIONS } from './submissions.js';
import { GameSim } from '../core/sim.js';

const MACHINE_IDS = Object.keys(MACHINES);

const machineRow = (condition, extra = {}) => ({
  condition,
  enabled: true,
  upgrades: [],
  repairCount: 0,
  ...extra,
});

const seedLog = (entries) => entries.map((entry) => ({
  tick: entry.tick,
  type: entry.type,
  payload: { ...(entry.payload ?? {}) },
}));

export const DEMO_PRESETS = [
  {
    id: 'demo_mid',
    name: 'Mid-mission · 3 hours before a radiation window',
    description:
      'One report delivered, one sample waiting, contracts ready to claim. A CME window hits in three game hours. The outpost is stable but the recycler and solar array need attention.',
    demo: true,
    tick: 123,
    speed: 10,
    player: { x: 0, z: 2.5, facing: 0 },
    resources: { o2: 64, water: 42, food: 61, energy: 46 },
    health: 84,
    radiation: 12,
    nutrition: 72,
    hydration: 68,
    suit: 61,
    dust: 42,
    shelterLocked: false,
    toggles: { lights: true },
    machines: {
      o2_system: machineRow(76, { upgrades: ['o2_efficiency'], repairCount: 1 }),
      water_recycler: machineRow(62, { upgrades: ['water_power'], repairCount: 2 }),
      hydroponics: machineRow(84),
      solar_array: machineRow(58, { upgrades: ['solar_tracking'] }),
      battery: machineRow(88),
      power_distributor: machineRow(90),
      repair_bench: machineRow(95),
      comms_console: machineRow(97),
      storm_shelter: machineRow(100),
    },
    crops: [{ progress: 18 }, { progress: 5 }, null],
    scans: ['site_a', 'site_b'],
    samples: ['site_b'],
    reports: ['site_a'],
    scanLog: [
      { poiId: 'site_a', tick: 34 },
      { poiId: 'site_b', tick: 95 },
    ],
    submissions: {
      storm_watch: { status: 'claimed', readyTick: 35, claimedTick: 36 },
      field_survey: { status: 'claimed', readyTick: 96, claimedTick: 97 },
      water_watch: { status: 'ready', readyTick: 108, claimedTick: null },
      science_delivery: { status: 'active', readyTick: null, claimedTick: null },
    },
    supply: { cooldown: 9, pending: null },
    stats: {
      peakDose: 14,
      evas: 2,
      shelterUses: 1,
      repairs: 2,
      upgrades: 2,
      reportsSent: 1,
      submissionsClaimed: 2,
      scans: 2,
      stormsSurvived: 1,
      energyWasted: 0,
      harvests: 3,
    },
    log: seedLog([
      { tick: 6, type: 'storm_started', payload: { eventId: 'storm_gannon_arrival', source: 'donki_cme' } },
      { tick: 12, type: 'storm_ended', payload: { eventId: 'storm_gannon_arrival', source: 'donki_cme' } },
      { tick: 18, type: 'note', payload: { note: 'machine_worn_out', machineId: 'water_recycler' } },
      { tick: 24, type: 'machine_repaired', payload: { machineId: 'water_recycler', condition: 68 } },
      { tick: 34, type: 'scan_complete', payload: { poiId: 'site_a', source: 'mission' } },
      { tick: 36, type: 'submission_claimed', payload: { submissionId: 'storm_watch', source: 'gameplay' } },
      { tick: 40, type: 'shelter_used', payload: { eventId: 'storm_sep_may10', source: 'donki_sep' } },
      { tick: 62, type: 'storm_started', payload: { eventId: 'storm_sep_may10', source: 'donki_sep' } },
      { tick: 67, type: 'storm_ended', payload: { eventId: 'storm_sep_may10', source: 'donki_sep' } },
      { tick: 95, type: 'scan_complete', payload: { poiId: 'site_b', source: 'mission' } },
      { tick: 97, type: 'submission_claimed', payload: { submissionId: 'field_survey', source: 'gameplay' } },
      { tick: 108, type: 'submission_ready', payload: { submissionId: 'water_watch' } },
      { tick: 112, type: 'note', payload: { note: 'recycler_contamination', source: 'gameplay' } },
      { tick: 118, type: 'report_sent', payload: { poiId: 'site_a', count: 1, source: 'mission' } },
    ]),
  },
  {
    id: 'demo_final',
    name: 'Final hour · one report away from victory',
    description:
      'Two reports delivered by the comms console, the third sample is in your pack, and a final radiation window arrives in three game hours. Send the last report to finish the mission.',
    demo: true,
    tick: 283,
    speed: 10,
    player: { x: -21.5, z: 9.5, facing: Math.PI / 2 },
    resources: { o2: 38, water: 34, food: 44, energy: 30 },
    health: 57,
    radiation: 38,
    nutrition: 52,
    hydration: 49,
    suit: 48,
    dust: 68,
    shelterLocked: false,
    toggles: { lights: true },
    machines: {
      o2_system: machineRow(58, { upgrades: ['o2_efficiency'], repairCount: 2 }),
      water_recycler: machineRow(66, { upgrades: ['water_recovery'], repairCount: 3 }),
      hydroponics: machineRow(72, { upgrades: ['hydro_yield'] }),
      solar_array: machineRow(49, { upgrades: ['solar_tracking'], repairCount: 1 }),
      battery: machineRow(54, { upgrades: ['battery_cells'], repairCount: 1 }),
      power_distributor: machineRow(81, { upgrades: ['dist_efficiency'] }),
      repair_bench: machineRow(88, { upgrades: ['suit_mk2'] }),
      comms_console: machineRow(95),
      storm_shelter: machineRow(100, { upgrades: ['shelter_shield'] }),
    },
    crops: [{ progress: 26 }, { progress: 11 }, null],
    scans: ['site_a', 'site_b', 'site_c'],
    samples: ['site_c'],
    reports: ['site_a', 'site_b'],
    scanLog: [
      { poiId: 'site_a', tick: 31 },
      { poiId: 'site_b', tick: 142 },
      { poiId: 'site_c', tick: 260 },
    ],
    submissions: {
      storm_watch: { status: 'claimed', readyTick: 32, claimedTick: 33 },
      field_survey: { status: 'claimed', readyTick: 143, claimedTick: 144 },
      water_watch: { status: 'claimed', readyTick: 121, claimedTick: 122 },
      science_delivery: { status: 'active', readyTick: null, claimedTick: null },
    },
    supply: { cooldown: 4, pending: null },
    stats: {
      peakDose: 41,
      evas: 5,
      shelterUses: 3,
      repairs: 6,
      upgrades: 9,
      reportsSent: 2,
      submissionsClaimed: 3,
      scans: 3,
      stormsSurvived: 5,
      energyWasted: 18,
      harvests: 7,
    },
    log: seedLog([
      { tick: 6, type: 'storm_started', payload: { eventId: 'storm_gannon_arrival', source: 'donki_cme' } },
      { tick: 12, type: 'storm_ended', payload: { eventId: 'storm_gannon_arrival', source: 'donki_cme' } },
      { tick: 31, type: 'scan_complete', payload: { poiId: 'site_a', source: 'mission' } },
      { tick: 62, type: 'storm_started', payload: { eventId: 'storm_sep_may10', source: 'donki_sep' } },
      { tick: 67, type: 'storm_ended', payload: { eventId: 'storm_sep_may10', source: 'donki_sep' } },
      { tick: 88, type: 'report_sent', payload: { poiId: 'site_a', count: 1, source: 'mission' } },
      { tick: 121, type: 'submission_claimed', payload: { submissionId: 'water_watch', source: 'gameplay' } },
      { tick: 126, type: 'storm_started', payload: { eventId: 'storm_cme_may9', source: 'donki_cme_may9' } },
      { tick: 133, type: 'storm_ended', payload: { eventId: 'storm_cme_may9', source: 'donki_cme_may9' } },
      { tick: 142, type: 'scan_complete', payload: { poiId: 'site_b', source: 'mission' } },
      { tick: 144, type: 'submission_claimed', payload: { submissionId: 'field_survey', source: 'gameplay' } },
      { tick: 182, type: 'storm_started', payload: { eventId: 'storm_gannon_peak', source: 'donki_gst' } },
      { tick: 190, type: 'storm_ended', payload: { eventId: 'storm_gannon_peak', source: 'donki_gst' } },
      { tick: 190, type: 'shelter_used', payload: { eventId: 'storm_gannon_peak', source: 'donki_gst' } },
      { tick: 214, type: 'note', payload: { note: 'solar_tracker_failure', machineId: 'solar_array' } },
      { tick: 218, type: 'machine_repaired', payload: { machineId: 'solar_array' } },
      { tick: 245, type: 'report_sent', payload: { poiId: 'site_b', count: 2, source: 'mission' } },
      { tick: 252, type: 'storm_started', payload: { eventId: 'storm_sep_peak', source: 'donki_sep' } },
      { tick: 259, type: 'storm_ended', payload: { eventId: 'storm_sep_peak', source: 'donki_sep' } },
      { tick: 260, type: 'scan_complete', payload: { poiId: 'site_c', source: 'mission' } },
      { tick: 270, type: 'note', payload: { note: 'battery_fault', machineId: 'battery' } },
    ]),
  },
];

export const PRESET_BY_ID = Object.fromEntries(DEMO_PRESETS.map((p) => [p.id, p]));

export function getPreset(id) {
  return PRESET_BY_ID[id] ?? null;
}

/**
 * Structural + invariant validation. The simulation is deterministic, so we can
 * literally load the preset and run the next four hours to make sure it does not
 * start a death cascade.
 */
export function validatePreset(preset) {
  const errors = [];
  if (!preset || typeof preset !== 'object') return { ok: false, errors: ['Preset is not an object.'] };
  if (typeof preset.tick !== 'number' || preset.tick < 0 || preset.tick > ECONOMY.time.missionTicks) {
    errors.push('tick out of range');
  }
  for (const [id, value] of Object.entries(preset.resources ?? {})) {
    if (!(id in ECONOMY.resources)) errors.push(`unknown resource ${id}`);
    else if (typeof value !== 'number' || value < 0 || value > ECONOMY.resources[id].capacity + 80) {
      errors.push(`resource ${id} out of range`);
    }
  }
  if (!Array.isArray(preset.scans) || !Array.isArray(preset.reports)) errors.push('scans/reports missing');
  for (const id of preset.machines ? Object.keys(preset.machines) : []) {
    if (!MACHINE_IDS.includes(id)) errors.push(`unknown machine ${id}`);
  }
  for (const poiId of preset.samples ?? []) {
    if (!POIS.some((p) => p.id === poiId)) errors.push(`unknown sample ${poiId}`);
    if (!(preset.scans ?? []).includes(poiId)) errors.push(`sample ${poiId} was never scanned`);
  }
  for (const poiId of preset.reports ?? []) {
    if (!(preset.scans ?? []).includes(poiId)) errors.push(`report ${poiId} has no scan`);
    if ((preset.samples ?? []).includes(poiId)) errors.push(`report ${poiId} is also an unsent sample`);
  }
  for (const [id, sub] of Object.entries(preset.submissions ?? {})) {
    if (!SUBMISSIONS.some((s) => s.id === id)) errors.push(`unknown submission ${id}`);
    if (!['active', 'ready', 'claimed', 'missed'].includes(sub.status)) errors.push(`bad submission status ${id}`);
  }
  const nextStorm = EVENTS.find((e) => e.archetype === 'radiation_window' && e.onset > (preset.tick ?? 0));
  if (preset.demo && (!nextStorm || nextStorm.onset - preset.tick > 6)) {
    errors.push('demo preset is not close to a radiation window');
  }
  if (typeof preset.health === 'number' && preset.health < 25) errors.push('health too low for a demo');
  if ((preset.resources?.o2 ?? 100) < 10) errors.push('O2 too low for a demo');

  if (!errors.length) {
    const sim = new GameSim();
    try {
      sim.loadPreset(preset);
      sim.setPresence({ outside: false, inShelter: false });
      for (let i = 0; i < 4; i += 1) {
        sim.tick();
        if (sim.state.over && sim.state.over !== 'victory') {
          errors.push(`preset dies within four ticks (${sim.state.cause})`);
          break;
        }
      }
    } catch (error) {
      errors.push(`preset threw while loading: ${error.message}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function loadDemoPreset(sim, id) {
  const preset = getPreset(id);
  if (!preset) throw new Error(`Unknown preset ${id}`);
  const result = validatePreset(preset);
  if (!result.ok) throw new Error(`Invalid preset ${id}: ${result.errors.join('; ')}`);
  sim.loadPreset(preset);
  return preset;
}
