/**
 * Contract tests for the authored GLB props. The runtime looks up nodes by
 * name, so a rebuild that renames a pivot or a dish should fail here instead of
 * silently breaking the animation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const MODELS_DIR = path.resolve('src/assets/models');

function readGlbJson(name) {
  const file = path.join(MODELS_DIR, `${name}.glb`);
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${name}.glb is not a GLB`);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}

function nodeNames(json) {
  return new Set(json.nodes.map((node) => node.name));
}

const EXPECTED = {
  rover: ['RoverBody', 'RoverDish', 'RoverDishMesh', 'RoverBeacon'],
  lander: ['LanderBody', 'LanderDish', 'LanderDishMesh', 'LanderBeacon'],
  astronaut: [
    'AstronautRoot',
    'Torso',
    'TorsoMesh',
    'ArmL',
    'ArmR',
    'LegL',
    'LegR',
    'ChestLight',
    'AntennaLight',
  ],
};

for (const [model, required] of Object.entries(EXPECTED)) {
  test(`${model}.glb exposes the runtime node contract`, () => {
    const json = readGlbJson(model);
    assert.ok(json.meshes.length > 0, `${model} has no meshes`);
    const names = nodeNames(json);
    for (const name of required) {
      assert.ok(names.has(name), `${model} is missing node "${name}"`);
    }
  });
}
