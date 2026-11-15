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

test('relay passes follow the configured interval and phase', () => {
  const sim = new GameSim();
  sim.state.tick = 2;
  assert.equal(sim.nextRelayTick(), 2);
  assert.equal(sim.isRelayPass(2), true);
  sim.state.tick = 3;
  assert.equal(sim.nextRelayTick(), 6);
  assert.equal(sim.isRelayPass(3), false);
  assert.deepEqual(sim.getRelayStatus(), {
    outage: false,
    nextTick: 6,
    inTicks: 3,
    queued: 0,
    interval: ECONOMY.comms.relayIntervalTicks,
    phase: ECONOMY.comms.relayPhaseTicks,
  });
});

test('dose is presented in mSv with the declared conversion', () => {
  const sim = new GameSim();
  sim.state.radiation = 12.5;
  assert.equal(sim.getDoseMsv(), 31.25);
  assert.equal(ECONOMY.radiation.deathDose * ECONOMY.radiation.msvPerPoint, ECONOMY.radiation.msvLimit);
});

test('three scans and three reports complete the mission only after the relay pass', () => {
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
    assert.equal(report.queued, true);
  }
  assert.equal(sim.state.over, null);
  assert.equal(sim.state.reports.length, 0);
  assert.equal(sim.state.reportQueue.length, 3);
  assert.equal(sim.log.count(LOG_TYPES.REPORT), 0);

  // The queue leaves on the first pass (tick 2).
  settle(sim, ECONOMY.comms.relayIntervalTicks);
  assert.equal(sim.state.over, 'victory');
  assert.equal(sim.state.cause, 'mission_complete');
  assert.equal(sim.state.reports.length, 3);
  assert.equal(sim.state.reportQueue.length, 0);
  assert.equal(sim.log.count(LOG_TYPES.REPORT), 3);
  // Science Delivery is auto-claimed with the victory beat.
  assert.equal(sim.state.submissions.science_delivery.status, 'claimed');
});

test('a queued report does not count as sent until the pass', () => {
  const sim = new GameSim();
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  sim.setPresence({ outside: false, inShelter: false });
  const queued = sim.sendReport('site_a');
  assert.equal(queued.ok, true);
  assert.equal(queued.queued, true);
  assert.equal(queued.nextRelayTick, 2);
  assert.equal(sim.state.reports.length, 0);
  assert.equal(sim.state.stats.reportsSent, 0);
  assert.equal(sim.state.samples.includes('site_a'), false);
  assert.equal(sim.state.reportQueue.length, 1);
  assert.equal(sim.log.count(LOG_TYPES.REPORT), 0);
  assert.equal(sim.log.countPayload(LOG_TYPES.NOTE, (payload) => payload.note === 'report_queued'), 1);
});

test('a DSN outage keeps queued reports for the next open pass', () => {
  const sim = new GameSim();
  sim.state.tick = 95;
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  sim.setPresence({ outside: false, inShelter: false });
  assert.equal(sim.sendReport('site_a').nextRelayTick, 98);

  // 96 and 97 are outage hours without a pass.
  settle(sim, 2);
  assert.equal(sim.state.tick, 97);
  assert.equal(sim.isCommsOutage(), true);

  // Tick 98 is a relay pass, but the link is down.
  settle(sim, 1);
  assert.equal(sim.state.tick, 98);
  assert.equal(sim.isRelayPass(98), true);
  assert.equal(sim.getRelayStatus().outage, true);
  assert.equal(sim.state.reports.length, 0);
  assert.equal(sim.state.reportQueue.length, 1);

  // The outage runs through tick 101; tick 102 is the next open pass.
  settle(sim, 4);
  assert.equal(sim.state.tick, 102);
  assert.equal(sim.isCommsOutage(), false);
  assert.equal(sim.state.reports.length, 1);
  assert.equal(sim.state.reportQueue.length, 0);
});

test('a sample cannot be reported twice or without a scan', () => {
  const sim = new GameSim();
  assert.equal(sim.sendReport('site_a').reason, 'no_sample');
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  assert.equal(sim.sendReport('site_a').ok, true);
  assert.equal(sim.sendReport('site_a').reason, 'already_queued');
  settle(sim, ECONOMY.comms.relayIntervalTicks);
  assert.equal(sim.sendReport('site_a').reason, 'already_sent');
});

test('doing nothing eventually kills the crew', () => {
  const sim = new GameSim();
  settle(sim, ECONOMY.time.missionTicks + 2);
  assert.equal(sim.state.over, 'defeat');
  assert.ok(
    ['oxygen', 'dose_limit', 'starvation', 'dehydration', 'mission_clock', 'life_support'].includes(sim.state.cause)
  );
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

test('planting a tray deducts its water and energy cost', () => {
  const sim = new GameSim();
  const water = sim.state.resources.water;
  const energy = sim.state.resources.energy;
  const result = sim.plantTray(0);
  assert.equal(result.ok, true);
  assert.equal(sim.state.resources.water, water - ECONOMY.hydroponics.plantCost.water);
  assert.equal(sim.state.resources.energy, energy - ECONOMY.hydroponics.plantCost.energy);
  assert.deepEqual(sim.state.crops[0], { progress: 0 });
  assert.equal(sim.getCropView(0).empty, false);
  assert.equal(sim.getCropView(0).stage, 1);
  assert.equal(sim.log.countPayload(LOG_TYPES.NOTE, (payload) => payload.note === 'crop_planted'), 1);
});

test('planting is rejected for bad trays, occupied trays and missing resources', () => {
  const sim = new GameSim();
  assert.equal(sim.plantTray(-1).reason, 'bad_tray');
  assert.equal(sim.plantTray(0.5).reason, 'bad_tray');
  assert.equal(sim.plantTray(ECONOMY.hydroponics.trays).reason, 'bad_tray');

  sim.plantTray(0);
  assert.equal(sim.plantTray(0).reason, 'occupied');

  sim.state.resources.water = 0;
  assert.equal(sim.plantTray(1).reason, 'no_water');
  sim.state.resources.water = 50;
  sim.state.resources.energy = 0;
  assert.equal(sim.plantTray(1).reason, 'no_energy');
  assert.equal(sim.state.crops[1], null);

  sim.state.machines.hydroponics.enabled = false;
  sim.state.resources.energy = 50;
  assert.equal(sim.plantTray(1).reason, 'off');
  sim.state.machines.hydroponics.enabled = true;
  sim.state.machines.hydroponics.condition = 0;
  assert.equal(sim.plantTray(1).reason, 'broken');
});

test('crops advance one tray step per hour and stop at maturity', () => {
  const sim = new GameSim();
  assert.equal(sim.plantTray(0).ok, true);
  settle(sim, 5);
  assert.equal(sim.getCropView(0).progress, 5);
  assert.equal(sim.getCropView(0).stage, 1);

  settle(sim, 30);
  const view = sim.getCropView(0);
  assert.equal(view.progress, ECONOMY.hydroponics.cycleTicks);
  assert.equal(view.mature, true);
  assert.equal(view.stage, ECONOMY.hydroponics.stages);
  assert.equal(view.remainingTicks, 0);
  assert.equal(view.yieldFood, Math.round(ECONOMY.hydroponics.yieldFood * sim.stats.food_output));
});

test('crop stage tracks the four growth quarters', () => {
  const sim = new GameSim();
  sim.plantTray(0);
  const stages = [];
  for (const progress of [0, 8, 15, 23, ECONOMY.hydroponics.cycleTicks]) {
    sim.state.crops[0].progress = progress;
    stages.push(sim.getCropView(0).stage);
  }
  assert.deepEqual(stages, [1, 2, 3, 4, 4]);
});

test('crops pause while hydroponics is off or broken and resume afterwards', () => {
  const sim = new GameSim();
  sim.plantTray(0);
  settle(sim, 3);
  assert.equal(sim.getCropView(0).progress, 3);

  sim.toggleSystem('hydroponics');
  settle(sim, 4);
  assert.equal(sim.getCropView(0).progress, 3);

  sim.toggleSystem('hydroponics');
  sim.state.machines.hydroponics.condition = 0;
  settle(sim, 3);
  assert.equal(sim.getCropView(0).progress, 3);
  assert.equal(sim.getCropView(0).empty, false);

  sim.state.machines.hydroponics.condition = 80;
  settle(sim, 2);
  assert.equal(sim.getCropView(0).progress, 5);
});

test('harvesting a mature tray adds food, empties the tray and counts the harvest', () => {
  const sim = new GameSim();
  sim.plantTray(0);
  assert.equal(sim.harvestTray(0).reason, 'not_ready');
  sim.state.crops[0].progress = ECONOMY.hydroponics.cycleTicks;
  sim.state.resources.food = 40;
  const expected = Math.round(ECONOMY.hydroponics.yieldFood * sim.stats.food_output);
  const result = sim.harvestTray(0);
  assert.equal(result.ok, true);
  assert.equal(result.food, expected);
  assert.equal(sim.state.resources.food, 40 + expected);
  assert.equal(sim.state.crops[0], null);
  assert.equal(sim.state.stats.harvests, 1);
  assert.equal(sim.getCropView(0).empty, true);
  assert.equal(sim.harvestTray(0).reason, 'empty');
  assert.equal(sim.harvestTray(ECONOMY.hydroponics.trays).reason, 'bad_tray');
});

test('a mature crop waits without losing yield', () => {
  const sim = new GameSim();
  sim.plantTray(0);
  sim.state.crops[0].progress = ECONOMY.hydroponics.cycleTicks;
  settle(sim, 10);
  const view = sim.getCropView(0);
  assert.equal(view.progress, ECONOMY.hydroponics.cycleTicks);
  assert.equal(view.mature, true);
  assert.equal(view.yieldFood, Math.round(ECONOMY.hydroponics.yieldFood * sim.stats.food_output));
});

test('snapshot round-trips crops and the report queue', () => {
  const sim = new GameSim();
  sim.plantTray(0);
  sim.state.crops[1] = { progress: 12 };
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  sim.setPresence({ outside: false, inShelter: false });
  sim.sendReport('site_a');

  const restored = new GameSim();
  assert.equal(restored.restore(sim.snapshot()), true);
  assert.deepEqual(restored.state.crops, sim.state.crops);
  assert.deepEqual(restored.state.reportQueue, sim.state.reportQueue);
  assert.equal(restored.state.stats.harvests, 0);
});

test('preset capture includes crops and the report queue', () => {
  const sim = new GameSim();
  sim.plantTray(0);
  sim.state.crops[1] = { progress: 12 };
  sim.setPresence({ outside: true, inShelter: false });
  sim.completeScan('site_a');
  sim.setPresence({ outside: false, inShelter: false });
  sim.sendReport('site_a');

  const preset = sim.capturePreset('capture-crops');
  assert.deepEqual(preset.crops, sim.state.crops);
  assert.deepEqual(preset.reportQueue, sim.state.reportQueue);

  const restored = new GameSim();
  restored.loadPreset(preset);
  assert.deepEqual(restored.state.crops, sim.state.crops);
  assert.deepEqual(restored.state.reportQueue, sim.state.reportQueue);
});

test('reaching the mission dose limit ends the run with dose_limit', () => {
  const sim = new GameSim();
  sim.state.radiation = ECONOMY.radiation.deathDose;
  sim.tick();
  assert.equal(sim.state.over, 'defeat');
  assert.equal(sim.state.cause, 'dose_limit');
});

test('a health collapse above the damage threshold reports dose_limit', () => {
  const sim = new GameSim();
  sim.state.radiation = ECONOMY.radiation.damageAbove + 10;
  sim.state.health = 0.01;
  sim.tick();
  assert.equal(sim.state.cause, 'dose_limit');
  assert.equal(sim.log.countPayload(LOG_TYPES.DAMAGE, (payload) => payload.cause === 'radiation'), 1);
});

test('the final demo wins when its last report leaves on the next pass', () => {
  const preset = DEMO_PRESETS.find((row) => row.id === 'demo_final');
  const sim = new GameSim();
  sim.loadPreset(preset);
  assert.ok(sim.nextRelayTick() - preset.tick <= ECONOMY.comms.relayIntervalTicks);
  assert.equal(sim.sendReport('site_c').ok, true);
  assert.equal(sim.state.over, null);
  while (!sim.state.over && sim.state.tick < ECONOMY.time.missionTicks) {
    sim.tick();
    sim.drainNotifications();
  }
  assert.equal(sim.state.over, 'victory');
  assert.equal(sim.state.tick, 286);
  assert.equal(sim.state.reports.length, 3);
});

test('tray management keeps food above zero for the whole mission', () => {
  const sim = new GameSim();
  let minFood = sim.state.resources.food;
  for (let i = 0; i < ECONOMY.time.missionTicks; i += 1) {
    const s = sim.state;
    // Isolate the food economy: life support and power stay healthy so the
    // test measures tray throughput across a full 300-hour mission.
    s.resources.energy = 100;
    s.resources.water = 100;
    s.resources.o2 = 100;
    s.health = Math.max(s.health, 80);
    for (const row of sim.getCropRows()) {
      if (row.mature) sim.harvestTray(row.index);
    }
    for (const row of sim.getCropRows()) {
      if (row.empty) sim.plantTray(row.index);
    }
    for (const row of sim.getMachineRows()) {
      if (row.machine.job) continue;
      if (row.condition < 35 && s.resources.energy > 12) sim.startRepair(row.id);
    }
    sim.tick();
    sim.drainNotifications();
    minFood = Math.min(minFood, sim.state.resources.food);
    assert.ok(sim.state.resources.food > 0, `food hit zero at tick ${sim.state.tick}`);
    if (sim.state.over) break;
  }
  assert.ok(minFood > 0);
  assert.equal(sim.state.cause, 'mission_clock', `run ended early: ${sim.state.cause}`);
  assert.ok(sim.state.stats.harvests > 0);
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
