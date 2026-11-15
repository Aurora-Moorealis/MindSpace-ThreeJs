/**
 * Deterministic procedural lunar surface generator.
 * Pure data + math (no Three.js or DOM) so worlds can be generated in Node tests
 * and reproduced identically from any seed.
 */

import { POIS } from '../data/pois.js';
import { MINERAL_ORDER, MINERAL_VEINS, NASA_PROTOTYPE_TRUCK } from '../data/minerals.js';

export const MAP_BOUNDS = { minX: -46, maxX: 46, minZ: -15.1, maxZ: 61.5 };

export const BIOMES = [
  {
    id: 'artemis_highlands',
    name: 'Artemis Highlands',
    groundColor: 0xcac8c3,
    rockColor: 0x83848b,
    rockLightColor: 0x9b9ba2,
    heightScale: 0.42,
    rockCount: 54,
    craterCount: 18,
  },
  {
    id: 'basalt_mare',
    name: 'Mare Basalt Plain',
    groundColor: 0xadafb7,
    rockColor: 0x6a6e79,
    rockLightColor: 0x818691,
    heightScale: 0.28,
    rockCount: 44,
    craterCount: 16,
  },
  {
    id: 'polar_shadow',
    name: 'South Polar Basin',
    groundColor: 0xbcc4cf,
    rockColor: 0x76808f,
    rockLightColor: 0x8e99aa,
    heightScale: 0.48,
    rockCount: 50,
    craterCount: 21,
  },
  {
    id: 'ejecta_field',
    name: 'Ejecta Boulder Field',
    groundColor: 0xc4bfb6,
    rockColor: 0x86817a,
    rockLightColor: 0x9e9890,
    heightScale: 0.36,
    rockCount: 64,
    craterCount: 17,
  },
];

export function randomSeed() {
  return Math.floor(100000 + Math.random() * 900000);
}

export function normalizeSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    const n = Math.abs(Math.floor(input)) % 2147483646;
    return n === 0 ? 1 : n;
  }
  if (typeof input === 'string' && input.trim()) {
    const trimmed = input.trim();
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && /^\d+$/.test(trimmed)) {
      const n = Math.abs(Math.floor(numeric)) % 2147483646;
      return n === 0 ? 1 : n;
    }
    let hash = 2166136261;
    for (let i = 0; i < trimmed.length; i += 1) {
      hash ^= trimmed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const n = (hash >>> 0) % 2147483646;
    return n === 0 ? 1 : n;
  }
  return 482193;
}

export function createRng(seed) {
  let state = normalizeSeed(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function createNoise2D(seed) {
  const s = normalizeSeed(seed);
  const valueNoise = (x, z) => {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = smoothstep(x - ix);
    const fz = smoothstep(z - iz);
    const a = hash2D(ix, iz, s);
    const b = hash2D(ix + 1, iz, s);
    const c = hash2D(ix, iz + 1, s);
    const d = hash2D(ix + 1, iz + 1, s);
    const ab = a + (b - a) * fx;
    const cd = c + (d - c) * fx;
    return (ab + (cd - ab) * fz) * 2 - 1;
  };

  return (x, z) => {
    const n1 = valueNoise(x * 0.045, z * 0.045) * 0.6;
    const n2 = valueNoise(x * 0.11 + 17.3, z * 0.11 - 9.1) * 0.28;
    const n3 = valueNoise(x * 0.25 - 4.7, z * 0.25 + 13.4) * 0.12;
    return n1 + n2 + n3;
  };
}

function pickClearPoint(rand, occupied, { minX, maxX, minZ, maxZ, clearance, minAirlockDist = 0 }) {
  let bestCandidate = null;
  let bestMinGap = -Infinity;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    if (minAirlockDist > 0 && Math.hypot(x, z - 16.5) < minAirlockDist) continue;

    let minGap = Infinity;
    let blocked = false;
    for (const item of occupied) {
      const dist = Math.hypot(x - item.x, z - item.z);
      const gap = dist - (clearance + item.r);
      if (gap < minGap) minGap = gap;
      if (gap < 0) {
        blocked = true;
        break;
      }
    }
    if (!blocked) {
      return { x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) };
    }
    if (minGap > bestMinGap) {
      bestMinGap = minGap;
      bestCandidate = { x: Number(x.toFixed(2)), z: Number(z.toFixed(2)) };
    }
  }

  return bestCandidate ?? {
    x: Number(((minX + maxX) * 0.5).toFixed(2)),
    z: Number(((minZ + maxZ) * 0.5).toFixed(2)),
  };
}

export function generateProceduralMap(seedInput) {
  const seed = normalizeSeed(seedInput);
  const rand = createRng(seed);
  const fbm = createNoise2D(seed);
  const biome = BIOMES[Math.floor(rand() * BIOMES.length)];

  // Exclusion circles for habitat apron, airlock corridor, and fixed exterior machines.
  const occupied = [
    { x: 0, z: 18, r: 7.5 }, // airlock exit apron
    { x: 7.2, z: 20.0, r: 2.8 }, // small base rover
    { x: 13, z: 25, r: 6.2 }, // exterior solar_array
    { x: -6.5, z: 21.5, r: 3.0 }, // outpost flag
  ];

  // 1. Survey Sites (3 POIs spread across West / Center / East sectors).
  const poiSectors = [
    { minX: -34, maxX: -10, minZ: 27, maxZ: 38 },
    { minX: -10, maxX: 12, minZ: 36, maxZ: 48 },
    { minX: 12, maxX: 36, minZ: 42, maxZ: 55 },
  ];
  // Randomize sector-to-site assignment slightly while keeping progressive depth.
  const pois = POIS.map((basePoi, index) => {
    const sector = poiSectors[index] ?? poiSectors[0];
    const pos = pickClearPoint(rand, occupied, {
      ...sector,
      clearance: 4.8,
      minAirlockDist: 14,
    });
    occupied.push({ x: pos.x, z: pos.z, r: 4.8 });
    return {
      ...basePoi,
      position: [pos.x, 0, pos.z],
    };
  });

  // 2. Cargo Lander landmark on outer flank.
  const landerSide = rand() > 0.5 ? 1 : -1;
  const landerPos = pickClearPoint(rand, occupied, {
    minX: landerSide > 0 ? 22 : -40,
    maxX: landerSide > 0 ? 40 : -22,
    minZ: 36,
    maxZ: 54,
    clearance: 6.5,
  });
  occupied.push({ x: landerPos.x, z: landerPos.z, r: 6.5 });
  const lander = {
    x: landerPos.x,
    z: landerPos.z,
    rotationY: (rand() - 0.5) * Math.PI,
  };

  // 3. NASA SEV / Chariot Prototype Truck.
  const truckPos = pickClearPoint(rand, occupied, {
    minX: -34,
    maxX: 34,
    minZ: 22,
    maxZ: 42,
    clearance: 5.0,
    minAirlockDist: 10,
  });
  occupied.push({ x: truckPos.x, z: truckPos.z, r: 5.0 });
  const prototypeTruck = {
    ...NASA_PROTOTYPE_TRUCK,
    position: [truckPos.x, 0, truckPos.z],
    rotationY: Number((-1.2 + rand() * 2.4).toFixed(2)),
  };

  // 4. Infinite Mineral Veins (3 of each of the 4 NASA minerals = 12 veins).
  const countsPerMineral = Math.max(1, Math.floor(MINERAL_VEINS.length / MINERAL_ORDER.length));
  const mineralVeins = [];
  for (const mineralId of MINERAL_ORDER) {
    for (let i = 0; i < countsPerMineral; i += 1) {
      const zBand =
        mineralId === 'water_ice'
          ? { minZ: 22 + i * 10, maxZ: 34 + i * 11 }
          : { minZ: 21 + i * 11, maxZ: 35 + i * 11 };
      const pos = pickClearPoint(rand, occupied, {
        minX: -39,
        maxX: 39,
        minZ: Math.max(21, zBand.minZ),
        maxZ: Math.min(57, zBand.maxZ),
        clearance: 4.0,
        minAirlockDist: 9,
      });
      occupied.push({ x: pos.x, z: pos.z, r: 4.0 });
      const shortPrefix = mineralId === 'water_ice' ? 'ice' : mineralId.slice(0, 3);
      mineralVeins.push({
        id: `vein_${shortPrefix}_${i + 1}`,
        mineralId,
        position: [pos.x, 0, pos.z],
      });
    }
  }

  // 5. Cargo crates around exterior staging zone.
  const crateColors = [0x6f7b8a, 0x7a6f5e, 0x66707c, 0x5f6b79];
  const crates = crateColors.map((color, idx) => {
    const nearBase = idx < 2;
    const pos = pickClearPoint(rand, occupied, {
      minX: nearBase ? -16 : -34,
      maxX: nearBase ? 18 : 34,
      minZ: nearBase ? 19 : 26,
      maxZ: nearBase ? 24 : 48,
      clearance: 2.4,
      minAirlockDist: 6.5,
    });
    occupied.push({ x: pos.x, z: pos.z, r: 2.2 });
    return {
      x: pos.x,
      z: pos.z,
      color,
      size: Number((0.9 + rand() * 0.55).toFixed(2)),
      rotationY: Number((rand() * Math.PI * 2).toFixed(2)),
    };
  });

  // 6. Craters (visual + terrain bowl relief).
  const craters = [];
  for (let i = 0; i < biome.craterCount; i += 1) {
    const size = Number((3.2 + rand() * 9.5).toFixed(2));
    const pos = pickClearPoint(rand, [{ x: 0, z: 18, r: 6.5 }], {
      minX: -45,
      maxX: 45,
      minZ: 21,
      maxZ: 60,
      clearance: size * 0.35,
      minAirlockDist: 8,
    });
    craters.push({
      x: pos.x,
      z: pos.z,
      size,
      rotationZ: Number((rand() * Math.PI * 2).toFixed(2)),
    });
  }

  // 7. Rocks / boulders (never placed inside occupied gameplay pads).
  const rocks = [];
  for (let i = 0; i < biome.rockCount; i += 1) {
    const size = Number((0.3 + rand() * 2.1).toFixed(2));
    const x = Number((-50 + rand() * 100).toFixed(2));
    const z = Number((19 + rand() * 45).toFixed(2));
    const tooClose = occupied.some((item) => Math.hypot(x - item.x, z - item.z) < item.r + size * 0.9);
    if (tooClose) continue;
    rocks.push({
      x,
      z,
      size,
      light: rand() > 0.5,
      scaleY: Number((0.55 + rand() * 0.6).toFixed(2)),
      rx: Number((rand() * Math.PI).toFixed(2)),
      ry: Number((rand() * Math.PI).toFixed(2)),
      rz: Number((rand() * Math.PI).toFixed(2)),
    });
  }

  // 8. Far southern horizon ridge rocks.
  const ridge = [];
  const ridgeCount = 17;
  for (let i = 0; i < ridgeCount; i += 1) {
    ridge.push({
      x: Number((-52 + i * 6.5 + (rand() - 0.5) * 2.2).toFixed(2)),
      z: Number((64 + rand() * 4.5).toFixed(2)),
      size: Number((2.3 + rand() * 2.8).toFixed(2)),
      rx: Number(rand().toFixed(2)),
      ry: Number(rand().toFixed(2)),
      rz: Number(rand().toFixed(2)),
    });
  }

  // 9. Work lights near airlock, solar array, lander, and survey sites.
  const workLights = [
    { x: 0, z: 21, color: 'amber' },
    { x: 13, z: 28, color: 'amber' },
    ...pois.map((poi) => ({
      x: Number((poi.position[0] + (poi.position[0] > 0 ? -1.8 : 1.8)).toFixed(2)),
      z: Number((poi.position[2] + 2.2).toFixed(2)),
      color: 'teal',
    })),
  ];

  // 10. Path guide markers curving gently from airlock toward Site A/B corridor.
  const pathTarget = pois[0]?.position ?? [0, 0, 38];
  const pathMarkers = [];
  for (let i = 0; i < 8; i += 1) {
    const t = i / 7;
    const z = 19 + t * 24;
    const driftX = (pathTarget[0] * 0.35) * t * t;
    pathMarkers.push({ x: Number((driftX - 3.1).toFixed(2)), z: Number(z.toFixed(2)) });
    pathMarkers.push({ x: Number((driftX + 3.1).toFixed(2)), z: Number(z.toFixed(2)) });
  }

  // Terrain elevation query for vertex displacement.
  const heightAt = (worldX, worldZ) => {
    // Keep habitat footprint and airlock apron completely flat.
    if (worldZ < 19.5 && Math.abs(worldX) < 34) return 0;
    const apronFadeZ = Math.max(0, Math.min(1, (worldZ - 19.5) / 5.5));
    const apronFadeX = Math.abs(worldX) < 34 ? 1 : Math.max(0, Math.min(1, (Math.abs(worldX) - 34) / 6));
    const apronMask = Math.max(apronFadeZ, apronFadeX);
    if (apronMask <= 0) return 0;

    // Flatten immediate POI & mineral vein pads slightly so meshes sit flush.
    let padFlatten = 1;
    for (const poi of pois) {
      const d = Math.hypot(worldX - poi.position[0], worldZ - poi.position[2]);
      if (d < 4.5) padFlatten = Math.min(padFlatten, Math.max(0, (d - 2.0) / 2.5));
    }

    let h = fbm(worldX, worldZ) * biome.heightScale;
    // Gentle rise toward the distant southern/side horizon.
    const distFromCenter = Math.max(0, Math.hypot(worldX * 0.8, Math.max(0, worldZ - 32)) - 34);
    h += distFromCenter * 0.045;

    // Subtle crater bowls.
    for (const c of craters) {
      const r = c.size * 0.48;
      const d = Math.hypot(worldX - c.x, worldZ - c.z);
      if (d < r) {
        const norm = d / r;
        h -= (1 - norm * norm) * Math.min(0.45, c.size * 0.04);
      }
    }

    return h * apronMask * padFlatten;
  };

  return {
    seed,
    biome,
    bounds: { ...MAP_BOUNDS },
    pois,
    mineralVeins,
    prototypeTruck,
    lander,
    crates,
    craters,
    rocks,
    ridge,
    workLights,
    pathMarkers,
    heightAt,
  };
}
