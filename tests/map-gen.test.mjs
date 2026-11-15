import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BIOMES,
  MAP_BOUNDS,
  generateProceduralMap,
  normalizeSeed,
} from '../src/world/map-gen.js';
import { MINERAL_ORDER } from '../src/data/minerals.js';

test('procedural map generator is deterministic for numeric and string seeds', () => {
  const a = generateProceduralMap(482193);
  const b = generateProceduralMap('482193');
  assert.equal(a.seed, b.seed);
  assert.equal(a.biome.id, b.biome.id);
  assert.deepEqual(a.pois, b.pois);
  assert.deepEqual(a.mineralVeins, b.mineralVeins);
  assert.deepEqual(a.prototypeTruck, b.prototypeTruck);
  assert.equal(a.heightAt(18.5, 42.3), b.heightAt(18.5, 42.3));

  const strA = generateProceduralMap('artemis-ridge');
  const strB = generateProceduralMap('artemis-ridge');
  assert.equal(strA.seed, strB.seed);
  assert.deepEqual(strA.pois, strB.pois);
});

test('different seeds produce distinct procedural maps', () => {
  const m1 = generateProceduralMap(111111);
  const m2 = generateProceduralMap(999999);
  assert.notEqual(normalizeSeed(111111), normalizeSeed(999999));
  const samePositions = m1.pois.every(
    (p, idx) => p.position[0] === m2.pois[idx].position[0] && p.position[2] === m2.pois[idx].position[2]
  );
  assert.equal(samePositions, false);
});

test('procedural map places all POIs, minerals, and NASA truck safely within bounds', () => {
  for (const seed of [1001, 224466, 777333, 'mindspace-alpha']) {
    const map = generateProceduralMap(seed);
    assert.ok(BIOMES.some((b) => b.id === map.biome.id));
    assert.equal(map.pois.length, 3);
    assert.equal(map.mineralVeins.length, 12);

    // Habitat & airlock apron stay completely flat.
    assert.equal(map.heightAt(0, 0), 0);
    assert.equal(map.heightAt(0, 18), 0);

    // Every mineral type is represented equally.
    for (const mineralId of MINERAL_ORDER) {
      const count = map.mineralVeins.filter((v) => v.mineralId === mineralId).length;
      assert.equal(count, 3, `expected 3 veins of ${mineralId} for seed ${seed}`);
    }

    // All exterior interactables lie inside playable exterior bounds and clear of airlock & solar array.
    const interactableSpots = [
      ...map.pois.map((p) => ({ id: p.id, x: p.position[0], z: p.position[2] })),
      ...map.mineralVeins.map((v) => ({ id: v.id, x: v.position[0], z: v.position[2] })),
      { id: 'truck', x: map.prototypeTruck.position[0], z: map.prototypeTruck.position[2] },
    ];

    for (const spot of interactableSpots) {
      assert.ok(spot.x >= MAP_BOUNDS.minX && spot.x <= MAP_BOUNDS.maxX, `${spot.id} x out of bounds`);
      assert.ok(spot.z >= 19 && spot.z <= MAP_BOUNDS.maxZ, `${spot.id} z out of exterior bounds`);
      assert.ok(Math.hypot(spot.x, spot.z - 18) >= 7.5, `${spot.id} too close to airlock`);
      assert.ok(Math.hypot(spot.x - 13, spot.z - 25) >= 6.0, `${spot.id} too close to solar_array`);
    }

    // Ensure no two key features overlap too tightly.
    for (let i = 0; i < interactableSpots.length; i += 1) {
      for (let j = i + 1; j < interactableSpots.length; j += 1) {
        const dist = Math.hypot(
          interactableSpots[i].x - interactableSpots[j].x,
          interactableSpots[i].z - interactableSpots[j].z
        );
        assert.ok(dist >= 5.5, `${interactableSpots[i].id} and ${interactableSpots[j].id} overlap (${dist})`);
      }
    }
  }
});
