import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STRINGS } from '../src/data/strings.js';

const MAX_DEFINITION_WORDS = 40;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

test('the HUD has a visible game-time label', () => {
  assert.equal(STRINGS['time.gameTimeLabel'], 'GAME TIME');
});

test('the time model note declares the scale, day and mission length', () => {
  const note = STRINGS['time.modelNote'];
  assert.match(note, /1 tick/);
  assert.match(note, /1 game hour/);
  assert.match(note, /60 real seconds/);
  assert.match(note, /at ×1/);
  assert.match(note, /24 game hours/);
  assert.match(note, /12 daylight, 12 night/);
  assert.match(note, /300 game hours/);
  assert.match(note, /12\.5 mission days/);
});

test('the compression note says the clock is not real lunar time', () => {
  const note = STRINGS['time.compressionNote'];
  assert.match(note, /Game time, not real lunar time/);
  assert.match(note, /29\.53 Earth days/);
  assert.match(note, /junior astronauts/);
  assert.match(note, /one sitting/);
});

test('the lunar day entry separates the real day from the game day', () => {
  const definition = STRINGS['glossary.lunar_day.definition'];
  assert.match(definition, /29\.53/);
  assert.match(definition, /game/i);
  assert.ok(
    wordCount(definition) <= MAX_DEFINITION_WORDS,
    `lunar day definition has ${wordCount(definition)} words`
  );
});

test('the title and controls use game-time labels', () => {
  assert.equal(STRINGS['time.sideHoursLabel'], 'GAME HOURS');
  assert.match(STRINGS['time.controlsNote'], /Game time/);
  assert.match(STRINGS['time.dataBadge'], /AT ×1/);
  assert.match(STRINGS['time.titleMeta'], /GAME TIME/);
  assert.doesNotMatch(STRINGS['time.titleMeta'], /REAL-TIME/);
});

test('no visible string claims real-time lunar time', () => {
  for (const [key, value] of Object.entries(STRINGS)) {
    assert.doesNotMatch(value, /REAL-TIME/, `${key} still says REAL-TIME`);
    assert.doesNotMatch(value, /1s = 1m/, `${key} still says 1s = 1m`);
  }
});
