import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameSim } from '../src/core/sim.js';
import { LOG_TYPES } from '../src/core/event-log.js';
import { DEMO_PRESETS, validatePreset } from '../src/data/demo-states.js';
import { EVENTS } from '../src/data/events.js';
import { ECONOMY } from '../src/data/economy.js';

const settle = (sim, ticks, presence = { outside: false, inShelter: false }) => {
  sim.setPresence(presence);
  for (let i = 0; i < ticks; i += 1) {
    sim.tick();
    sim.drainNotifications();
    if (sim.state.over) break;
  }
};

test('tick 0 starts with the designed stock and no victory', () => {
  const sim = new GameSim();
  assert.equal(sim.state.tick, 0);
  assert.equal(sim.state.resources.o2, ECONOMY.resources.o2.start);
  assert.equal(sim.state.health, 100);
  assert.equal(sim.state.over, null);
  assert.equal(sim.getDoseRate(), 0);
});

test('simulation is deterministic for identical action sequences', () => {
  const a = new GameSim();
  const b = new GameSim();
  for (const sim of [a, b]) {
    sim.setPresence({ outside: false, inShelter: false });
    for (let i = 0; i < 40; i += 1) {
      sim.tick();
      sim.drainNotifications();
    }
  }
  assert.deepEqual(a.stateSnapshot(), b.stateSnapshot());
});

test('run snapshot round-trips state, ledger and presence', () => {
  const sim = new GameSim();
  sim.setPresence({ outside: true, inShelter: false });
  for (let i = 0; i < 12; i += 1) {
    sim.tick();
    sim.drainNotifications();
  }
  sim.state.scans = ['site_a'];
  sim.state.samples = ['site_a'];

  const snapshot = sim.snapshot();
  const restored = new GameSim();
  assert.equal(restored.restore(snapshot), true);
  assert.deepEqual(restored.stateSnapshot(), sim.stateSnapshot());
  assert.deepEqual(restored.log.serialize(), sim.log.serialize());
  assert.deepEqual(restored.presence, sim.presence);
});

test('restoring a snapshot continues the same deterministic run', () => {
  const base = new GameSim();
  base.setPresence({ outside: false, inShelter: false });
  for (let i = 0; i < 20; i += 1) {
    base.tick();
    base.drainNotifications();
  }
  const snapshot = base.snapshot();
  for (let i = 0; i < 15; i += 1) {
    base.tick();
    base.drainNotifications();
  }
  const expected = base.stateSnapshot();

  const restored = new GameSim();
  assert.equal(restored.restore(snapshot), true);
  for (let i = 0; i < 15; i += 1) {
    restored.tick();
    restored.drainNotifications();
  }
  assert.deepEqual(restored.stateSnapshot(), expected);
});

test('restore rejects snapshots with removed content ids', () => {
  const sim = new GameSim();
  const snapshot = sim.snapshot();
  snapshot.state.scans.push('missing_site');
  assert.equal(new GameSim().restore(snapshot), false);
});

test('resources never exceed capacity and never go negative', () => {
  const sim = new GameSim();
  settle(sim, 120);
  for (const id of ['o2', 'water', 'food', 'energy']) {
    assert.ok(sim.state.resources[id] >= 0, `${id} below zero`);
    assert.ok(sim.state.resources[id] <= sim.getResourceCapacity(id) + 1e-9, `${id} above capacity`);
  }
});

test('radiation accumulates outside and is lower inside the locked shelter', () => {
  const outside = new GameSim();
  outside.state.tick = 5;
  outside.setPresence({ outside: true, inShelter: false });
  outside.tick();
  const outsideGain = outside.state.radiation - ECONOMY.radiation.start;
  assert.ok(outsideGain > 0, 'outside radiation should be positive at storm onset');

  const inside = new GameSim();
  inside.state.tick = 5;
  inside.setPresence({ outside: false, inShelter: false });
  inside.tick();
  const insideGain = inside.state.radiation - ECONOMY.radiation.start;

  const sheltered = new GameSim();
  sheltered.state.tick = 5;
  sheltered.state.shelterLocked = true;
  sheltered.setPresence({ outside: false, inShelter: true });
  sheltered.tick();
  const shelterGain = sheltered.state.radiation - ECONOMY.radiation.start;

  assert.ok(outsideGain > insideGain, 'outside should be worse than inside');
  assert.ok(insideGain > shelterGain, 'the shelter should reduce dose');
});

test('radiation never decays', () => {
  const sim = new GameSim();
  sim.state.radiation = 42;
  settle(sim, 10);
  assert.ok(sim.state.radiation >= 42);
});

test('storm window is scheduled early and is real-data sourced', () => {
  const storm = EVENTS.find((e) => e.archetype === 'radiation_window');
  assert.ok(storm.onset <= 12);
  assert.ok(storm.intensity.peak > storm.intensity.start);
});

test('broken machine can be repaired over game hours', () => {
  const sim = new GameSim();
  sim.state.machines.hydroponics.condition = 0;
  sim.state.resources.energy = 50;
  const start = sim.startRepair('hydroponics');
  assert.equal(start.ok, true);
  assert.ok(sim.state.machines.hydroponics.job);
  settle(sim, ECONOMY.repair.ticks + ECONOMY.repair.ticks);
  assert.ok(sim.state.machines.hydroponics.condition > 0);
  assert.equal(sim.state.machines.hydroponics.job, null);
  assert.ok(sim.log.count(LOG_TYPES.REPAIR) >= 1);
});

test('battery upgrade increases usable capacity', () => {
  const sim = new GameSim();
  sim.state.resources.energy = 100;
  const before = sim.energyCapacity;
  const result = sim.startUpgrade('battery', 'battery_cells');
  assert.equal(result.ok, true);
  settle(sim, 8);
  assert.equal(sim.state.machines.battery.upgrades.includes('battery_cells'), true);
  assert.ok(sim.energyCapacity >= before + 40);
});

test('upgrades apply both their benefit and their drawback', () => {
  const sim = new GameSim();
  sim.state.machines.o2_system.upgrades.push('o2_efficiency');
  sim.recomputeStats();
  assert.equal(sim.stats.o2_output, 1.25);
  assert.equal(sim.stats.water_input, 1.15);
});

test('suit servo trades suit wear for movement speed', () => {
  const sim = new GameSim();
  sim.state.machines.repair_bench.upgrades.push('suit_servo');
  sim.recomputeStats();
  assert.equal(sim.stats.movement_speed, 1.15);
  assert.equal(sim.stats.suit_decay, 1.2);
  sim.setPresence({ outside: true, inShelter: false });
  sim.tick();
  assert.ok(Math.abs(sim.state.suit - (100 - ECONOMY.suit.evaDecayPerTick * 1.2)) < 1e-9);
});

test('solar tracking increases output and array wear', () => {
  const sim = new GameSim();
  const before = sim.getWearRate('solar_array');
  sim.state.machines.solar_array.upgrades.push('solar_tracking');
  sim.recomputeStats();
  assert.equal(sim.stats.solar_output, 1.2);
  assert.ok(sim.getWearRate('solar_array') > before);
});

test('three scans and three reports complete the mission', () => {
  const sim = new GameSim();
  sim.setPresence({ outside: true, inShelter: false });
  for (const id of ['site_a', 'site_b', 'site_c']) {
    const scan = sim.completeScan(id);
    assert.equal(scan.ok, true);
  }
  sim.setPresence({ outside: false, inShelter: false });
  for (const id of ['site_a', 'site_b', 'site_c']) {
    const report = sim.sendReport(id);
    assert.equal(report.ok, true);
  }
  assert.equal(sim.state.over, 'victory');
  assert.equal(sim.state.cause, 'mission_complete');
  assert.equal(sim.state.reports.length, 3);
  assert.equal(sim.log.count(LOG_TYPES.REPORT), 3);
  // Science Delivery is auto-claimed with the victory beat.
  assert.equal(sim.state.submissions.science_delivery.status, 'claimed');
});

test('a sample cannot be reported twice or without a scan', () => {
  const sim = new GameSim();
  assert.equal(sim.sendReport('site_a').ok, false);
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  assert.equal(sim.sendReport('site_a').ok, true);
  assert.equal(sim.sendReport('site_a').ok, false);
});

test('doing nothing eventually kills the crew', () => {
  const sim = new GameSim();
  settle(sim, ECONOMY.time.missionTicks + 2);
  assert.equal(sim.state.over, 'defeat');
  assert.ok(['oxygen', 'radiation', 'starvation', 'dehydration', 'mission_clock', 'life_support'].includes(sim.state.cause));
});

test('mission clock ends a run with partial reports', () => {
  const sim = new GameSim();
  sim.state.tick = ECONOMY.time.missionTicks - 1;
  sim.state.health = 100;
  sim.state.radiation = 2;
  sim.state.resources.o2 = 100;
  sim.state.resources.water = 100;
  sim.state.resources.food = 100;
  sim.state.resources.energy = 100;
  sim.state.emergencyO2 = 6;
  sim.state.nutrition = 100;
  sim.state.hydration = 100;
  sim.tick();
  assert.equal(sim.state.over, 'defeat');
  assert.equal(sim.state.cause, 'mission_clock');
});

test('power ladder sheds lights before life support', () => {
  const sim = new GameSim();
  sim.state.tick = 18; // night
  sim.state.resources.energy = 0;
  sim.tick();
  assert.ok(sim.state.lastPower.shed.length > 0);
  assert.equal(sim.state.lastPower.shed[0], 'lights');
  const o2Shed = sim.state.lastPower.shed.indexOf('o2_system');
  const hydroShed = sim.state.lastPower.shed.indexOf('hydroponics');
  if (o2Shed !== -1) assert.ok(hydroShed !== -1 && hydroShed < o2Shed);
});

test('comms outage blocks forecast but not reports', () => {
  const sim = new GameSim();
  sim.state.tick = 95;
  sim.tick();
  assert.equal(sim.isCommsOutage(), true);
  assert.deepEqual(sim.getForecast(), []);
  sim.setPresence({ outside: true, inShelter: false });
  for (const id of ['site_a', 'site_b', 'site_c']) sim.completeScan(id);
  assert.equal(sim.sendReport('site_a').ok, true);
});

test('supply request costs power and arrives after the delay', () => {
  const sim = new GameSim();
  sim.state.tick = 30;
  sim.state.resources.energy = 50;
  const before = sim.state.resources.water;
  assert.equal(sim.requestSupply().ok, true);
  settle(sim, ECONOMY.supply.delayTicks);
  assert.ok(sim.state.resources.water > before);
  assert.equal(sim.log.count(LOG_TYPES.SUPPLY_ARRIVAL), 1);
});

test('storm watch contract completes from a reading before the event', () => {
  const sim = new GameSim();
  sim.state.tick = 10;
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  assert.equal(sim.state.submissions.storm_watch.status, 'ready');
  const claimed = sim.claimSubmission('storm_watch');
  assert.equal(claimed.ok, true);
  assert.equal(sim.state.submissions.storm_watch.status, 'claimed');
});

test('water watch contract needs a repair and low reservoir', () => {
  const sim = new GameSim();
  sim.state.tick = 20;
  sim.state.resources.water = 40;
  sim.state.machines.water_recycler.condition = 100;
  sim.state.machines.water_recycler.repairCount = 1;
  sim.tick();
  assert.equal(sim.state.submissions.water_watch.status, 'ready');
});

test('demo presets pass validation and survive their first hours', () => {
  for (const preset of DEMO_PRESETS) {
    const result = validatePreset(preset);
    assert.equal(result.ok, true, `${preset.id}: ${result.errors.join('; ')}`);
    const sim = new GameSim();
    sim.loadPreset(preset);
    sim.setPresence({ outside: false, inShelter: false });
    for (let i = 0; i < 4; i += 1) sim.tick();
    assert.notEqual(sim.state.over, 'defeat', `${preset.id} died: ${sim.state.cause}`);
  }
});

test('preset capture round-trips the important state', () => {
  const sim = new GameSim();
  sim.state.tick = 70;
  sim.state.resources.energy = 44;
  sim.state.machines.battery.upgrades.push('battery_cells');
  sim.recomputeStats();
  const preset = sim.capturePreset('capture-test', { x: 1, z: 2 });
  const restored = new GameSim();
  restored.loadPreset(preset);
  assert.equal(restored.state.tick, 70);
  assert.equal(restored.state.resources.energy, 44);
  assert.equal(restored.state.machines.battery.upgrades.includes('battery_cells'), true);
  assert.ok(restored.energyCapacity > 100);
});

test('infinite mineral veins can be mined repeatedly and refined for ISRU resources', () => {
  const sim = new GameSim();
  sim.state.resources.water = 50;
  const r1 = sim.mineMineral('water_ice');
  const r2 = sim.mineMineral('water_ice');
  assert.equal(r1.ok, true);
  assert.equal(r2.count, 2);
  const refined = sim.refineMineral('water_ice');
  assert.equal(refined.ok, true);
  assert.equal(refined.remaining, 1);
  assert.equal(sim.state.resources.water, 58);
});

test('hotbar starts with pickaxe only, rejects when full, and frees slot on drop', () => {
  const sim = new GameSim();
  assert.equal(sim.state.hotbar[0]?.id, 'pickaxe');
  assert.deepEqual(sim.state.hotbar.slice(1), [null, null, null, null]);

  for (let i = 0; i < 5; i += 1) assert.equal(sim.mineMineral('water_ice').ok, true);
  for (let i = 0; i < 5; i += 1) assert.equal(sim.mineMineral('ilmenite').ok, true);
  for (let i = 0; i < 5; i += 1) assert.equal(sim.mineMineral('anorthite').ok, true);
  for (let i = 0; i < 5; i += 1) assert.equal(sim.mineMineral('olivine').ok, true);

  const full = sim.mineMineral('water_ice');
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'hotbar_full');
  assert.equal(sim.dropHotbarSlot(0).reason, 'locked_tool');

  for (let i = 0; i < 5; i += 1) assert.equal(sim.dropHotbarSlot(1).ok, true);
  assert.equal(sim.state.hotbar[1], null);
  assert.equal(sim.mineMineral('olivine').ok, true);
});

test('greenhouse ice melter consumes water_ice and irrigates plants', () => {
  const sim = new GameSim();
  sim.state.resources.water = 40;
  sim.state.resources.food = 50;
  assert.equal(sim.meltIce().reason, 'no_ice');
  sim.mineMineral('water_ice');
  const res = sim.meltIce();
  assert.equal(res.ok, true);
  assert.equal(res.remaining, 0);
  assert.equal(sim.state.resources.water, 52);
  assert.equal(sim.state.resources.food, 54);
});
