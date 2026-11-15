import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameSim } from '../src/core/sim.js';
import {
  BROKEN_KEY,
  MISSION_ID,
  SAVE_KEY,
  SAVE_VERSION,
  applyRecord,
  buildRecord,
  clearSave,
  isValidRecord,
  readSave,
  writeSave,
} from '../src/core/save-game.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
    this.failWrites = false;
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    if (this.failWrites) throw new Error('quota');
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

const makeApp = () => ({
  player: { x: 1.5, z: 4.5 },
  facing: 1.2,
  speed: 1,
  tickAccum: 0.25,
});

const makeRecord = (ticks = 3) => {
  const sim = new GameSim();
  for (let i = 0; i < ticks; i += 1) {
    sim.tick();
    sim.drainNotifications();
  }
  const app = makeApp();
  return { sim, app, record: buildRecord({ sim, app }) };
};

test('save record round-trips through local storage', () => {
  const { record } = makeRecord();
  const storage = new MemoryStorage();
  assert.equal(writeSave(record, storage), true);
  const result = readSave(storage);
  assert.equal(result.error, null);
  assert.deepEqual(result.record, record);
});

test('applyRecord restores the simulation and the run fields', () => {
  const { sim, app, record } = makeRecord();
  const storage = new MemoryStorage();
  writeSave(record, storage);
  const result = readSave(storage);
  assert.equal(result.error, null);

  const restoredSim = new GameSim();
  const restoredApp = {};
  assert.equal(applyRecord(result.record, { sim: restoredSim, app: restoredApp }), true);
  assert.deepEqual(restoredSim.stateSnapshot(), sim.stateSnapshot());
  assert.deepEqual(restoredApp.player, app.player);
  assert.equal(restoredApp.facing, app.facing);
  assert.equal(restoredApp.speed, app.speed);
  assert.equal(restoredApp.tickAccum, app.tickAccum);
  assert.equal(restoredApp.freeplay, false);
});

test('corrupt JSON is quarantined and never resumed', () => {
  const storage = new MemoryStorage({ [SAVE_KEY]: '{not json' });
  const result = readSave(storage);
  assert.equal(result.record, null);
  assert.equal(result.error, 'corrupt');
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(storage.getItem(BROKEN_KEY), '{not json');
});

test('unknown save versions are discarded with a warning state', () => {
  const storage = new MemoryStorage({
    [SAVE_KEY]: JSON.stringify({ version: SAVE_VERSION + 1, missions: {} }),
  });
  const result = readSave(storage);
  assert.equal(result.error, 'version');
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.ok(storage.getItem(BROKEN_KEY));
});

test('records with missing fields are invalid', () => {
  const { record } = makeRecord();
  const broken = JSON.parse(JSON.stringify(record));
  delete broken.player;
  const storage = new MemoryStorage({
    [SAVE_KEY]: JSON.stringify({ version: SAVE_VERSION, missions: { [MISSION_ID]: broken } }),
  });
  assert.equal(isValidRecord(broken), false);
  const result = readSave(storage);
  assert.equal(result.error, 'corrupt');
});

test('victory records keep the completed run and apply freeplay state', () => {
  const { sim, app } = makeRecord();
  sim.state.over = 'victory';
  sim.state.cause = 'mission_complete';
  sim.state.reports = ['site_a', 'site_b', 'site_c'];
  const record = buildRecord({ sim, app });
  assert.equal(record.status, 'victory');

  const storage = new MemoryStorage();
  assert.equal(writeSave(record, storage), true);
  const result = readSave(storage);
  assert.equal(result.error, null);

  const restoredSim = new GameSim();
  const restoredApp = {};
  assert.equal(applyRecord(result.record, { sim: restoredSim, app: restoredApp }), true);
  assert.equal(restoredSim.state.over, 'victory');
  assert.equal(restoredApp.freeplay, true);
});

test('clearSave removes the mission and leaves no resumable record', () => {
  const { record } = makeRecord();
  const storage = new MemoryStorage();
  writeSave(record, storage);
  assert.equal(clearSave(storage), true);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(readSave(storage).error, 'empty');
});

test('a failed write leaves the previous valid save untouched', () => {
  const { record } = makeRecord();
  const storage = new MemoryStorage();
  assert.equal(writeSave(record, storage), true);
  const previous = storage.getItem(SAVE_KEY);

  storage.failWrites = true;
  const { sim, app } = makeRecord(4);
  const next = buildRecord({ sim, app });
  assert.equal(writeSave(next, storage), false);
  assert.equal(storage.getItem(SAVE_KEY), previous);
  assert.equal(readSave(storage).error, null);
});

test('an unavailable storage never throws', () => {
  const blocked = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  const { record } = makeRecord();
  assert.equal(readSave(blocked).error, 'unavailable');
  assert.equal(readSave(null).error, 'unavailable');
  assert.equal(writeSave(record, blocked), false);
  assert.equal(clearSave(blocked), false);
});

test('records with inconsistent tick or status are rejected', () => {
  const { record } = makeRecord();
  const badTick = JSON.parse(JSON.stringify(record));
  badTick.tick += 1;
  assert.equal(isValidRecord(badTick), false);

  const badStatus = JSON.parse(JSON.stringify(record));
  badStatus.status = 'victory';
  assert.equal(isValidRecord(badStatus), false);
});
