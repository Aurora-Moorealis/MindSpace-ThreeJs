/**
 * Procedural low-poly models for every machine and interactive station.
 *
 * Each builder returns:
 *   { group, colliders, labelHeight, setState(view, sim), update(dt, sim), shield? }
 * The world places the group, rotates it from the data row and registers the
 * colliders. No bespoke simulation lives here: visuals only.
 */

import * as THREE from 'three';
import {
  COLORS,
  box,
  cylinder,
  glowBar,
  material,
  rounded,
  sphere,
  makeCanvasTexture,
  makeHazardTexture,
  seededRandom,
} from './primitives.js';

const HAZARD_TEXTURE = makeHazardTexture();
HAZARD_TEXTURE.wrapS = THREE.RepeatWrapping;
HAZARD_TEXTURE.wrapT = THREE.RepeatWrapping;
HAZARD_TEXTURE.repeat.set(3, 1);

const PANEL_TEXTURE = (() => {
  const texture = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0d3150';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2b6e9e';
    ctx.lineWidth = 3;
    const cell = w / 6;
    for (let i = 0; i <= 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(w, i * cell);
      ctx.stroke();
    }
    ctx.strokeStyle = '#6fd7ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
})();

function screenPlane(width, height, draw, { color = 0x9fe8ff } = {}) {
  const texture = makeCanvasTexture(512, 256, draw);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    transparent: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.userData.screenColor = color;
  return mesh;
}

function standardScreen(title, lines, accent = '#4de2ff') {
  return screenPlane(1.5, 0.8, (ctx, w, h) => {
    ctx.fillStyle = '#061018';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(77,226,255,0.08)';
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = accent;
    ctx.font = '700 30px "Rajdhani", sans-serif';
    ctx.fillText(title, 20, 42);
    ctx.strokeStyle = 'rgba(77,226,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 12, w - 28, h - 24);
    ctx.font = '500 22px "Rajdhani", sans-serif';
    ctx.fillStyle = '#cfe9ff';
    lines.forEach((line, i) => ctx.fillText(line, 22, 84 + i * 28));
    // Waveform.
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < 180; x += 4) {
      const y = 200 + Math.sin(x * 0.12) * 14 + Math.sin(x * 0.31) * 6;
      if (x === 0) ctx.moveTo(w - 200 + x, y);
      else ctx.lineTo(w - 200 + x, y);
    }
    ctx.stroke();
  });
}

function basePad(width = 2.8, depth = 2.1) {
  const group = new THREE.Group();
  const pad = rounded(width, 0.18, depth, 0.08, COLORS.darkMetal);
  pad.position.y = 0.09;
  group.add(pad);
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.9, 0.2),
    new THREE.MeshBasicMaterial({ map: HAZARD_TEXTURE, toneMapped: false })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.185, depth / 2 - 0.18);
  group.add(strip);
  return group;
}

function statusLight(color = COLORS.green, y = 2.1) {
  const light = sphere(0.1, 8, color, {
    material: new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    castShadow: false,
  });
  light.position.set(0, y, 0);
  return light;
}

function pipeBetween(a, b, radius = 0.05, color = COLORS.metal) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const mesh = cylinder(radius, radius, len, 8, color);
  mesh.position.copy(start).add(dir.clone().multiplyScalar(0.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function plantCluster(color = COLORS.green, scale = 1) {
  const group = new THREE.Group();
  const stem = cylinder(0.025 * scale, 0.035 * scale, 0.28 * scale, 5, 0x3f7d54);
  stem.position.y = 0.14 * scale;
  group.add(stem);
  for (let i = 0; i < 3; i += 1) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.13 * scale, 0.22 * scale, 5),
      material(color, { roughness: 0.9 })
    );
    leaf.position.y = 0.3 * scale + i * 0.05;
    leaf.rotation.z = (i - 1) * 0.55;
    leaf.rotation.y = i * 1.2;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

function buildO2() {
  const group = basePad(2.8, 2.1);
  const tanks = [];
  for (const x of [-0.62, 0.62]) {
    const tank = cylinder(0.36, 0.4, 1.65, 12, COLORS.metal);
    tank.position.set(x, 1.03, 0);
    group.add(tank);
    const cap = cylinder(0.36, 0.36, 0.12, 12, COLORS.darkMetal);
    cap.position.set(x, 1.9, 0);
    group.add(cap);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.405, 0.045, 6, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.green, toneMapped: false })
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 1.45, 0);
    group.add(band);
    tanks.push(tank);
  }
  group.add(pipeBetween([-0.3, 1.75, 0], [0.3, 1.75, 0], 0.055, COLORS.green));
  group.add(pipeBetween([0, 1.78, 0], [0, 2.25, 0], 0.055, COLORS.green));
  group.add(pipeBetween([0, 2.28, 0], [0.9, 2.28, 0.2], 0.04, COLORS.metal));
  const vent = box(0.55, 0.32, 0.12, COLORS.darkMetal);
  vent.position.set(0, 1.25, 0.94);
  group.add(vent);
  for (let i = 0; i < 4; i += 1) {
    const slat = box(0.44, 0.025, 0.02, COLORS.metal);
    slat.position.set(0, 1.15 + i * 0.065, 1.01);
    group.add(slat);
  }
  const screen = standardScreen('O2 GEN', ['LIFE SUPPORT', 'WATER → O₂', 'LIVE TELEMETRY']);
  screen.position.set(-0.02, 0.78, 1.12);
  screen.rotation.x = -0.35;
  group.add(screen);
  const fan = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const blade = box(0.03, 0.28, 0.08, COLORS.metal);
    blade.position.y = 0.12;
    blade.rotation.z = (i * Math.PI * 2) / 3;
    fan.add(blade);
  }
  fan.position.set(0.62, 2.3, 0.2);
  group.add(fan);
  const light = statusLight(COLORS.green, 2.55);
  group.add(light);
  const smoke = makeSmoke(0.9);
  smoke.group.position.set(0, 2.15, 0);
  group.add(smoke.group);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.5, d: 1.9 }],
    labelHeight: 3.1,
    parts: { fan, light, smoke, screen },
    update(dt, sim) {
      fan.rotation.y += dt * 7;
      light.material.color.setHex(sim.state.machines.o2_system.condition > 0 ? COLORS.green : COLORS.red);
      smoke.update(dt, sim.state.machines.o2_system.condition <= 0);
    },
  };
}

function buildWater() {
  const group = basePad(2.8, 2.1);
  const tank = cylinder(0.68, 0.74, 1.75, 18, 0x395f7c);
  tank.position.y = 1.08;
  group.add(tank);
  const top = cylinder(0.52, 0.68, 0.25, 18, COLORS.metal);
  top.position.y = 2.06;
  group.add(top);
  const cone = cylinder(0.7, 0.32, 0.34, 18, COLORS.darkMetal);
  cone.position.y = 0.2;
  group.add(cone);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.05, 6, 24),
    new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.35;
  group.add(ring);
  group.add(pipeBetween([0.55, 0.65, 0.3], [1.05, 0.65, 0.3], 0.07, COLORS.teal));
  group.add(pipeBetween([0.85, 0.65, 0.3], [0.85, 1.7, 0.3], 0.07, COLORS.teal));
  const screen = standardScreen('H2O REC', ['WATER LOOP', 'RECOVERY LIVE', 'CABIN CONDENSATE'], '#4de2ff');
  screen.position.set(-0.52, 0.88, 1.08);
  screen.rotation.x = -0.32;
  group.add(screen);
  const light = statusLight(COLORS.teal, 2.38);
  group.add(light);
  const smoke = makeSmoke(0.8);
  smoke.group.position.set(0, 2.0, 0);
  group.add(smoke.group);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.3, d: 1.9 }],
    labelHeight: 3.0,
    parts: { ring, light, smoke },
    update(dt, sim) {
      ring.rotation.z += dt * 0.8;
      light.material.color.setHex(sim.state.machines.water_recycler.condition > 0 ? COLORS.teal : COLORS.red);
      smoke.update(dt, sim.state.machines.water_recycler.condition <= 0);
    },
  };
}

function buildHydroponics() {
  const group = basePad(3.6, 2.2);
  const rack = new THREE.Group();
  for (const x of [-1.5, 1.5]) {
    for (const z of [-0.75, 0.75]) {
      const post = box(0.09, 2.15, 0.09, COLORS.metal);
      post.position.set(x, 1.12, z);
      rack.add(post);
    }
  }
  const LED_COLOR = 0xff65c8;
  for (let tier = 0; tier < 3; tier += 1) {
    const y = 0.55 + tier * 0.58;
    const tray = box(3.1, 0.12, 1.5, 0x22422f);
    tray.position.set(0, y, 0);
    rack.add(tray);
    const led = glowBar(2.9, 0.045, 0.1, LED_COLOR, 2);
    led.position.set(0, y + 0.5, 0.58);
    rack.add(led);
    for (let i = 0; i < 5; i += 1) {
      const plant = plantCluster(i % 2 === 0 ? COLORS.green : 0x9be7a0, 0.72 + (i % 3) * 0.08);
      plant.position.set(-1.2 + i * 0.6, y + 0.07, (i % 2 === 0 ? -0.18 : 0.22));
      rack.add(plant);
    }
  }
  const tank = cylinder(0.34, 0.4, 1.15, 12, 0x395f7c);
  tank.position.set(1.85, 0.72, -0.55);
  group.add(tank);
  const screen = standardScreen('HYDRO', ['GROW RACKS', 'FOOD + O₂', 'WATER LOOP']);
  screen.position.set(-1.95, 1.35, 0.95);
  screen.rotation.y = 0.25;
  group.add(screen);
  const light = statusLight(COLORS.green, 2.55);
  light.position.set(1.6, 2.55, 0.8);
  group.add(light);
  const smoke = makeSmoke(1.1);
  smoke.group.position.set(0, 2.2, 0);
  group.add(smoke.group);
  group.add(rack);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 3.4, d: 2.0 }],
    labelHeight: 3.15,
    parts: { light, smoke },
    update(dt, sim) {
      light.material.color.setHex(sim.state.machines.hydroponics.condition > 0 ? COLORS.green : COLORS.red);
      smoke.update(dt, sim.state.machines.hydroponics.condition <= 0);
    },
  };
}

function buildSolar() {
  const group = new THREE.Group();
  const foundation = rounded(5.4, 0.25, 5.0, 0.1, COLORS.darkMetal);
  foundation.position.y = 0.12;
  group.add(foundation);
  const dustPlanes = [];
  const panels = [];
  const positions = [
    [-1.35, -1.25],
    [1.35, -1.25],
    [-1.35, 1.25],
    [1.35, 1.25],
  ];
  for (const [x, z] of positions) {
    const frame = box(2.55, 0.12, 1.75, COLORS.metal);
    frame.position.set(x, 1.05, z);
    frame.rotation.x = -0.35;
    group.add(frame);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.6),
      new THREE.MeshStandardMaterial({
        map: PANEL_TEXTURE,
        roughness: 0.35,
        metalness: 0.35,
        emissive: 0x0b2b4a,
        emissiveIntensity: 0.55,
      })
    );
    panel.rotation.x = -Math.PI / 2 - 0.35;
    panel.position.set(x, 1.13, z);
    panel.receiveShadow = true;
    group.add(panel);
    panels.push(panel);
    const dust = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.5),
      new THREE.MeshBasicMaterial({
        color: 0x9b7c56,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    dust.rotation.x = -Math.PI / 2 - 0.35;
    dust.position.set(x, 1.15, z);
    group.add(dust);
    dustPlanes.push(dust);
    const leg = cylinder(0.07, 0.09, 1.0, 6, COLORS.darkMetal);
    leg.position.set(x, 0.55, z + 0.45);
    group.add(leg);
  }
  const inverter = rounded(1.0, 0.75, 0.8, 0.06, COLORS.metal);
  inverter.position.set(0, 0.5, 2.9);
  group.add(inverter);
  const invScreen = standardScreen('SOLAR', ['LIVE ARRAY', 'DUST SENSOR', 'TRACKING'], '#ffb347');
  invScreen.position.set(0, 0.65, 3.31);
  group.add(invScreen);
  const light = statusLight(COLORS.amber, 1.0);
  light.position.set(0, 1.0, 3.1);
  group.add(light);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 5.2, d: 4.6 }],
    labelHeight: 3.0,
    parts: { dustPlanes, light, invScreen },
    setState(view, sim) {
      const dust = sim.state.dust / 100;
      for (const plane of dustPlanes) plane.material.opacity = dust * 0.9;
      light.material.color.setHex(view.condition > 0 ? COLORS.amber : COLORS.red);
    },
    update() {},
  };
}

function buildBattery() {
  const group = basePad(2.8, 2.1);
  const bars = [];
  for (let i = 0; i < 3; i += 1) {
    const x = -0.82 + i * 0.82;
    const cell = cylinder(0.34, 0.36, 1.85, 10, COLORS.darkMetal);
    cell.position.set(x, 1.1, 0);
    group.add(cell);
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.035, 5, 16),
      new THREE.MeshBasicMaterial({ color: COLORS.amber, toneMapped: false })
    );
    ringA.rotation.x = Math.PI / 2;
    ringA.position.set(x, 0.6, 0);
    group.add(ringA);
    const ringB = ringA.clone();
    ringB.position.y = 1.6;
    group.add(ringB);
    const bar = glowBar(0.09, 1.2, 0.03, COLORS.amber, 1.4);
    bar.position.set(x + 0.29, 0.72, 0.26);
    group.add(bar);
    bars.push(bar);
  }
  const top = box(2.7, 0.12, 0.6, COLORS.metal);
  top.position.set(0, 2.08, 0);
  group.add(top);
  const screen = standardScreen('BATTERY', ['BATTERY BANK', 'CHARGE LIVE', 'BUS OK'], '#ffb347');
  screen.position.set(0, 0.92, 1.12);
  screen.rotation.x = -0.3;
  group.add(screen);
  const light = statusLight(COLORS.amber, 2.32);
  group.add(light);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.6, d: 1.9 }],
    labelHeight: 3.0,
    parts: { bars, light },
    setState(view, sim) {
      const charge = Math.max(0.02, sim.state.resources.energy / Math.max(1, sim.energyCapacity));
      for (const bar of bars) {
        bar.scale.y = charge;
        bar.position.y = 0.12 + (1.2 * charge) / 2;
      }
      light.material.color.setHex(view.condition > 0 ? COLORS.amber : COLORS.red);
    },
    update() {},
  };
}

function buildDistributor() {
  const group = basePad(2.6, 2.0);
  const pedestal = rounded(1.3, 1.15, 0.75, 0.06, COLORS.darkMetal);
  pedestal.position.set(0, 0.72, 0);
  group.add(pedestal);
  const screen = standardScreen('POWER BUS', ['LOAD LIVE', 'SOLAR LIVE', 'SHED ORDER'], '#ffb347');
  screen.position.set(0, 1.05, 0.39);
  screen.rotation.x = -0.2;
  group.add(screen);
  const levers = [];
  for (let i = 0; i < 4; i += 1) {
    const base = box(0.12, 0.05, 0.16, COLORS.metal);
    base.position.set(-0.42 + i * 0.28, 0.38, 0.43);
    group.add(base);
    const lever = box(0.07, 0.22, 0.07, COLORS.amber);
    lever.position.set(-0.42 + i * 0.28, 0.5, 0.43);
    lever.rotation.x = -0.5;
    group.add(lever);
    levers.push(lever);
  }
  const light = statusLight(COLORS.amber, 1.55);
  group.add(light);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.2, d: 1.8 }],
    labelHeight: 2.4,
    parts: { levers, light },
    setState(view, sim) {
      const states = [
        sim.state.toggles.lights,
        sim.state.machines.hydroponics.enabled,
        sim.state.machines.water_recycler.enabled,
        sim.state.machines.o2_system.enabled,
      ];
      levers.forEach((lever, i) => {
        lever.rotation.x = states[i] ? -0.5 : 0.5;
        lever.material = states[i] ? material(COLORS.amber) : material(COLORS.red);
      });
      light.material.color.setHex(view.condition > 0 ? COLORS.amber : COLORS.red);
    },
    update() {},
  };
}

function buildBench() {
  const group = basePad(3.0, 2.1);
  const table = box(2.7, 0.16, 1.1, COLORS.metal);
  table.position.set(0, 0.98, 0.1);
  group.add(table);
  for (const x of [-1.1, 1.1]) {
    for (const z of [-0.3, 0.5]) {
      const leg = box(0.1, 0.95, 0.1, COLORS.darkMetal);
      leg.position.set(x, 0.48, z);
      group.add(leg);
    }
  }
  const back = box(2.8, 1.5, 0.1, COLORS.darkMetal);
  back.position.set(0, 1.75, -0.92);
  group.add(back);
  for (let i = 0; i < 6; i += 1) {
    const tool = box(0.06 + (i % 3) * 0.04, 0.3, 0.03, i % 2 ? COLORS.amber : COLORS.metal);
    tool.position.set(-1.0 + i * 0.4, 1.95, -0.84);
    group.add(tool);
  }
  const armBase = cylinder(0.28, 0.34, 0.4, 10, COLORS.metal);
  armBase.position.set(1.1, 0.2, 0.6);
  group.add(armBase);
  const arm1 = box(0.14, 1.2, 0.14, COLORS.amber);
  arm1.position.set(1.1, 0.85, 0.6);
  arm1.rotation.z = -0.28;
  group.add(arm1);
  const arm2 = box(0.1, 0.9, 0.1, COLORS.amber);
  arm2.position.set(0.85, 1.55, 0.6);
  arm2.rotation.z = 0.5;
  group.add(arm2);
  const welder = sphere(0.08, 6, 0xdff6ff, {
    material: new THREE.MeshBasicMaterial({ color: 0xdff6ff, toneMapped: false }),
    castShadow: false,
  });
  welder.position.set(0.58, 1.95, 0.6);
  group.add(welder);
  const suit = new THREE.Group();
  const torso = rounded(0.55, 0.8, 0.38, 0.12, COLORS.white);
  torso.position.y = 1.5;
  suit.add(torso);
  const helmet = sphere(0.27, 12, COLORS.white);
  helmet.position.y = 2.08;
  suit.add(helmet);
  const visor = sphere(0.2, 10, 0x0a1620, {
    material: new THREE.MeshStandardMaterial({
      color: 0x0a1620,
      emissive: 0x2f8bb8,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.5,
    }),
  });
  visor.scale.set(1, 0.85, 0.45);
  visor.position.set(0, 2.05, 0.15);
  suit.add(visor);
  suit.position.set(-1.65, 0, -0.2);
  group.add(suit);
  const light = statusLight(COLORS.amber, 2.7);
  light.position.set(1.4, 2.55, 0.4);
  group.add(light);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.8, d: 2.0 }],
    labelHeight: 3.2,
    parts: { welder, light },
    update(dt, sim) {
      welder.visible = sim.state.machines.repair_bench.condition > 0 && Math.sin(performance.now() * 0.012) > 0.8;
      light.material.color.setHex(sim.state.machines.repair_bench.condition > 0 ? COLORS.amber : COLORS.red);
    },
  };
}

function buildComms() {
  const group = basePad(3.0, 2.2);
  const desk = rounded(2.8, 0.8, 0.9, 0.05, COLORS.darkMetal);
  desk.position.set(0, 0.55, 0);
  group.add(desk);
  const screens = [];
  for (let i = 0; i < 3; i += 1) {
    const x = -0.9 + i * 0.9;
    const frame = box(0.78, 0.8, 0.06, COLORS.black);
    frame.position.set(x, 1.3, -0.25);
    frame.rotation.x = -0.12;
    group.add(frame);
    const screen = standardScreen(
      ['DSN LINK', 'REPORT', 'FORECAST'][i],
      [
        ['SIGNAL 98%', 'PASS 4 min', 'ARCHIVE OK'],
        ['SAMPLES ABOARD', 'UPLINK READY', 'PRIORITY SCI'],
        ['STORM WATCH', 'Kp 9 WATCH', 'SHELTER NOW'],
      ][i],
      i === 1 ? '#6ee7a8' : '#4de2ff'
    );
    screen.scale.set(0.82, 0.82, 1);
    screen.position.set(x, 1.3, -0.21);
    screen.rotation.x = -0.12;
    group.add(screen);
    screens.push(screen);
  }
  const keyboard = box(1.4, 0.06, 0.35, COLORS.metal);
  keyboard.position.set(0, 0.98, 0.2);
  group.add(keyboard);
  const dish = new THREE.Group();
  const mount = cylinder(0.16, 0.22, 1.1, 8, COLORS.metal);
  mount.position.y = 0.55;
  dish.add(mount);
  const head = new THREE.Group();
  head.position.y = 1.15;
  const parabola = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6),
    new THREE.MeshStandardMaterial({
      color: 0xd7dde6,
      roughness: 0.45,
      metalness: 0.3,
      side: THREE.DoubleSide,
    })
  );
  parabola.rotation.x = Math.PI / 2;
  parabola.rotation.z = -0.5;
  head.add(parabola);
  const feed = cylinder(0.05, 0.05, 0.9, 6, COLORS.amber);
  feed.rotation.z = -0.5;
  feed.position.set(0.3, 0.5, 0.2);
  head.add(feed);
  dish.add(head);
  dish.position.set(1.3, 0, -0.8);
  group.add(dish);
  const light = statusLight(COLORS.teal, 2.1);
  light.position.set(-1.4, 2.0, 0);
  group.add(light);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.9, d: 1.8 }],
    labelHeight: 2.9,
    parts: { dish, head, screens, light },
    update(dt, sim) {
      head.rotation.y += dt * 0.12;
      light.material.color.setHex(sim.state.machines.comms_console.condition > 0 ? COLORS.teal : COLORS.red);
    },
  };
}

function buildShelter() {
  const group = new THREE.Group();
  const floor = rounded(4.4, 0.2, 4.4, 0.08, COLORS.darkMetal);
  floor.position.y = 0.1;
  group.add(floor);
  const back = box(0.35, 2.5, 4.2, 0x4a5568);
  back.position.set(-2.0, 1.35, 0);
  group.add(back);
  for (const z of [-1.95, 1.95]) {
    const side = box(4.1, 2.5, 0.32, 0x4a5568);
    side.position.set(0, 1.35, z);
    group.add(side);
  }
  // Open-top frame: the tilted camera must be able to see the astronaut inside.
  const roofFrame = new THREE.Group();
  for (const [rx, rz, rw, rd] of [
    [0, -2.05, 4.4, 0.14],
    [0, 2.05, 4.4, 0.14],
    [-2.05, 0, 0.14, 4.3],
    [2.05, 0, 0.14, 4.3],
  ]) {
    const beam = box(rw, 0.2, rd, 0x39414f);
    beam.position.set(rx, 2.72, rz);
    roofFrame.add(beam);
  }
  const crossBeam = box(4.0, 0.08, 0.1, 0x4a5568);
  crossBeam.position.set(0, 2.68, 0);
  roofFrame.add(crossBeam);
  group.add(roofFrame);
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.3),
    new THREE.MeshBasicMaterial({ map: HAZARD_TEXTURE, toneMapped: false })
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.22, 1.5);
  group.add(stripe);
  const bench = box(3.4, 0.3, 0.5, COLORS.metal);
  bench.position.set(-1.0, 0.55, 1.2);
  group.add(bench);
  const control = box(0.4, 0.7, 0.3, COLORS.darkMetal);
  control.position.set(1.9, 1.2, -1.4);
  group.add(control);
  const controlScreen = standardScreen('SHELTER', ['SEAL: OPEN', 'DOSE: LOW', 'LOCK: READY'], '#6ee7a8');
  controlScreen.scale.set(0.38, 0.3, 1);
  controlScreen.position.set(1.71, 1.3, -1.4);
  controlScreen.rotation.y = -Math.PI / 2;
  group.add(controlScreen);
  const shield = new THREE.Mesh(
    new THREE.PlaneGeometry(3.9, 2.4),
    new THREE.MeshBasicMaterial({
      color: COLORS.teal,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  shield.position.set(2.02, 1.35, 0);
  shield.rotation.y = Math.PI / 2;
  group.add(shield);
  const light = statusLight(COLORS.green, 2.9);
  light.position.set(0, 2.9, 0);
  group.add(light);
  return {
    group,
    colliders: [
      { x: -2.0, z: 0, w: 0.4, d: 4.2 },
      { x: 0, z: -1.95, w: 4.2, d: 0.35 },
      { x: 0, z: 1.95, w: 4.2, d: 0.35 },
    ],
    labelHeight: 3.5,
    parts: { shield, light, controlScreen },
    setState(view, sim) {
      shield.material.opacity = sim.state.shelterLocked ? 0.22 : 0;
      light.material.color.setHex(sim.state.shelterLocked ? COLORS.teal : COLORS.green);
    },
    update(dt, sim) {
      shield.material.opacity = sim.state.shelterLocked
        ? 0.16 + Math.sin(performance.now() * 0.003) * 0.05
        : 0;
    },
  };
}

function makeSmoke(scale = 1) {
  const group = new THREE.Group();
  const rand = seededRandom(99);
  const puffs = [];
  for (let i = 0; i < 5; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 * scale, 6, 5),
      new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    puff.position.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
    group.add(puff);
    puffs.push({ mesh: puff, phase: rand() * Math.PI * 2 });
  }
  let visible = false;
  return {
    group,
    update(dt, broken) {
      if (broken !== visible) {
        visible = broken;
        group.visible = broken;
      }
      if (!broken) return;
      const t = performance.now() * 0.001;
      puffs.forEach(({ mesh, phase }) => {
        const age = (t * 0.35 + phase) % 1;
        mesh.position.y = age * 1.4;
        mesh.scale.setScalar(0.5 + age * 1.5);
        mesh.material.opacity = 0.35 * (1 - age);
      });
    },
  };
}

const BUILDERS = {
  o2_system: buildO2,
  water_recycler: buildWater,
  hydroponics: buildHydroponics,
  solar_array: buildSolar,
  battery: buildBattery,
  power_distributor: buildDistributor,
  repair_bench: buildBench,
  comms_console: buildComms,
  storm_shelter: buildShelter,
};

export function buildMachine(id) {
  const builder = BUILDERS[id];
  if (!builder) throw new Error(`No visual builder for machine ${id}`);
  return builder();
}

/* ------------------------------------------------------------------------- */
/* Non-machine stations                                                       */
/* ------------------------------------------------------------------------- */

export function buildMissionBoard() {
  const group = new THREE.Group();
  const base = rounded(2.6, 0.18, 1.0, 0.06, COLORS.darkMetal);
  base.position.y = 0.09;
  group.add(base);
  const panel = box(2.4, 1.5, 0.12, COLORS.darkMetal);
  panel.position.set(0, 1.3, 0);
  panel.rotation.x = -0.08;
  group.add(panel);
  const mapTexture = makeCanvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#071018';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4de2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#4de2ff';
    ctx.font = '700 30px "Rajdhani", sans-serif';
    ctx.fillText('ARTEMIS RIDGE', 30, 54);
    ctx.fillStyle = '#9fb7cf';
    ctx.font = '500 20px "Rajdhani", sans-serif';
    ctx.fillText('SURVEY SITES  A / B / C', 30, 88);
    ctx.fillText('3 REPORTS TO WIN', 30, 116);
    ctx.strokeStyle = 'rgba(110,231,168,0.7)';
    ctx.beginPath();
    ctx.arc(380, 190, 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#6ee7a8';
    ctx.beginPath();
    ctx.arc(380, 190, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(300, 150, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(440, 230, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6ee7a8';
    ctx.font = '500 18px "Rajdhani", sans-serif';
    ctx.fillText('OUTPOST', 30, 210);
    ctx.fillText('COMMS', 30, 238);
    ctx.fillText('SHELTER', 30, 266);
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: mapTexture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.25), screenMat);
  screen.position.set(0, 1.35, 0.08);
  group.add(screen);
  const trim = glowBar(2.3, 0.04, 0.04, COLORS.teal, 1.5);
  trim.position.set(0, 2.08, 0.06);
  group.add(trim);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.5, d: 0.9 }],
    labelHeight: 2.4,
    update() {},
  };
}

export function buildHoloTable() {
  const group = new THREE.Group();
  const pedestal = cylinder(0.55, 0.85, 0.9, 12, COLORS.darkMetal);
  pedestal.position.y = 0.45;
  group.add(pedestal);
  const disc = cylinder(1.25, 1.25, 0.14, 28, COLORS.metal);
  disc.position.y = 0.95;
  group.add(disc);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 28),
    new THREE.MeshBasicMaterial({
      color: COLORS.teal,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 1.03;
  group.add(glow);
  const moon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.48, 1),
    new THREE.MeshBasicMaterial({ color: COLORS.teal, wireframe: true, transparent: true, opacity: 0.75 })
  );
  moon.position.y = 1.55;
  group.add(moon);
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.012, 4, 48),
    new THREE.MeshBasicMaterial({ color: COLORS.teal, transparent: true, opacity: 0.55 })
  );
  orbit.rotation.x = Math.PI / 2.3;
  orbit.position.y = 1.55;
  group.add(orbit);
  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.1, d: 2.1 }],
    labelHeight: 2.5,
    update(dt) {
      moon.rotation.y += dt * 0.25;
      orbit.rotation.z += dt * 0.1;
    },
  };
}

export function buildPoi(poi) {
  const group = new THREE.Group();
  const ringMaterialFilled = new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false });
  const ringMaterialEmpty = new THREE.MeshBasicMaterial({ color: 0x214152, toneMapped: false });
  const segments = [];
  for (let i = 0; i < 32; i += 1) {
    const angle = (i / 32) * Math.PI * 2;
    const segment = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.38), ringMaterialEmpty);
    segment.position.set(Math.cos(angle) * 1.75, 0.12, Math.sin(angle) * 1.75);
    segment.rotation.y = -angle;
    group.add(segment);
    segments.push(segment);
  }
  const pad = cylinder(1.4, 1.5, 0.08, 24, COLORS.darkMetal);
  pad.position.y = 0.06;
  group.add(pad);
  const drill = cylinder(0.22, 0.28, 1.5, 8, COLORS.metal);
  drill.position.y = 0.85;
  group.add(drill);
  for (let i = 0; i < 3; i += 1) {
    const leg = box(0.08, 0.9, 0.08, COLORS.amber);
    const angle = (i / 3) * Math.PI * 2;
    leg.position.set(Math.cos(angle) * 0.7, 0.45, Math.sin(angle) * 0.7);
    leg.rotation.z = 0.4 * Math.cos(angle);
    leg.rotation.x = 0.4 * Math.sin(angle);
    group.add(leg);
  }
  const head = rounded(0.5, 0.35, 0.5, 0.06, COLORS.white);
  head.position.y = 1.7;
  group.add(head);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 8, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: COLORS.teal,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  beacon.position.y = 4;
  group.add(beacon);
  const light = sphere(0.12, 8, COLORS.teal, {
    material: new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false }),
    castShadow: false,
  });
  light.position.y = 2.0;
  group.add(light);
  const pole = cylinder(0.03, 0.03, 2.2, 5, COLORS.metal);
  pole.position.set(1.4, 1.1, -1.1);
  group.add(pole);
  const flagTexture = makeCanvasTexture(128, 96, (ctx, w, h) => {
    ctx.fillStyle = '#0b1a26';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4de2ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.fillStyle = '#e8eef7';
    ctx.font = '700 64px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(poi.code, w / 2, h / 2 + 4);
  });
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.65),
    new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide, toneMapped: false })
  );
  flag.position.set(1.85, 2.05, -1.1);
  group.add(flag);
  return {
    group,
    colliders: [],
    labelHeight: 2.9,
    parts: { segments, ringMaterialFilled, ringMaterialEmpty, beacon, light, flag, drill },
    setProgress(progress, scanned) {
      const filled = Math.round(progress * segments.length);
      segments.forEach((segment, i) => {
        segment.material = scanned || i < filled ? ringMaterialFilled : ringMaterialEmpty;
      });
      const color = scanned ? COLORS.green : COLORS.teal;
      beacon.material.color.setHex(color);
      light.material.color.setHex(color);
      beacon.material.opacity = scanned ? 0.10 : 0.16 + Math.sin(performance.now() * 0.002) * 0.04;
    },
    update(dt) {
      flag.rotation.y = Math.sin(performance.now() * 0.001) * 0.08;
    },
  };
}

export function buildMineralVein(vein, mineral) {
  const group = new THREE.Group();
  const rand = seededRandom(vein.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));

  // Basalt outcrop base.
  const baseGeo = new THREE.DodecahedronGeometry(0.95, 0);
  const base = new THREE.Mesh(baseGeo, material(COLORS.moonDark, { roughness: 0.92 }));
  base.scale.set(1.25, 0.52, 1.15);
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Crystal / ore clusters.
  const oreMat = material(mineral.color, {
    roughness: 0.32,
    metalness: mineral.id === 'ilmenite' ? 0.55 : 0.18,
    emissive: mineral.emissive,
    emissiveIntensity: 0.55,
  });
  const crystals = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + rand() * 0.4;
    const dist = i === 0 ? 0.05 : 0.35 + rand() * 0.42;
    const h = 0.55 + rand() * 0.55;
    const r = 0.14 + rand() * 0.11;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), oreMat);
    shard.position.set(Math.cos(angle) * dist, 0.36 + h * 0.32, Math.sin(angle) * dist);
    shard.rotation.set((rand() - 0.5) * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.5);
    shard.castShadow = true;
    group.add(shard);
    crystals.push(shard);
  }

  // Mining progress ring on the ground.
  const segCount = 14;
  const ringFilled = new THREE.MeshBasicMaterial({ color: mineral.color, toneMapped: false });
  const ringEmpty = new THREE.MeshBasicMaterial({ color: 0x1b2d3b, toneMapped: false });
  const segments = [];
  for (let i = 0; i < segCount; i += 1) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.08), ringEmpty);
    const angle = (i / segCount) * Math.PI * 2;
    seg.position.set(Math.cos(angle) * 1.4, 0.06, Math.sin(angle) * 1.4);
    seg.rotation.y = -angle;
    group.add(seg);
    segments.push(seg);
  }

  return {
    group,
    colliders: [{ x: 0, z: 0, w: 1.8, d: 1.8 }],
    labelHeight: 2.0,
    setProgress(progress) {
      const filled = Math.round(progress * segments.length);
      for (let i = 0; i < segments.length; i += 1) {
        segments[i].material = i < filled ? ringFilled : ringEmpty;
      }
    },
    update() {},
  };
}

export function buildNasaTruck(proto) {
  const group = new THREE.Group();

  // Heavy 12-wheel Chariot chassis deck.
  const chassis = rounded(2.4, 0.28, 4.6, 0.06, COLORS.darkMetal);
  chassis.position.y = 0.72;
  group.add(chassis);

  // Gold thermal foil lower skirt.
  const foil = box(2.2, 0.22, 3.8, 0xc79a4a, {
    material: material(0xc79a4a, { roughness: 0.35, metalness: 0.6 }),
  });
  foil.position.y = 0.56;
  group.add(foil);

  // 12 wheels (3 bogie pairs per side = 6 wheels per side).
  const wheelMat = material(0x1f242c, { roughness: 0.85 });
  const hubMat = material(0xc79a4a, { roughness: 0.4, metalness: 0.6 });
  for (const side of [-1, 1]) {
    for (const z of [-1.75, -1.05, -0.2, 0.5, 1.3, 2.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.28, 0.42, z);
      wheel.castShadow = true;
      group.add(wheel);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.31, 10), hubMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * 1.28, 0.42, z);
      group.add(hub);
    }
  }

  // Forward pressurized truck cab.
  const cab = rounded(2.25, 1.45, 2.35, 0.14, COLORS.white);
  cab.position.set(0, 1.58, 0.85);
  group.add(cab);

  // Forward-angled panoramic cockpit window (SEV signature look).
  const windshield = box(1.9, 0.72, 0.16, COLORS.glass, {
    material: material(COLORS.glass, { roughness: 0.18, metalness: 0.2, emissive: 0x16445a, emissiveIntensity: 0.5 }),
    castShadow: false,
  });
  windshield.position.set(0, 1.66, 2.02);
  windshield.rotation.x = 0.24;
  group.add(windshield);

  // Side cab windows.
  for (const side of [-1, 1]) {
    const sideWin = box(0.08, 0.55, 1.1, COLORS.glass, {
      material: material(COLORS.glass, { roughness: 0.18, emissive: 0x16445a, emissiveIntensity: 0.4 }),
      castShadow: false,
    });
    sideWin.position.set(side * 1.13, 1.72, 1.15);
    group.add(sideWin);
  }

  // NASA-style blue & red livery stripe.
  const stripe = box(2.3, 0.12, 2.2, 0x2a66c9, { castShadow: false });
  stripe.position.set(0, 1.12, 0.85);
  group.add(stripe);

  // Rear cargo/utility truck bed + suitports.
  const bed = rounded(2.2, 0.55, 1.9, 0.06, COLORS.metal);
  bed.position.set(0, 1.12, -1.35);
  group.add(bed);

  for (const side of [-0.52, 0.52]) {
    const suitport = cylinder(0.32, 0.34, 0.24, 12, COLORS.darkMetal);
    suitport.rotation.x = Math.PI / 2;
    suitport.position.set(side, 1.48, -0.35);
    group.add(suitport);
  }

  // Mast camera / lidar head.
  const mast = cylinder(0.05, 0.06, 1.0, 8, COLORS.metal);
  mast.position.set(-0.7, 2.55, -1.4);
  group.add(mast);
  const head = box(0.36, 0.18, 0.22, COLORS.white);
  head.position.set(-0.7, 3.05, -1.4);
  group.add(head);
  const lens = glowBar(0.14, 0.08, 0.04, COLORS.teal);
  lens.position.set(-0.7, 3.05, -1.28);
  group.add(lens);

  // Headlights.
  for (const side of [-0.68, 0.68]) {
    const lamp = glowBar(0.24, 0.1, 0.06, COLORS.warm);
    lamp.position.set(side, 1.08, 2.04);
    group.add(lamp);
  }

  // Side nameplate sign.
  const signTex = makeCanvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0a1626';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4de2ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#eef5ff';
    ctx.font = '700 44px "Rajdhani", sans-serif';
    ctx.fillText('NASA SEV · CHARIOT', 24, 58);
    ctx.fillStyle = '#ffb347';
    ctx.font = '600 28px "Rajdhani", sans-serif';
    ctx.fillText('12-WHEEL LUNAR PROTOTYPE', 24, 98);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 0.44),
    new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })
  );
  sign.position.set(-1.14, 1.24, -1.35);
  sign.rotation.y = -Math.PI / 2;
  group.add(sign);

  return {
    group,
    colliders: [{ x: 0, z: 0, w: 3.2, d: 5.2 }],
    labelHeight: 3.4,
    update(dt) {
      head.rotation.y = Math.sin(performance.now() * 0.0008) * 0.45;
    },
  };
}

export function buildIceMelter() {
  const group = basePad(2.2, 1.9);

  // Thermal melting drum.
  const drum = cylinder(0.55, 0.62, 1.35, 16, COLORS.darkMetal);
  drum.position.set(-0.35, 0.88, 0);
  group.add(drum);

  // Glowing amber heating coil around the melting chamber.
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.61, 0.045, 8, 20),
    glowMaterial(COLORS.amber)
  );
  coil.rotation.x = Math.PI / 2;
  coil.position.set(-0.35, 0.72, 0);
  group.add(coil);

  // Translucent cyan liquid reservoir tank.
  const tankShell = cylinder(0.38, 0.38, 1.1, 14, COLORS.glass, {
    material: material(COLORS.glass, { transparent: true, opacity: 0.42, roughness: 0.15 }),
  });
  tankShell.position.set(0.45, 0.76, 0);
  group.add(tankShell);

  const liquidCore = cylinder(0.31, 0.31, 0.85, 12, 0x38d9ff, {
    material: material(0x38d9ff, { emissive: 0x1688b8, emissiveIntensity: 0.7, roughness: 0.2 }),
  });
  liquidCore.position.set(0.45, 0.65, 0);
  group.add(liquidCore);

  // Top ice hopper.
  const hopper = cylinder(0.46, 0.32, 0.35, 12, COLORS.metal);
  hopper.position.set(-0.35, 1.72, 0);
  group.add(hopper);

  // Screen.
  const screen = standardScreen('ICE MELTER', ['H2O FEEDSTOCK', 'TO HYDROPONICS', 'LCROSS ISRU'], '#4de2ff');
  screen.position.set(0, 1.18, 0.82);
  group.add(screen);

  // Liquid delivery pipe connecting Ice Melter -> Hydroponics plants (+X direction).
  const pipe = cylinder(0.065, 0.065, 2.75, 10, 0x4b7088);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(2.15, 0.55, 0);
  group.add(pipe);

  // Translucent flow jacket & animated liquid droplets moving into the plants.
  const flowBeads = [];
  const beadMat = glowMaterial(0x52e8ff);
  for (let i = 0; i < 5; i += 1) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), beadMat);
    bead.position.set(0.85 + i * 0.52, 0.55, 0);
    group.add(bead);
    flowBeads.push({ mesh: bead, phase: i / 5 });
  }

  const light = statusLight(COLORS.teal, 2.05);
  light.position.set(-0.35, 2.0, 0);
  group.add(light);

  return {
    group,
    colliders: [{ x: 0, z: 0, w: 2.2, d: 1.9 }],
    labelHeight: 2.35,
    update(dt, sim) {
      const boosting = (sim?.state?.iceMeltBoostUntil ?? -1) > (sim?.state?.tick ?? 0);
      const flowSpeed = boosting ? 0.95 : 0.38;
      const t = performance.now() * 0.001;
      for (const bead of flowBeads) {
        const p = (t * flowSpeed + bead.phase) % 1;
        bead.mesh.position.x = 0.85 + p * 2.65;
        bead.mesh.scale.setScalar(boosting ? 1.25 : 0.85);
      }
      liquidCore.scale.y = 0.78 + Math.sin(t * 2.1) * 0.08;
      light.material.color.setHex(boosting ? COLORS.green : COLORS.teal);
    },
  };
}
