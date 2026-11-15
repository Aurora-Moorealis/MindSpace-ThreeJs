import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GLOSSARY, GLOSSARY_BY_ID } from '../src/data/glossary.js';
import { STRINGS } from '../src/data/strings.js';

const MAX_DEFINITION_WORDS = 40;

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

test('the glossary has exactly ten entries with unique ids', () => {
  assert.equal(GLOSSARY.length, 10);
  const ids = GLOSSARY.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate glossary id');
  assert.equal(Object.keys(GLOSSARY_BY_ID).length, ids.length);
  for (const id of ids) assert.equal(GLOSSARY_BY_ID[id].id, id);
});

test('glossary ids are lowercase kebab or snake case', () => {
  for (const entry of GLOSSARY) {
    assert.match(entry.id, /^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/, `bad id ${entry.id}`);
  }
});

test('every term and definition exists in the string table', () => {
  for (const entry of GLOSSARY) {
    for (const key of [entry.termKey, entry.definitionKey]) {
      assert.ok(Object.prototype.hasOwnProperty.call(STRINGS, key), `missing ${key}`);
      assert.ok(STRINGS[key].trim().length > 0, `empty ${key}`);
    }
  }
});

test('definitions stay within forty words', () => {
  for (const entry of GLOSSARY) {
    const count = wordCount(STRINGS[entry.definitionKey]);
    assert.ok(count <= MAX_DEFINITION_WORDS, `${entry.id} has ${count} words`);
  }
});

test('related ids point at real glossary entries', () => {
  for (const entry of GLOSSARY) {
    assert.ok(Array.isArray(entry.related), `${entry.id} related is not an array`);
    for (const id of entry.related) {
      assert.ok(GLOSSARY_BY_ID[id], `${entry.id} links to unknown ${id}`);
      assert.notEqual(id, entry.id, `${entry.id} links to itself`);
    }
  }
});

test('the comms console has copy for the queued reports panel', () => {
  const keys = ['comms.queuedAt', 'comms.waitingPass', 'comms.outageQueue'];
  for (const key of keys) {
    assert.ok(Object.prototype.hasOwnProperty.call(STRINGS, key), `missing ${key}`);
    assert.ok(STRINGS[key].trim().length > 0, `empty ${key}`);
  }
  assert.match(STRINGS['comms.queuedAt'], /\{tick\}/);
});

test('no visible string uses SOL or Sols as a label', () => {
  const sol = /\bSOL\b/;
  const sols = /\bSols?\b/;
  for (const [key, value] of Object.entries(STRINGS)) {
    assert.doesNotMatch(value, sol, `${key} still says SOL`);
    assert.doesNotMatch(value, sols, `${key} still says Sol or Sols`);
  }
});

test('solar wording is not caught by the SOL rule', () => {
  assert.equal(STRINGS['machine.solar_array.short'], 'SOLAR');
  assert.doesNotMatch(STRINGS['machine.solar_array.short'], /\bSOL\b/);
});
