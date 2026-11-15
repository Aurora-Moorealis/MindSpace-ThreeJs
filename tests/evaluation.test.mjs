import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GameSim } from '../src/core/sim.js';
import { buildEvaluation } from '../src/core/evaluation.js';
import { DEMO_PRESETS, validatePreset } from '../src/data/demo-states.js';
import { LOG_TYPES } from '../src/core/event-log.js';

function makeVictory() {
  const sim = new GameSim();
  sim.state.tick = 120;
  sim.state.reports = ['site_a', 'site_b', 'site_c'];
  sim.state.scans = ['site_a', 'site_b', 'site_c'];
  sim.state.samples = [];
  sim.state.health = 88;
  sim.state.radiation = 18;
  sim.state.stats.peakDose = 18;
  sim.state.stats.shelterUses = 2;
  for (const row of sim.getSubmissionRows()) {
    sim.state.submissions[row.id].status = 'claimed';
  }
  for (const id of ['site_a', 'site_b', 'site_c']) {
    sim.log.add(10, LOG_TYPES.REPORT, { poiId: id, count: 1, source: 'mission' });
  }
  sim.log.add(6, LOG_TYPES.STORM_START, { eventId: 'storm_gannon_arrival', source: 'donki_cme' });
  sim.log.add(182, LOG_TYPES.STORM_START, { eventId: 'storm_gannon_peak', source: 'donki_gst' });
  sim.state.over = 'victory';
  sim.state.cause = 'mission_complete';
  return sim;
}

test('evaluation exposes exactly the five required counters', () => {
  const result = buildEvaluation(makeVictory());
  assert.equal(result.cards.length, 5);
  assert.deepEqual(
    result.cards.map((card) => card.id),
    ['reports', 'contracts', 'resources', 'radiation', 'time']
  );
  assert.equal(result.reports, 3);
  assert.equal(result.contracts, 4);
  assert.ok(result.avgResources > 0);
  assert.ok(result.peakDose >= 18);
  assert.ok(result.sols > 0);
});

test('victory evaluation is marked complete and cites NASA data', () => {
  const result = buildEvaluation(makeVictory());
  assert.equal(result.victory, true);
  assert.equal(result.title, 'MISSION COMPLETE');
  assert.ok(['S', 'A', 'B', 'C', 'D'].includes(result.grade));
  assert.ok(result.sources.includes('donki_cme'));
  assert.ok(result.sources.includes('crater'));
  assert.ok(result.sources.includes('bvad'));
  assert.ok(result.timeline.length > 0);
  assert.ok(result.wentWell.length > 0);
});

test('defeat evaluation is capped below a passing grade', () => {
  const sim = makeVictory();
  sim.state.over = 'defeat';
  sim.state.cause = 'oxygen';
  sim.state.reports = ['site_a'];
  const result = buildEvaluation(sim);
  assert.equal(result.victory, false);
  assert.equal(result.title, 'MISSION FAILED');
  assert.ok(result.score <= 49);
  assert.ok(result.improve.some((line) => line.toLowerCase().includes('oxygen')));
});

test('mission clock defeat is labelled incomplete', () => {
  const sim = makeVictory();
  sim.state.over = 'defeat';
  sim.state.cause = 'mission_clock';
  const result = buildEvaluation(sim);
  assert.equal(result.title, 'MISSION INCOMPLETE');
  assert.equal(result.timeout, true);
});

test('timeline storm labels are not duplicated', () => {
  const result = buildEvaluation(makeVictory());
  for (const row of result.timeline) {
    assert.ok(!row.text.includes('Radiation window began — Radiation window'), row.text);
  }
});

test('demo presets produce a sensible evaluation before and after victory', () => {
  for (const preset of DEMO_PRESETS) {
    assert.equal(validatePreset(preset).ok, true);
    const sim = new GameSim();
    sim.loadPreset(preset);
    const before = buildEvaluation(sim);
    assert.equal(before.cards.length, 5);
    assert.ok(before.reports >= 1);
    if (preset.id === 'demo_final') {
      sim.sendReport('site_c');
      assert.equal(sim.state.over, 'victory');
      const after = buildEvaluation(sim);
      assert.equal(after.reports, 3);
      assert.equal(after.victory, true);
      assert.equal(after.contracts, 4);
    }
  }
});
