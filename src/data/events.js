/**
 * Scheduled event rows.
 *
 * Five archetypes, exactly as in the design: machine failure, production drop,
 * consumption spike, radiation window and communications outage. Rows are
 * data; `GameSim` applies them with a single code path. Intensity is three
 * scalars (start / peak / end) interpolated linearly over the duration.
 *
 * Radiation windows point at archived DONKI events. Everything else is marked
 * SIMULATED because its timing and severity are gameplay tuning.
 */

const event = (row) => ({
  targetType: 'none',
  targetId: null,
  intensity: { start: 1, peak: 1, end: 1 },
  source: 'gameplay',
  ...row,
});

export const EVENTS = [
  event({
    id: 'storm_gannon_arrival',
    nameKey: 'event.storm_gannon_arrival.name',
    descriptionKey: 'event.storm_gannon_arrival.desc',
    archetype: 'radiation_window',
    onset: 6,
    duration: 6,
    intensity: { start: 3, peak: 12, end: 5 },
    source: 'donki_cme',
  }),
  event({
    id: 'recycler_fault',
    nameKey: 'event.recycler_fault.name',
    descriptionKey: 'event.recycler_fault.desc',
    archetype: 'machine_failure',
    targetType: 'machine',
    targetId: 'water_recycler',
    onset: 18,
    duration: 8,
    intensity: { start: 0, peak: 0, end: 0 },
    source: 'gameplay',
  }),
  event({
    id: 'regolith_dust',
    nameKey: 'event.regolith_dust.name',
    descriptionKey: 'event.regolith_dust.desc',
    archetype: 'production_drop',
    targetType: 'machine',
    targetId: 'solar_array',
    onset: 30,
    duration: 10,
    intensity: { start: 0.6, peak: 0.3, end: 0.55 },
    source: 'gameplay',
  }),
  event({
    id: 'o2_leak',
    nameKey: 'event.o2_leak.name',
    descriptionKey: 'event.o2_leak.desc',
    archetype: 'consumption_spike',
    targetType: 'resource',
    targetId: 'o2',
    onset: 46,
    duration: 5,
    intensity: { start: 1.4, peak: 2.2, end: 1.5 },
    source: 'gameplay',
  }),
  event({
    id: 'storm_sep_may10',
    nameKey: 'event.storm_sep_may10.name',
    descriptionKey: 'event.storm_sep_may10.desc',
    archetype: 'radiation_window',
    onset: 62,
    duration: 5,
    intensity: { start: 2.5, peak: 8, end: 3 },
    source: 'donki_sep',
  }),
  event({
    id: 'hydro_blight',
    nameKey: 'event.hydro_blight.name',
    descriptionKey: 'event.hydro_blight.desc',
    archetype: 'machine_failure',
    targetType: 'machine',
    targetId: 'hydroponics',
    onset: 78,
    duration: 8,
    intensity: { start: 0, peak: 0, end: 0 },
    source: 'gameplay',
  }),
  event({
    id: 'dsn_outage_1',
    nameKey: 'event.dsn_outage_1.name',
    descriptionKey: 'event.dsn_outage_1.desc',
    archetype: 'comms_outage',
    onset: 96,
    duration: 6,
    intensity: { start: 1, peak: 1, end: 1 },
    source: 'gameplay',
  }),
  event({
    id: 'recycler_contamination',
    nameKey: 'event.recycler_contamination.name',
    descriptionKey: 'event.recycler_contamination.desc',
    archetype: 'production_drop',
    targetType: 'machine',
    targetId: 'water_recycler',
    onset: 112,
    duration: 7,
    intensity: { start: 0.55, peak: 0.2, end: 0.5 },
    source: 'gameplay',
  }),
  event({
    id: 'storm_cme_may9',
    nameKey: 'event.storm_cme_may9.name',
    descriptionKey: 'event.storm_cme_may9.desc',
    archetype: 'radiation_window',
    onset: 126,
    duration: 7,
    intensity: { start: 4, peak: 15, end: 6 },
    source: 'donki_cme_may9',
  }),
  event({
    id: 'o2_system_fault',
    nameKey: 'event.o2_system_fault.name',
    descriptionKey: 'event.o2_system_fault.desc',
    archetype: 'machine_failure',
    targetType: 'machine',
    targetId: 'o2_system',
    onset: 144,
    duration: 7,
    intensity: { start: 0, peak: 0, end: 0 },
    source: 'gameplay',
  }),
  event({
    id: 'power_surge',
    nameKey: 'event.power_surge.name',
    descriptionKey: 'event.power_surge.desc',
    archetype: 'consumption_spike',
    targetType: 'resource',
    targetId: 'energy',
    onset: 160,
    duration: 4,
    intensity: { start: 1.3, peak: 2, end: 1.2 },
    source: 'gameplay',
  }),
  event({
    id: 'storm_gannon_peak',
    nameKey: 'event.storm_gannon_peak.name',
    descriptionKey: 'event.storm_gannon_peak.desc',
    archetype: 'radiation_window',
    onset: 182,
    duration: 8,
    intensity: { start: 5, peak: 18, end: 7 },
    source: 'donki_gst',
  }),
  event({
    id: 'dsn_outage_2',
    nameKey: 'event.dsn_outage_2.name',
    descriptionKey: 'event.dsn_outage_2.desc',
    archetype: 'comms_outage',
    onset: 200,
    duration: 8,
    intensity: { start: 1, peak: 1, end: 1 },
    source: 'gameplay',
  }),
  event({
    id: 'solar_fault',
    nameKey: 'event.solar_fault.name',
    descriptionKey: 'event.solar_fault.desc',
    archetype: 'machine_failure',
    targetType: 'machine',
    targetId: 'solar_array',
    onset: 214,
    duration: 6,
    intensity: { start: 0, peak: 0, end: 0 },
    source: 'gameplay',
  }),
  event({
    id: 'hydroponics_blight_2',
    nameKey: 'event.hydroponics_blight_2.name',
    descriptionKey: 'event.hydroponics_blight_2.desc',
    archetype: 'production_drop',
    targetType: 'machine',
    targetId: 'hydroponics',
    onset: 232,
    duration: 10,
    intensity: { start: 0.5, peak: 0.15, end: 0.45 },
    source: 'gameplay',
  }),
  event({
    id: 'water_spike',
    nameKey: 'event.water_spike.name',
    descriptionKey: 'event.water_spike.desc',
    archetype: 'consumption_spike',
    targetType: 'resource',
    targetId: 'water',
    onset: 240,
    duration: 5,
    intensity: { start: 1.3, peak: 2, end: 1.4 },
    source: 'gameplay',
  }),
  event({
    id: 'storm_sep_peak',
    nameKey: 'event.storm_sep_peak.name',
    descriptionKey: 'event.storm_sep_peak.desc',
    archetype: 'radiation_window',
    onset: 252,
    duration: 7,
    intensity: { start: 3, peak: 10, end: 4 },
    source: 'donki_sep',
  }),
  event({
    id: 'battery_fault',
    nameKey: 'event.battery_fault.name',
    descriptionKey: 'event.battery_fault.desc',
    archetype: 'machine_failure',
    targetType: 'machine',
    targetId: 'battery',
    onset: 270,
    duration: 6,
    intensity: { start: 0, peak: 0, end: 0 },
    source: 'gameplay',
  }),
  event({
    id: 'storm_final',
    nameKey: 'event.storm_final.name',
    descriptionKey: 'event.storm_final.desc',
    archetype: 'radiation_window',
    onset: 286,
    duration: 6,
    intensity: { start: 4, peak: 14, end: 5 },
    source: 'donki_cme',
  }),
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((row) => [row.id, row]));

export const EVENT_ARCHETYPES = [
  'machine_failure',
  'production_drop',
  'consumption_spike',
  'radiation_window',
  'comms_outage',
];

export function getEvent(id) {
  return EVENT_BY_ID[id] ?? null;
}

/** Piecewise-linear start -> peak -> end shape, progress in [0, 1]. */
export function eventIntensityAt(row, progress) {
  const p = Math.min(1, Math.max(0, progress));
  if (p <= 0.5) {
    return row.intensity.start + (row.intensity.peak - row.intensity.start) * (p / 0.5);
  }
  return row.intensity.peak + (row.intensity.end - row.intensity.peak) * ((p - 0.5) / 0.5);
}

export function nextEventAfter(tick, events = EVENTS) {
  return events.find((row) => row.onset > tick) ?? null;
}
