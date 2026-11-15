/**
 * DataAudit — the safety net for the data-driven content.
 *
 * Runs at boot in development (and from `npm run audit` in CI/pre-commit). It
 * checks ids, references, ranges, provenance completeness and demo preset
 * invariants. It is deliberately dependency-free apart from the data modules.
 */

import { ECONOMY } from '../data/economy.js';
import { EVENTS, EVENT_ARCHETYPES } from '../data/events.js';
import { MACHINES } from '../data/machines.js';
import { POIS } from '../data/pois.js';
import { SUBMISSIONS, CONDITION_TYPES } from '../data/submissions.js';
import { SOURCES } from '../data/sources.js';
import { STRINGS } from '../data/strings.js';
import { DEMO_PRESETS, validatePreset } from '../data/demo-states.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const RESOURCE_IDS = ['o2', 'water', 'food', 'energy'];
const EFFECT_STATS = [
  'o2_output',
  'water_output',
  'food_output',
  'solar_output',
  'battery_capacity',
  'power_draw',
  'water_input',
  'hydro_power',
  'dust_rate',
  'repair_time',
  'suit_shield',
  'movement_speed',
  'machine_wear',
  'solar_wear',
  'suit_decay',
  'submission_reward',
  'forecast_depth',
  'shelter_shield',
  'shelter_base',
];

/** +1 when a higher value is better, -1 when a lower value is better. */
const STAT_DIRECTION = {
  o2_output: 1,
  water_output: 1,
  food_output: 1,
  solar_output: 1,
  battery_capacity: 1,
  movement_speed: 1,
  submission_reward: 1,
  forecast_depth: 1,
  power_draw: -1,
  water_input: -1,
  hydro_power: -1,
  dust_rate: -1,
  repair_time: -1,
  suit_shield: -1,
  machine_wear: -1,
  solar_wear: -1,
  suit_decay: -1,
  shelter_shield: -1,
  shelter_base: -1,
};

const effectDelta = (effect) => {
  if (typeof effect?.add === 'number') return effect.add;
  if (typeof effect?.mult === 'number') return effect.mult - 1;
  return 0;
};

const validateEffect = (key, effect, role, errors) => {
  if (!EFFECT_STATS.includes(effect?.stat)) {
    errors.push(`upgrade ${key}: unknown ${role} stat`);
    return;
  }
  const { mult, add } = effect;
  if (typeof mult !== 'number' && typeof add !== 'number') {
    errors.push(`upgrade ${key}: ${role} has no mult/add`);
    return;
  }
  if (typeof mult === 'number' && mult <= 0) errors.push(`upgrade ${key}: ${role} mult must be > 0`);
  if (effectDelta(effect) === 0) errors.push(`upgrade ${key}: ${role} has no effect`);
  const direction = STAT_DIRECTION[effect.stat] ?? 0;
  const sign = Math.sign(effectDelta(effect)) * direction;
  if (role === 'effect' && sign < 0) errors.push(`upgrade ${key}: effect makes ${effect.stat} worse`);
  if (role === 'drawback' && sign > 0) errors.push(`upgrade ${key}: drawback makes ${effect.stat} better`);
};

export function auditData() {
  const errors = [];
  const warnings = [];
  const counts = {
    machines: Object.keys(MACHINES).length,
    events: EVENTS.length,
    submissions: SUBMISSIONS.length,
    pois: POIS.length,
    sources: Object.keys(SOURCES).length,
    presets: DEMO_PRESETS.length,
    strings: Object.keys(STRINGS).length,
  };

  // Upgrade stat metadata ----------------------------------------------------
  for (const stat of EFFECT_STATS) {
    if (!(stat in STAT_DIRECTION)) errors.push(`audit: no direction declared for stat ${stat}`);
  }

  // Sources -----------------------------------------------------------------
  for (const [id, source] of Object.entries(SOURCES)) {
    if (source.id !== id) errors.push(`source ${id}: id mismatch`);
    if (!source.label) errors.push(`source ${id}: missing label`);
    if (!ISO_DATE.test(source.date_archived ?? '')) errors.push(`source ${id}: bad date_archived`);
    if (source.real_data) {
      if (!source.url) errors.push(`source ${id}: real_data but no url`);
      if (!source.note) warnings.push(`source ${id}: real_data without note`);
    }
    if (source.url && !/^https?:\/\//.test(source.url)) errors.push(`source ${id}: url must be http(s)`);
  }

  // Economy -----------------------------------------------------------------
  for (const id of RESOURCE_IDS) {
    const cfg = ECONOMY.resources[id];
    if (!cfg) {
      errors.push(`economy: missing resource ${id}`);
      continue;
    }
    if (cfg.capacity <= 0) errors.push(`economy.${id}: capacity must be > 0`);
    if (cfg.start < 0 || cfg.start > cfg.capacity) errors.push(`economy.${id}: start out of range`);
    if (!SOURCES[cfg.source]) errors.push(`economy.${id}: unknown source ${cfg.source}`);
  }
  if (ECONOMY.radiation.start < 0 || ECONOMY.radiation.start > 100) errors.push('economy.radiation.start out of range');
  if (ECONOMY.radiation.safeDose >= ECONOMY.radiation.deathDose) errors.push('economy.radiation: threshold order');
  if (!SOURCES[ECONOMY.radiation.source]) errors.push('economy.radiation: unknown source');
  if (!(ECONOMY.radiation.msvPerPoint > 0)) errors.push('economy.radiation: msvPerPoint must be > 0');
  if (Math.abs(ECONOMY.radiation.deathDose * ECONOMY.radiation.msvPerPoint - ECONOMY.radiation.msvLimit) > 0.001) {
    errors.push('economy.radiation: msvLimit must equal deathDose * msvPerPoint');
  }

  if (!ECONOMY.comms) {
    errors.push('economy: missing comms block');
  } else {
    const comms = ECONOMY.comms;
    if (!(comms.relayIntervalTicks > 0)) errors.push('economy.comms: relayIntervalTicks must be > 0');
    if (!(comms.relayPhaseTicks >= 0)) errors.push('economy.comms: relayPhaseTicks must be >= 0');
    if (comms.relayPhaseTicks >= comms.relayIntervalTicks) {
      errors.push('economy.comms: relayPhaseTicks must be < relayIntervalTicks');
    }
    if (!(comms.lightDelayOneWaySeconds > 0)) errors.push('economy.comms: lightDelayOneWaySeconds must be > 0');
  }

  if (!ECONOMY.hydroponics) {
    errors.push('economy: missing hydroponics block');
  } else {
    const hydro = ECONOMY.hydroponics;
    if (!(hydro.trays >= 1)) errors.push('economy.hydroponics: trays must be >= 1');
    if (!(hydro.cycleTicks >= 1)) errors.push('economy.hydroponics: cycleTicks must be >= 1');
    if (!(hydro.stages >= 1)) errors.push('economy.hydroponics: stages must be >= 1');
    if (hydro.stages > hydro.cycleTicks) errors.push('economy.hydroponics: stages must be <= cycleTicks');
    if (!(hydro.yieldFood > 0)) errors.push('economy.hydroponics: yieldFood must be > 0');
    for (const [res] of Object.entries(hydro.plantCost ?? {})) {
      if (!RESOURCE_IDS.includes(res)) errors.push(`economy.hydroponics: unknown plant cost ${res}`);
    }
  }
  if (MACHINES.hydroponics?.outputs?.food !== undefined) {
    errors.push('machine hydroponics: continuous food output must be removed (harvest the trays instead)');
  }
  if (ECONOMY.time.missionTicks % ECONOMY.time.solTicks !== 0) warnings.push('mission length is not a whole number of sols');
  if (!ECONOMY.power.ladder.includes('o2_system')) errors.push('power ladder must include o2_system');
  if (ECONOMY.power.ladder[ECONOMY.power.ladder.length - 1] !== 'o2_system') {
    errors.push('O2 must be the last system shed');
  }

  // Machines ----------------------------------------------------------------
  const machineIds = Object.keys(MACHINES);
  if (new Set(machineIds).size !== machineIds.length) errors.push('duplicate machine id');
  const upgradeKeys = new Set();
  for (const [id, row] of Object.entries(MACHINES)) {
    if (row.id !== id) errors.push(`machine ${id}: id mismatch`);
    if (!STRINGS[row.nameKey]) errors.push(`machine ${id}: missing name string`);
    if (!STRINGS[row.descriptionKey]) errors.push(`machine ${id}: missing description string`);
    if (!Array.isArray(row.position) || row.position.length !== 3) errors.push(`machine ${id}: bad position`);
    if (row.power < 0) errors.push(`machine ${id}: negative power`);
    if (!Array.isArray(row.sourceRefs) || !row.sourceRefs.length) errors.push(`machine ${id}: no sourceRefs`);
    for (const ref of row.sourceRefs ?? []) if (!SOURCES[ref]) errors.push(`machine ${id}: unknown sourceRef ${ref}`);
    if (row.real_data && !row.sourceRefs?.length) errors.push(`machine ${id}: real_data without sources`);
    for (const upgrade of row.upgrades ?? []) {
      const key = `${id}:${upgrade.id}`;
      if (upgradeKeys.has(key)) errors.push(`duplicate upgrade ${key}`);
      upgradeKeys.add(key);
      if (!STRINGS[upgrade.nameKey]) errors.push(`upgrade ${key}: missing name string`);
      if (!STRINGS[upgrade.descriptionKey]) errors.push(`upgrade ${key}: missing description string`);
      if (!STRINGS[upgrade.drawbackKey]) errors.push(`upgrade ${key}: missing drawback string`);
      if (upgrade.cost <= 0) errors.push(`upgrade ${key}: cost must be > 0`);
      validateEffect(key, upgrade.effect, 'effect', errors);
      validateEffect(key, upgrade.drawback, 'drawback', errors);
      if (upgrade.drawback?.stat === upgrade.effect?.stat) {
        errors.push(`upgrade ${key}: drawback must target a different stat`);
      }
    }
    for (const [res] of Object.entries(row.inputs ?? {})) {
      if (!RESOURCE_IDS.includes(res)) errors.push(`machine ${id}: unknown input ${res}`);
    }
    for (const [res] of Object.entries(row.outputs ?? {})) {
      if (!RESOURCE_IDS.includes(res)) errors.push(`machine ${id}: unknown output ${res}`);
    }
    if (row.throttle && !RESOURCE_IDS.includes(row.throttle.resource)) {
      errors.push(`machine ${id}: bad throttle resource`);
    }
  }

  // Events ------------------------------------------------------------------
  const eventIds = new Set();
  let lastOnset = -1;
  for (const row of EVENTS) {
    if (eventIds.has(row.id)) errors.push(`duplicate event ${row.id}`);
    eventIds.add(row.id);
    if (!EVENT_ARCHETYPES.includes(row.archetype)) errors.push(`event ${row.id}: bad archetype`);
    if (!STRINGS[row.nameKey]) errors.push(`event ${row.id}: missing name string`);
    if (!STRINGS[row.descriptionKey]) errors.push(`event ${row.id}: missing description string`);
    if (row.onset < 0 || row.onset >= ECONOMY.time.missionTicks) errors.push(`event ${row.id}: onset out of range`);
    if (row.duration <= 0) errors.push(`event ${row.id}: duration must be > 0`);
    if (row.onset < lastOnset) warnings.push(`event ${row.id}: list is not sorted by onset`);
    lastOnset = row.onset;
    if (!SOURCES[row.source]) errors.push(`event ${row.id}: unknown source`);
    if (row.targetType === 'machine' && !MACHINES[row.targetId]) errors.push(`event ${row.id}: unknown machine target`);
    if (row.targetType === 'resource' && !RESOURCE_IDS.includes(row.targetId)) {
      errors.push(`event ${row.id}: unknown resource target`);
    }
    for (const key of ['start', 'peak', 'end']) {
      if (typeof row.intensity?.[key] !== 'number') errors.push(`event ${row.id}: missing intensity.${key}`);
    }
    if (row.archetype === 'radiation_window') {
      const source = SOURCES[row.source];
      if (!source?.real_data) warnings.push(`radiation event ${row.id}: source is simulated`);
      if (row.intensity.peak < 1) errors.push(`radiation event ${row.id}: peak below normal dose`);
    }
  }
  if (!EVENTS.some((e) => e.archetype === 'radiation_window' && e.onset <= 12)) {
    errors.push('no early radiation window for onboarding');
  }
  if (!EVENTS.some((e) => e.id === 'storm_gannon_arrival')) warnings.push('first storm row renamed; tutorials may refer to it');

  // Submissions -------------------------------------------------------------
  const subIds = new Set();
  for (const row of SUBMISSIONS) {
    if (subIds.has(row.id)) errors.push(`duplicate submission ${row.id}`);
    subIds.add(row.id);
    if (!CONDITION_TYPES.includes(row.condition)) errors.push(`submission ${row.id}: bad condition`);
    if (!STRINGS[row.nameKey]) errors.push(`submission ${row.id}: missing name string`);
    if (!STRINGS[row.descriptionKey]) errors.push(`submission ${row.id}: missing description string`);
    if (!SOURCES[row.source]) errors.push(`submission ${row.id}: unknown source`);
    for (const [res, amount] of Object.entries(row.reward ?? {})) {
      if (!RESOURCE_IDS.includes(res)) errors.push(`submission ${row.id}: unknown reward ${res}`);
      if (amount <= 0) errors.push(`submission ${row.id}: reward must be > 0`);
    }
    if (row.condition === 'reading_before_event' && !EVENTS.some((e) => e.id === row.params.eventId)) {
      errors.push(`submission ${row.id}: unknown event ${row.params.eventId}`);
    }
    if (row.condition === 'resource_below_and_repaired' && !MACHINES[row.params.machineId]) {
      errors.push(`submission ${row.id}: unknown machine ${row.params.machineId}`);
    }
    if (row.condition === 'counter_reached' && !['scans', 'reports'].includes(row.params.counter)) {
      errors.push(`submission ${row.id}: unknown counter ${row.params.counter}`);
    }
  }

  // POIs --------------------------------------------------------------------
  const poiIds = new Set();
  for (const poi of POIS) {
    if (poiIds.has(poi.id)) errors.push(`duplicate poi ${poi.id}`);
    poiIds.add(poi.id);
    if (!STRINGS[poi.nameKey] || !STRINGS[poi.descriptionKey] || !STRINGS[poi.scienceKey]) {
      errors.push(`poi ${poi.id}: missing string`);
    }
    if (!STRINGS[poi.sampleKey] || !STRINGS[poi.reportKey]) errors.push(`poi ${poi.id}: missing sample/report string`);
    if (!Array.isArray(poi.position) || poi.position.length !== 3) errors.push(`poi ${poi.id}: bad position`);
    if (!SOURCES[poi.source]) errors.push(`poi ${poi.id}: unknown source`);
  }

  // Presets -----------------------------------------------------------------
  for (const preset of DEMO_PRESETS) {
    const result = validatePreset(preset);
    if (!result.ok) errors.push(`preset ${preset.id}: ${result.errors.join('; ')}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    counts,
  };
}
