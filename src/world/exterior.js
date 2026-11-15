/**
 * Lunar exterior: ground, craters, rocks, a cargo lander, a rover, path markers
 * and drifting dust. The three survey sites are added by the world builder from
 * the POI data rows, so this file only provides the stage around them.
 */

import * as THREE from 'three';
import {
  COLORS,
  box,
  cylinder,
  material,
  makeCanvasTexture,
  makeHazardTexture,
  rounded,
  seededRandom,
  sphere,
} from './primitives.js';

function makeMoonTexture() {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rand = seededRandom(7);
    ctx.fillStyle = '#8b8b91';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6500; i += 1) {
      const value = 110 + Math.floor(rand() * 70);
      ctx.fillStyle = `rgba(${value},${value},${value + 4},${0.18 + rand() * 0.35})`;
      const size = 1 + rand() * 3;
      ctx.fillRect(rand() * w, rand() * h, size, size);
    }
    for (let i = 0; i < 24; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 6 + rand() * 28;
      ctx.strokeStyle = 'rgba(80,80,88,0.45)';
      ctx.lineWidth = 2 + rand() * 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(70,70,78,0.18)';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function makeCraterTexture() {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(50,50,58,0.55)');
    grad.addColorStop(0.72, 'rgba(74,74,82,0.35)');
    grad.addColorStop(0.86, 'rgba(176,176,182,0.55)');
    grad.addColorStop(1, 'rgba(140,140,148,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

export class ExteriorBuilder {
  constructor() {
    this.group = new THREE.Group();
    this.colliders = [];
    this.dust = null;
    this.animated = [];
    this.moonTexture = makeMoonTexture();
    this.moonTexture.wrapS = THREE.RepeatWrapping;
    this.moonTexture.wrapT = THREE.RepeatWrapping;
    this.moonTexture.repeat.set(10, 10);
    this.craterTexture = makeCraterTexture();
  }

  addCollider(cx, cz, w, d) {
    this.colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  }

  ground() {
    const geo = new THREE.PlaneGeometry(220, 220, 48, 48);
    const position = geo.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const bump =
        Math.sin(x * 0.09) * Math.cos(y * 0.07) * 0.08 +
        Math.sin(x * 0.31 + y * 0.17) * 0.035;
      position.setZ(i, bump);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: this.moonTexture,
      color: 0xc8c6c1,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-8, -0.12, 30);
    ground.receiveShadow = true;
    this.group.add(ground);

    // Threshold plate at the airlock.
    const plate = box(6.2, 0.1, 3.2, 0x4b4f56);
    plate.position.set(0, -0.02, 17.4);
    plate.receiveShadow = true;
    this.group.add(plate);
    const hazard = new THREE.Mesh(
      new THREE.PlaneGeometry(6.0, 1.2),
      new THREE.MeshBasicMaterial({ map: makeHazardTexture(), toneMapped: false })
    );
    hazard.rotation.x = -Math.PI / 2;
    hazard.position.set(0, 0.045, 16.8);
    this.group.add(hazard);
  }

  craters() {
    const rand = seededRandom(42);
    const craterMat = new THREE.MeshBasicMaterial({
      map: this.craterTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const positions = [
      [-18, 33, 9],
      [4, 43, 11],
      [20, 51, 8],
      [-34, 28, 7],
      [32, 36, 6],
      [-12, 52, 7],
      [42, 55, 13],
      [-42, 48, 10],
      [0, 24, 4],
    ];
    for (let i = 0; i < 8; i += 1) {
      positions.push([-46 + rand() * 92, 20 + rand() * 44, 2.5 + rand() * 5]);
    }
    for (const [x, z, size] of positions) {
      const crater = new THREE.Mesh(new THREE.PlaneGeometry(size, size), craterMat);
      crater.rotation.x = -Math.PI / 2;
      crater.rotation.z = rand() * Math.PI * 2;
      crater.position.set(x, -0.09, z);
      crater.renderOrder = 1;
      this.group.add(crater);
    }
  }

  rocks() {
    const rand = seededRandom(1234);
    const rockMat = material(0x7f7f86, { roughness: 0.95, flatShading: true });
    const rockMatLight = material(0x96969c, { roughness: 0.95, flatShading: true });
    for (let i = 0; i < 55; i += 1) {
      const x = -52 + rand() * 104;
      const z = 18 + rand() * 48;
      // Keep the central airlock corridor and the three POIs readable.
      if (Math.hypot(x, z - 20) < 7) continue;
      if (Math.hypot(x + 16, z - 31) < 3.4) continue;
      if (Math.hypot(x - 2, z - 41) < 3.4) continue;
      if (Math.hypot(x - 18, z - 49) < 3.4) continue;
      const size = 0.3 + rand() * 2.2;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 0),
        rand() > 0.5 ? rockMat : rockMatLight
      );
      rock.position.set(x, -0.1 + size * 0.35, z);
      rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
      rock.scale.y = 0.55 + rand() * 0.6;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      if (size > 1.4) this.addCollider(x, z, size * 1.6, size * 1.6);
    }

    // A rocky ridge at the far edge.
    for (let i = 0; i < 16; i += 1) {
      const x = -52 + i * 6.5;
      const size = 2.5 + rand() * 2.5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rockMat);
      rock.position.set(x, -0.2 + size * 0.25, 65 + rand() * 3);
      rock.rotation.set(rand(), rand(), rand());
      rock.scale.y = 0.6;
      rock.castShadow = true;
      this.group.add(rock);
    }
  }

  pathMarkers() {
    const teal = new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false });
    for (let i = 0; i < 9; i += 1) {
      const z = 19 + i * 4.2;
      for (const x of [-3.2, 3.2]) {
        const post = box(0.06, 0.55, 0.06, COLORS.metal);
        post.position.set(x, 0.24, z);
        this.group.add(post);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), teal);
        tip.position.set(x, 0.55, z);
        this.group.add(tip);
      }
    }
  }

  rover() {
    const group = new THREE.Group();
    const chassis = rounded(2.6, 0.45, 1.35, 0.08, 0xd8d8d4);
    chassis.position.y = 0.62;
    group.add(chassis);
    const panel = box(1.5, 0.06, 1.0, 0x1b4a6e);
    panel.position.set(0.1, 0.9, 0);
    group.add(panel);
    for (const [x, z] of [
      [-0.95, -0.72],
      [0.95, -0.72],
      [-0.95, 0.72],
      [0.95, 0.72],
    ]) {
      const wheel = cylinder(0.26, 0.26, 0.24, 10, 0x2a2f36);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.34, z);
      group.add(wheel);
      const hub = cylinder(0.09, 0.09, 0.27, 8, COLORS.amber);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(x, 0.34, z);
      group.add(hub);
    }
    const mast = cylinder(0.03, 0.04, 1.1, 6, COLORS.metal);
    mast.position.set(-0.6, 1.45, 0.2);
    group.add(mast);
    const camera = box(0.22, 0.16, 0.22, COLORS.white);
    camera.position.set(-0.6, 2.0, 0.2);
    group.add(camera);
    const dish = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshStandardMaterial({ color: 0xd7dde6, side: THREE.DoubleSide, roughness: 0.5 })
    );
    dish.rotation.x = Math.PI / 2;
    dish.position.set(0.8, 1.25, 0.2);
    group.add(dish);
    group.position.set(7.2, -0.08, 20.0);
    group.rotation.y = -0.5;
    this.group.add(group);
    this.addCollider(7.2, 20.0, 3.0, 1.8);
    this.animated.push((dt) => {
      // Almost imperceptible antenna sway.
      dish.rotation.z = Math.sin(performance.now() * 0.0004) * 0.05;
    });
  }

  lander() {
    const group = new THREE.Group();
    const body = cylinder(1.5, 1.7, 2.0, 8, 0xbfc2c4);
    body.position.y = 2.1;
    group.add(body);
    const ascent = cylinder(1.1, 1.2, 1.2, 8, 0xd7d9da);
    ascent.position.y = 3.7;
    group.add(ascent);
    const cap = sphere(0.6, 10, 0xc7c9cb);
    cap.position.y = 4.4;
    group.add(cap);
    const foil = cylinder(1.55, 1.65, 0.5, 8, 0xc79a4a, {
      material: material(0xc79a4a, { roughness: 0.35, metalness: 0.6 }),
    });
    foil.position.y = 1.3;
    group.add(foil);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = cylinder(0.09, 0.11, 2.6, 6, COLORS.metal);
      leg.position.set(Math.cos(angle) * 1.5, 1.3, Math.sin(angle) * 1.5);
      leg.rotation.z = Math.cos(angle) * 0.5;
      leg.rotation.x = Math.sin(angle) * 0.5;
      group.add(leg);
      const foot = cylinder(0.35, 0.42, 0.14, 8, COLORS.darkMetal);
      foot.position.set(Math.cos(angle) * 2.2, 0.06, Math.sin(angle) * 2.2);
      group.add(foot);
    }
    const antennaDish = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshStandardMaterial({ color: 0xd7dde6, side: THREE.DoubleSide, roughness: 0.5 })
    );
    antennaDish.rotation.x = Math.PI / 2;
    antennaDish.rotation.z = -0.4;
    antennaDish.position.set(0.8, 4.8, 0.4);
    group.add(antennaDish);
    const beacon = sphere(0.09, 6, COLORS.red, {
      material: new THREE.MeshBasicMaterial({ color: COLORS.red, toneMapped: false }),
      castShadow: false,
    });
    beacon.position.set(0, 4.85, 0);
    group.add(beacon);
    group.position.set(-38, -0.1, 47);
    group.rotation.y = 0.7;
    this.group.add(group);
    this.addCollider(-38, 47, 5.0, 5.0);
    this.animated.push(() => {
      beacon.visible = Math.sin(performance.now() * 0.003) > 0.5;
    });
  }

  cargo() {
    const rand = seededRandom(88);
    for (const [x, z, color, size] of [
      [-7.5, 19.4, 0x6f7b8a, 1.2],
      [7.8, 18.8, 0x7a6f5e, 0.9],
      [-26, 26, 0x66707c, 1.4],
      [30, 44, 0x5f6b79, 1.3],
    ]) {
      const crate = rounded(size, size * 0.85, size, 0.06, color);
      crate.position.set(x, size * 0.42 - 0.08, z);
      crate.rotation.y = rand() * Math.PI;
      this.group.add(crate);
      const band = box(size * 1.03, 0.1, size * 1.03, COLORS.amber);
      band.position.set(x, size * 0.58 - 0.08, z);
      band.rotation.y = crate.rotation.y;
      this.group.add(band);
      this.addCollider(x, z, size * 1.3, size * 1.3);
    }
  }

  flag() {
    const group = new THREE.Group();
    const pole = cylinder(0.045, 0.05, 4.2, 6, COLORS.metal);
    pole.position.y = 2.1;
    group.add(pole);
    const flagTexture = makeCanvasTexture(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#0a1622';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#4de2ff';
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#e8eef7';
      ctx.font = '700 54px "Rajdhani", sans-serif';
      ctx.fillText('ARTEMIS', 34, 140);
      ctx.fillText('RIDGE', 34, 200);
      ctx.fillStyle = '#6ee7a8';
      ctx.font = '500 28px "Rajdhani", sans-serif';
      ctx.fillText('OUTPOST LUNAR', 34, 250);
    });
    const flagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.4),
      new THREE.MeshBasicMaterial({ map: flagTexture, side: THREE.DoubleSide, toneMapped: false })
    );
    flagMesh.position.set(1.15, 3.45, 0);
    group.add(flagMesh);
    group.position.set(-6.5, -0.08, 21.5);
    this.group.add(group);
    this.addCollider(-6.5, 21.5, 0.4, 0.4);
    this.animated.push(() => {
      flagMesh.rotation.y = Math.sin(performance.now() * 0.0016) * 0.12;
    });
  }

  workLights() {
    const positions = [
      [13, 28, COLORS.amber],
      [-16, 34, COLORS.teal],
      [2, 44, COLORS.teal],
      [18, 52, COLORS.teal],
      [0, 21, COLORS.amber],
    ];
    for (const [x, z, color] of positions) {
      const pole = cylinder(0.04, 0.05, 2.2, 6, COLORS.metal);
      pole.position.set(x, 1.02, z);
      this.group.add(pole);
      const lamp = sphere(0.1, 6, color, {
        material: new THREE.MeshBasicMaterial({ color, toneMapped: false }),
        castShadow: false,
      });
      lamp.position.set(x, 2.15, z);
      this.group.add(lamp);
    }
  }

  dustParticles() {
    const rand = seededRandom(555);
    const count = 520;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = -52 + rand() * 104;
      positions[i * 3 + 1] = 0.15 + rand() * 5;
      positions[i * 3 + 2] = 17 + rand() * 50;
      speeds[i] = 0.25 + rand() * 0.9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const texture = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(230,230,235,0.85)');
      grad.addColorStop(1, 'rgba(230,230,235,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const mat = new THREE.PointsMaterial({
      map: texture,
      size: 0.34,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      color: 0xd9d7cf,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    this.group.add(points);
    this.dust = { points, speeds, mat, basePositions: positions.slice() };
  }

  update(dt, storm = 0) {
    for (const fn of this.animated) fn(dt);
    if (this.dust) {
      const attr = this.dust.points.geometry.attributes.position;
      const arr = attr.array;
      const speeds = this.dust.speeds;
      const count = speeds.length;
      const speedMul = dt * (0.6 + storm * 2.4);
      const timeBase = performance.now() * 0.0006;
      const yStep = dt * 0.08;
      for (let i = 0; i < count; i += 1) {
        const idx = i * 3;
        let x = arr[idx] + speeds[i] * speedMul;
        let y = arr[idx + 1] + Math.sin(timeBase + i) * yStep;
        if (x > 54) x = -54;
        if (y > 6) y = 0.1;
        arr[idx] = x;
        arr[idx + 1] = y;
      }
      attr.needsUpdate = true;
      this.dust.mat.opacity = 0.22 + storm * 0.5;
      this.dust.mat.size = 0.3 + storm * 0.5;
    }
  }

  build() {
    this.ground();
    this.craters();
    this.rocks();
    this.pathMarkers();
    this.rover();
    this.lander();
    this.cargo();
    this.flag();
    this.workLights();
    this.dustParticles();
    return this;
  }
}

export function buildExterior() {
  return new ExteriorBuilder().build();
}
