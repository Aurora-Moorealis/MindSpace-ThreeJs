#!/usr/bin/env node
/**
 * Balance harness. Not shipped to players: runs the simulation headlessly under
 * a few scripted policies so tuning changes can be compared quickly.
 *
 * Usage: node scripts/balance.mjs [idle|basic]
 */
import { GameSim } from '../src/core/sim.js';
import { LOG_TYPES } from '../src/core/event-log.js';

const policy = process.argv[2] ?? 'basic';

const sim = new GameSim();
const report = [];

function log() {
  const s = sim.state;
  report.push({
    tick: s.tick,
    sol: sim.sol,
    hour: sim.hour,
    res: Object.fromEntries(['o2', 'water', 'food', 'energy'].map((id) => [id, Number(s.resources[id].toFixed(1))])),
    health: Number(s.health.toFixed(1)),
    dose: Number(s.radiation.toFixed(1)),
    cap: sim.energyCapacity,
    reports: s.reports.length,
    scans: s.scans.length,
    over: s.over,
    cause: s.cause,
  });
}

for (let i = 0; i < 300; i += 1) {
  const tick = sim.state.tick;
  const s = sim.state;
  const storm = sim.getStorm();

  if (policy === 'basic') {
    // Shelter discipline.
    if (storm && !s.shelterLocked) {
      sim.setPresence({ outside: false, inShelter: true });
      sim.toggleShelter();
    } else if (!storm && s.shelterLocked) {
      sim.toggleShelter();
    }

    // Scans and reports (travel time ignored).
    for (const [poi, at] of [['site_a', 9], ['site_b', 38], ['site_c', 95]]) {
      if (tick === at && !s.scans.includes(poi)) {
        sim.setPresence({ outside: true, inShelter: false });
        sim.completeScan(poi);
        sim.setPresence({ outside: false, inShelter: false });
      }
    }
    for (const poi of [...s.samples]) {
      if (s.reports.length < 3) sim.sendReport(poi);
    }

    // Contracts.
    for (const row of sim.getSubmissionRows()) {
      if (row.state.status === 'ready') sim.claimSubmission(row.id);
    }

    // Repairs and upgrades.
    for (const row of sim.getMachineRows()) {
      if (row.machine.job) continue;
      if (row.condition < 35 && s.resources.energy > 12) sim.startRepair(row.id);
    }
    if (s.dust > 55 && s.resources.energy > 15) {
      sim.setPresence({ outside: true, inShelter: false });
      sim.cleanSolarArray();
      sim.setPresence({ outside: false, inShelter: false });
    }

    // Power discipline.
    if (!sim.isDay && s.resources.energy < 40 && s.machines.hydroponics.enabled) {
      sim.toggleSystem('hydroponics');
    }
    if (sim.isDay && !s.machines.hydroponics.enabled) {
      sim.toggleSystem('hydroponics');
    }

    // Supply requests when things are tight.
    if (
      (s.resources.water < 25 || s.resources.food < 25 || s.resources.o2 < 25) &&
      s.supply.cooldown <= 0 &&
      !s.supply.pending &&
      s.resources.energy > 20 &&
      !sim.isCommsOutage()
    ) {
      sim.requestSupply();
    }
  }

  if (tick % 24 === 0) log();
  sim.tick();
  sim.drainNotifications();
  if (sim.state.over) break;
}

log();
console.log(`Policy: ${policy}`);
console.log(`Outcome: ${sim.state.over ?? 'running'} (${sim.state.cause ?? '—'}) at tick ${sim.state.tick}`);
console.log(`Reports: ${sim.state.reports.length}/3 · contracts ${sim.log.count(LOG_TYPES.SUBMISSION_CLAIMED)}/4 · dose ${sim.state.radiation.toFixed(1)} · health ${sim.state.health.toFixed(1)}`);
console.table(report);
