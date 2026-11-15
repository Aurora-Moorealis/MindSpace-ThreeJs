import { test } from 'node:test';
import assert from 'node:assert/strict';

import { auditData } from '../src/core/audit.js';
import { EVENTS, EVENT_ARCHETYPES } from '../src/data/events.js';
import { MACHINES } from '../src/data/machines.js';
import { POIS } from '../src/data/pois.js';
import { SUBMISSIONS } from '../src/data/submissions.js';
import { SOURCES } from '../src/data/sources.js';
import { MINERALS, MINERAL_VEINS, NASA_PROTOTYPE_TRUCK } from '../src/data/minerals.js';
import { STRINGS } from '../src/data/strings.js';
import { DEMO_PRESETS } from '../src/data/demo-states.js';

test('data audit passes with no errors', () => {
  const result = auditData();
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('the four submitted contracts use only the fixed condition enum', () => {
  assert.equal(SUBMISSIONS.length, 4);
  const allowed = new Set(['reading_before_event', 'counter_reached', 'resource_below_and_repaired', 'total_reports_sent']);
  for (const row of SUBMISSIONS) assert.ok(allowed.has(row.condition));
});

test('there are five event archetypes and all are used', () => {
  assert.equal(EVENT_ARCHETYPES.length, 5);
  for (const archetype of EVENT_ARCHETYPES) {
    assert.ok(EVENTS.some((row) => row.archetype === archetype), `missing ${archetype}`);
  }
});

test('radiation windows cite archived DONKI sources', () => {
  const storms = EVENTS.filter((row) => row.archetype === 'radiation_window');
  assert.ok(storms.length >= 3);
  for (const storm of storms) {
    const source = SOURCES[storm.source];
    assert.ok(source, `${storm.id} has no source`);
    assert.equal(source.real_data, true, `${storm.id} source is not real`);
    assert.ok(source.url.startsWith('https://'), `${storm.id} source has no archive URL`);
    assert.match(source.date_archived, /^\d{4}-\d{2}-\d{2}/);
  }
});

test('simulated rows are labelled as such', () => {
  const simulated = EVENTS.filter((row) => !SOURCES[row.source]?.real_data);
  assert.ok(simulated.length > 0);
  for (const row of simulated) {
    assert.equal(SOURCES[row.source].real_data, false);
  }
});

test('every upgrade declares a benefit and a visible trade-off', () => {
  for (const machine of Object.values(MACHINES)) {
    for (const upgrade of machine.upgrades) {
      assert.ok(upgrade.effect, `${upgrade.id} has no benefit`);
      assert.ok(upgrade.drawback, `${upgrade.id} has no drawback`);
      assert.ok(STRINGS[upgrade.drawbackKey], `${upgrade.id} has no drawback copy`);
      assert.notEqual(upgrade.drawback.stat, upgrade.effect.stat, `${upgrade.id} drawback cancels its benefit`);
    }
  }
});

test('all nine machines have two or more upgrades and source references', () => {
  const ids = Object.keys(MACHINES);
  assert.equal(ids.length, 9);
  for (const id of ids) {
    assert.ok(MACHINES[id].upgrades.length >= 2, `${id} has fewer than two upgrades`);
    assert.ok(MACHINES[id].sourceRefs.length > 0, `${id} has no sources`);
  }
});

test('three POIs, each with a sample and a report string', () => {
  assert.equal(POIS.length, 3);
  for (const poi of POIS) {
    assert.ok(STRINGS[poi.sampleKey], `missing ${poi.sampleKey}`);
    assert.ok(STRINGS[poi.reportKey], `missing ${poi.reportKey}`);
  }
});

test('every visible row has English copy', () => {
  for (const machine of Object.values(MACHINES)) {
    assert.ok(STRINGS[machine.nameKey]);
    assert.ok(STRINGS[machine.descriptionKey]);
  }
  for (const event of EVENTS) {
    assert.ok(STRINGS[event.nameKey]);
    assert.ok(STRINGS[event.descriptionKey]);
  }
  for (const submission of SUBMISSIONS) {
    assert.ok(STRINGS[submission.nameKey]);
    assert.ok(STRINGS[submission.descriptionKey]);
  }
});

test('presets target a radiation window within six hours', () => {
  for (const preset of DEMO_PRESETS) {
    const next = EVENTS.find((e) => e.archetype === 'radiation_window' && e.onset > preset.tick);
    assert.ok(next, `${preset.id} has no future storm`);
    assert.ok(next.onset - preset.tick <= 6, `${preset.id} storm is too far away`);
  }
});

test('four lunar minerals and NASA truck prototype cite real NASA sources', () => {
  const mineralList = Object.values(MINERALS);
  assert.equal(mineralList.length, 4);
  for (const mineral of mineralList) {
    assert.ok(SOURCES[mineral.source]?.real_data, `${mineral.id} missing NASA source`);
    assert.ok(mineral.mineSeconds > 0);
  }
  assert.ok(MINERAL_VEINS.length >= 4);
  assert.ok(SOURCES[NASA_PROTOTYPE_TRUCK.source]?.real_data);
});
