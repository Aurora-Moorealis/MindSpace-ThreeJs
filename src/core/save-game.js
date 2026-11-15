/**
 * Local mission save storage.
 *
 * One versioned localStorage key holds a map keyed by mission id. The module is
 * storage-agnostic on purpose: tests pass an in-memory object and the browser
 * passes window.localStorage. Nothing here imports DOM or Three.js.
 */

import { ECONOMY } from '../data/economy.js';

export const SAVE_KEY = 'outpost-lunar.save.v1';
export const BROKEN_KEY = `${SAVE_KEY}.broken`;
export const SAVE_VERSION = 1;
export const MISSION_ID = 'artemis_ridge';
export const SAVE_STATUS = Object.freeze({
  IN_PROGRESS: 'in_progress',
  VICTORY: 'victory',
});

const VALID_SPEEDS = ECONOMY.time.speeds;

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Moves a broken payload aside so the next save starts from a clean slate. */
function quarantine(storage, raw) {
  try {
    storage.setItem(BROKEN_KEY, raw);
  } catch {
    // A broken copy is best effort; the main key must still be cleared.
  }
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Nothing else can be done when the storage itself is unavailable.
  }
}

/**
 * Shape validation for one mission record. Deep simulation compatibility (ids
 * of machines/POIs/submissions) is checked again by GameSim.restore().
 */
export function isValidRecord(record) {
  if (!isObject(record)) return false;
  if (record.version !== SAVE_VERSION) return false;
  if (record.missionId !== MISSION_ID) return false;
  if (!Object.values(SAVE_STATUS).includes(record.status)) return false;
  if (typeof record.savedAt !== 'string' || record.savedAt.length === 0) return false;
  if (!Number.isInteger(record.tick) || record.tick < 0) return false;
  if (!VALID_SPEEDS.includes(record.speed)) return false;
  if (!isFiniteNumber(record.tickAccum) || record.tickAccum < 0) return false;

  const player = record.player;
  if (!isObject(player)) return false;
  if (!isFiniteNumber(player.x) || !isFiniteNumber(player.z) || !isFiniteNumber(player.facing)) {
    return false;
  }

  const sim = record.sim;
  if (!isObject(sim)) return false;
  if (!isObject(sim.state)) return false;
  if (!Array.isArray(sim.log)) return false;
  if (!isObject(sim.presence)) return false;
  if (typeof sim.presence.outside !== 'boolean') return false;
  if (typeof sim.presence.inShelter !== 'boolean') return false;
  if (!sim.log.every((entry) => isObject(entry) && Number.isInteger(entry.tick) && typeof entry.type === 'string')) {
    return false;
  }

  if (record.tick !== sim.state.tick) return false;
  if (record.speed !== sim.state.speed) return false;
  if (record.status === SAVE_STATUS.IN_PROGRESS && sim.state.over !== null) return false;
  if (record.status === SAVE_STATUS.VICTORY && sim.state.over !== 'victory') return false;
  return true;
}

/**
 * Builds a JSON-safe record for the current run. `status` defaults to victory
 * when the run is already won and to in-progress otherwise.
 */
export function buildRecord({ sim, app, status = null } = {}) {
  if (!sim || !app) return null;
  const resolvedStatus =
    status ?? (sim.state.over === 'victory' ? SAVE_STATUS.VICTORY : SAVE_STATUS.IN_PROGRESS);
  return {
    version: SAVE_VERSION,
    missionId: MISSION_ID,
    status: resolvedStatus,
    savedAt: new Date().toISOString(),
    tick: sim.state.tick,
    speed: app.speed ?? sim.state.speed,
    tickAccum: Number.isFinite(app.tickAccum) ? app.tickAccum : 0,
    player: {
      x: app.player?.x ?? 0,
      z: app.player?.z ?? 0,
      facing: app.facing ?? 0,
    },
    sim: sim.snapshot(),
  };
}

/**
 * Reads and validates the saved mission.
 * Returns { record, error } where error is one of: empty, unavailable,
 * corrupt, version.
 */
export function readSave(storage = defaultStorage()) {
  if (!storage) return { record: null, error: 'unavailable' };

  let raw = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return { record: null, error: 'unavailable' };
  }
  if (!raw) return { record: null, error: 'empty' };

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    quarantine(storage, raw);
    return { record: null, error: 'corrupt' };
  }
  if (!isObject(parsed)) {
    quarantine(storage, raw);
    return { record: null, error: 'corrupt' };
  }
  if (parsed.version !== SAVE_VERSION) {
    quarantine(storage, raw);
    return { record: null, error: 'version' };
  }
  if (!isObject(parsed.missions)) {
    quarantine(storage, raw);
    return { record: null, error: 'corrupt' };
  }

  const record = parsed.missions[MISSION_ID];
  if (!record) return { record: null, error: 'empty' };
  if (!isValidRecord(record)) {
    quarantine(storage, raw);
    return { record: null, error: 'corrupt' };
  }
  return { record, error: null };
}

/**
 * Writes one mission record. Other missions in the same payload are preserved.
 * Returns false instead of throwing when storage is unavailable or full.
 */
export function writeSave(record, storage = defaultStorage()) {
  if (!storage || !isValidRecord(record)) return false;

  const envelope = { version: SAVE_VERSION, missions: {} };
  let raw = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
  if (raw) {
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      quarantine(storage, raw);
    }
    if (parsed) {
      if (parsed.version !== SAVE_VERSION || !isObject(parsed.missions)) {
        quarantine(storage, raw);
      } else {
        envelope.missions = { ...parsed.missions };
      }
    }
  }

  envelope.missions[record.missionId] = record;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the saved mission. The key is deleted when no mission remains.
 * Returns false only when the storage rejects the operation.
 */
export function clearSave(storage = defaultStorage(), missionId = MISSION_ID) {
  if (!storage) return false;

  let raw = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
  if (!raw) return true;

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      storage.removeItem(SAVE_KEY);
      return true;
    } catch {
      return false;
    }
  }
  if (!isObject(parsed) || parsed.version !== SAVE_VERSION || !isObject(parsed.missions)) {
    try {
      storage.removeItem(SAVE_KEY);
      return true;
    } catch {
      return false;
    }
  }
  if (!parsed.missions[missionId]) return true;

  delete parsed.missions[missionId];
  try {
    if (Object.keys(parsed.missions).length === 0) storage.removeItem(SAVE_KEY);
    else storage.setItem(SAVE_KEY, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

/**
 * Restores a record into a GameSim and the app-facing run fields. The caller
 * still owns the scene transition, presence recalc and freeplay decision.
 */
export function applyRecord(record, { sim, app } = {}) {
  if (!sim || !isValidRecord(record)) return false;
  if (!sim.restore(record.sim)) return false;

  if (app) {
    app.player = { x: record.player.x, z: record.player.z };
    app.facing = record.player.facing;
    app.speed = record.speed;
    app.tickAccum = record.tickAccum;
    app.freeplay = record.status === SAVE_STATUS.VICTORY;
    app.demo = false;
    app.presetId = null;
    app.scan = null;
    app.panel = null;
    app.paused = false;
    app.nearest = null;
    app.interaction = null;
    app.objective = null;
    app.objectiveId = null;
    app.wasOutside = false;
    app.keys?.clear?.();
  }
  return true;
}

/** Small display summary for the title screen. */
export function describeSave(record) {
  if (!isValidRecord(record)) return null;
  return {
    status: record.status,
    tick: record.tick,
    speed: record.speed,
    savedAt: record.savedAt,
  };
}
