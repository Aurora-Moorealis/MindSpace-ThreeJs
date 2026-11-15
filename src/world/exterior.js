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
import { generateProceduralMap } from './map-gen.js';

function makeMoonTexture(seed = 7) {
  return makeCanvasTexture(512, 512, (ctx, w, h) => {
    const rand = seededRandom(seed);
    ctx.fillStyle = '#8b8b91';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6500; i += 1) {
      const value = 110 + Math.floor(rand() * 70);
      ctx.fillStyle = `rgba(${value},${value},${value + 4},${0.18 + rand() * 0.35})`;
      const size = 1 + rand() * 3;
      ctx.fillRect(rand() * w, rand() * h, size, size);
    }
    // Soft shaded regolith dimples (no harsh circle borders).
    for (let i = 0; i < 28; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 6 + rand() * 24;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(64,64,72,0.28)');
      grad.addColorStop(0.7, 'rgba(72,72,80,0.12)');
      grad.addColorStop(1, 'rgba(72,72,80,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

export class ExteriorBuilder {
  constructor(mapData = null) {
    this.mapData = mapData ?? generateProceduralMap();
    this.group = new THREE.Group();
    this.colliders = [];
    this.dust = null;
    this.craterDust = null;
    this.animated = [];
    this.moonTexture = makeMoonTexture(this.mapData.seed);
    this.moonTexture.wrapS = THREE.RepeatWrapping;
    this.moonTexture.wrapT = THREE.RepeatWrapping;
    this.moonTexture.repeat.set(10, 10);
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
    const geo = new THREE.PlaneGeometry(220, 220, 110, 110);
    const position = geo.attributes.position;
    const heightAt = this.mapData.heightAt;
    const colors = new Float32Array(position.count * 3);
    const craters = this.mapData.craters ?? [];

    for (let i = 0; i < position.count; i += 1) {
      const localX = position.getX(i);
      const localY = position.getY(i);
      const worldX = -8 + localX;
      const worldZ = 30 - localY;
      const bump = heightAt ? heightAt(worldX, worldZ) : 0;
      position.setZ(i, bump);

      // Subtle ambient-occlusion vertex shading inside crater bowls and sunlit rims.
      let shade = 1.0;
      for (const c of craters) {
        const r = c.size * 0.5;
        const d = Math.hypot(worldX - c.x, worldZ - c.z);
        if (d < r * 1.15) {
          const t = d / r;
          if (t < 0.78) {
            shade = Math.min(shade, 0.72 + 0.2 * (t / 0.78));
          } else {
            const rimGlow = Math.sin(((t - 0.78) / 0.37) * Math.PI);
            shade = Math.max(shade, 1.0 + rimGlow * 0.08);
          }
        }
      }
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = Math.min(1.08, shade * 1.01);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: this.moonTexture,
      color: this.mapData.biome?.groundColor ?? 0xc8c6c1,
      roughness: 1,
      metalness: 0,
      flatShading: true,
      vertexColors: true,
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
    // Ground heightmap + vertex colors already sculpt each crater bowl and rim.
    // Add subtle faceted 3D ejecta stones around larger crater rims so they read
    // cleanly under directional sunlight without flat white decal borders.
    const rand = seededRandom(this.mapData.seed ^ 0x9e3779b9);
    const rimRockMat = material(this.mapData.biome?.rockColor ?? 0x7f7f86, {
      roughness: 0.96,
      flatShading: true,
    });
    const heightAt = this.mapData.heightAt;
    for (const c of this.mapData.craters) {
      if (c.size < 5.0) continue;
      const radius = c.size * 0.48;
      const ejectaCount = c.size > 8 ? 4 : 2;
      for (let i = 0; i < ejectaCount; i += 1) {
        const angle = c.rotationZ + (i / ejectaCount) * Math.PI * 2 + (rand() - 0.5) * 0.7;
        const dist = radius * (0.9 + rand() * 0.24);
        const rx = c.x + Math.cos(angle) * dist;
        const rz = c.z + Math.sin(angle) * dist;
        const ry = heightAt ? heightAt(rx, rz) : 0;
        const stoneSize = 0.18 + rand() * 0.28;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(stoneSize, 0), rimRockMat);
        stone.position.set(rx, -0.1 + ry + stoneSize * 0.25, rz);
        stone.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
        stone.scale.y = 0.52;
        stone.castShadow = true;
        stone.receiveShadow = true;
        this.group.add(stone);
        if (stoneSize >= 0.3) this.addCollider(rx, rz, stoneSize * 1.4, stoneSize * 1.4);
      }
    }

    // Floating lunar regolith / volatile micro-particles rising gently inside each crater bowl.
    const perCrater = 14;
    const craterList = this.mapData.craters ?? [];
    const total = craterList.length * perCrater;
    if (total > 0) {
      const positions = new Float32Array(total * 3);
      const baseHeights = new Float32Array(total);
      const phases = new Float32Array(total);
      const riseSpeeds = new Float32Array(total);
      let idx = 0;
      for (const c of craterList) {
        const maxR = c.size * 0.42;
        for (let k = 0; k < perCrater; k += 1) {
          const angle = rand() * Math.PI * 2;
          const dist = Math.sqrt(rand()) * maxR;
          const px = c.x + Math.cos(angle) * dist;
          const pz = c.z + Math.sin(angle) * dist;
          const baseY = -0.06 + (heightAt ? heightAt(px, pz) : 0);
          positions[idx * 3] = px;
          positions[idx * 3 + 1] = baseY + rand() * 1.2;
          positions[idx * 3 + 2] = pz;
          baseHeights[idx] = baseY;
          phases[idx] = rand() * Math.PI * 2;
          riseSpeeds[idx] = 0.16 + rand() * 0.24;
          idx += 1;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleColor = this.mapData.biome?.id === 'polar_shadow' ? 0xbbe8ff : 0xdde2eb;
      const mat = new THREE.PointsMaterial({
        map: this._makeParticleTexture(),
        size: 0.24,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        color: particleColor,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      this.group.add(points);
      this.craterDust = { points, baseHeights, phases, riseSpeeds, mat };
    }
  }

  rocks() {
    const rockMat = material(this.mapData.biome?.rockColor ?? 0x7f7f86, { roughness: 0.95, flatShading: true });
    const rockMatLight = material(this.mapData.biome?.rockLightColor ?? 0x96969c, { roughness: 0.95, flatShading: true });
    for (const r of this.mapData.rocks) {
      const yBase = this.mapData.heightAt ? this.mapData.heightAt(r.x, r.z) : 0;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r.size, 0),
        r.light ? rockMatLight : rockMat
      );
      rock.position.set(r.x, -0.1 + yBase + r.size * 0.35, r.z);
      rock.rotation.set(r.rx, r.ry, r.rz);
      rock.scale.y = r.scaleY;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      const colSize = Math.max(0.55, r.size * 1.45);
      this.addCollider(r.x, r.z, colSize, colSize);
    }

    // A rocky ridge at the far edge.
    for (const r of this.mapData.ridge) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r.size, 0), rockMat);
      rock.position.set(r.x, -0.2 + r.size * 0.25, r.z);
      rock.rotation.set(r.rx, r.ry, r.rz);
      rock.scale.y = 0.6;
      rock.castShadow = true;
      this.group.add(rock);
    }
  }

  pathMarkers() {
    const teal = new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false });
    for (const m of this.mapData.pathMarkers) {
      const yBase = this.mapData.heightAt ? this.mapData.heightAt(m.x, m.z) : 0;
      const post = box(0.06, 0.55, 0.06, COLORS.metal);
      post.position.set(m.x, 0.24 + yBase, m.z);
      this.group.add(post);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), teal);
      tip.position.set(m.x, 0.55 + yBase, m.z);
      this.group.add(tip);
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
    const landerCfg = this.mapData.lander ?? { x: -38, z: 47, rotationY: 0.7 };
    const landerY = (this.mapData.heightAt ? this.mapData.heightAt(landerCfg.x, landerCfg.z) : 0) - 0.1;
    group.position.set(landerCfg.x, landerY, landerCfg.z);
    group.rotation.y = landerCfg.rotationY ?? 0.7;
    this.group.add(group);
    this.addCollider(landerCfg.x, landerCfg.z, 5.0, 5.0);
    this.animated.push(() => {
      beacon.visible = Math.sin(performance.now() * 0.003) > 0.5;
    });
  }

  cargo() {
    for (const c of this.mapData.crates) {
      const yBase = this.mapData.heightAt ? this.mapData.heightAt(c.x, c.z) : 0;
      const crate = rounded(c.size, c.size * 0.85, c.size, 0.06, c.color);
      crate.position.set(c.x, yBase + c.size * 0.42 - 0.08, c.z);
      crate.rotation.y = c.rotationY;
      this.group.add(crate);
      const band = box(c.size * 1.03, 0.1, c.size * 1.03, COLORS.amber);
      band.position.set(c.x, yBase + c.size * 0.58 - 0.08, c.z);
      band.rotation.y = crate.rotation.y;
      this.group.add(band);
      this.addCollider(c.x, c.z, c.size * 1.3, c.size * 1.3);
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
      ctx.fillText('MINDSPACE', 34, 250);
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
    for (const light of this.mapData.workLights) {
      const color = light.color === 'amber' ? COLORS.amber : COLORS.teal;
      const yBase = this.mapData.heightAt ? this.mapData.heightAt(light.x, light.z) : 0;
      const pole = cylinder(0.04, 0.05, 2.2, 6, COLORS.metal);
      pole.position.set(light.x, 1.02 + yBase, light.z);
      this.group.add(pole);
      const lamp = sphere(0.1, 6, color, {
        material: new THREE.MeshBasicMaterial({ color, toneMapped: false }),
        castShadow: false,
      });
      lamp.position.set(light.x, 2.15 + yBase, light.z);
      this.group.add(lamp);
    }
  }

  _makeParticleTexture() {
    if (this._particleTexture) return this._particleTexture;
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
    this._particleTexture = t;
    return t;
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
    const mat = new THREE.PointsMaterial({
      map: this._makeParticleTexture(),
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
    const timeBase = performance.now() * 0.0006;
    if (this.craterDust) {
      const attr = this.craterDust.points.geometry.attributes.position;
      const arr = attr.array;
      const { baseHeights, phases, riseSpeeds, mat } = this.craterDust;
      const count = baseHeights.length;
      const mul = dt * (1 + storm * 1.4);
      for (let i = 0; i < count; i += 1) {
        const idx = i * 3;
        arr[idx] += Math.sin(timeBase * 1.3 + phases[i]) * dt * 0.12;
        arr[idx + 1] += riseSpeeds[i] * mul;
        arr[idx + 2] += Math.cos(timeBase * 1.1 + phases[i]) * dt * 0.12;
        if (arr[idx + 1] > baseHeights[i] + 1.35) {
          arr[idx + 1] = baseHeights[i] + 0.05;
        }
      }
      attr.needsUpdate = true;
      mat.opacity = 0.34 + storm * 0.35;
    }
    if (this.dust) {
      const attr = this.dust.points.geometry.attributes.position;
      const arr = attr.array;
      const speeds = this.dust.speeds;
      const count = speeds.length;
      const speedMul = dt * (0.6 + storm * 2.4);
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

export function buildExterior(mapData = null) {
  return new ExteriorBuilder(mapData).build();
}
