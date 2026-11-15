/**
 * Outpost architecture.
 *
 * A single rectangular outpost split into a long corridor, five rooms, a central
 * hub and an airlock. The layout is hand-authored so it stays readable from the
 * tilted orthographic camera. Everything returns colliders; doors are visual
 * slides with no collider so the player can never get trapped.
 */

import * as THREE from 'three';
import {
  COLORS,
  box,
  cylinder,
  glowBar,
  material,
  makeCanvasTexture,
  makeFloorDecal,
  makeHazardTexture,
  makePanelTexture,
  makeTextSprite,
  rounded,
  sphere,
} from './primitives.js';

export const ROOMS = {
  dormitory: { key: 'room.dormitory', rect: [-30, -16, -13, -2.5], center: [-21.5, -9.25] },
  greenhouse: { key: 'room.greenhouse', rect: [-13, -16, 3, -2.5], center: [-5, -9.25] },
  energy: { key: 'room.energy', rect: [3, -16, 27, -2.5], center: [15, -9.25] },
  comms: { key: 'room.comms', rect: [-30, 2.5, -7, 16], center: [-18.5, 9.25] },
  workshop: { key: 'room.workshop', rect: [7, 2.5, 27, 16], center: [17, 9.25] },
  hub: { key: 'room.hub', rect: [-7, 2.5, 7, 6], center: [0, 4.25] },
  airlock: { key: 'room.airlock', rect: [-7, 6, 7, 16], center: [0, 11] },
  corridor: { key: 'room.corridor', rect: [-30, -2.5, 27, 2.5], center: [-1.5, 0] },
  exterior: { key: 'room.exterior', rect: [-60, 16, 60, 80], center: [0, 40] },
};

export function getRoomAt(x, z) {
  if (z > 16.4) return 'exterior';
  if (z >= 6 && z <= 16.4 && Math.abs(x) < 7) return 'airlock';
  if (z >= 2.5 && z < 6 && Math.abs(x) < 7) return 'hub';
  if (z >= -2.5 && z < 2.5) return 'corridor';
  if (z < -2.5) {
    if (x < -13) return 'dormitory';
    if (x < 3) return 'greenhouse';
    return 'energy';
  }
  if (z >= 2.5) {
    if (x < -7) return 'comms';
    if (x > 7) return 'workshop';
    return 'airlock';
  }
  return 'hub';
}

export class BaseBuilder {
  constructor() {
    this.group = new THREE.Group();
    this.colliders = [];
    this.doors = [];
    this.lights = [];
    this.animated = [];
    this.interactables = [];
    this.floorTexture = makePanelTexture({ base: '#2f3742', line: '#3d4755', cells: 4 });
    this.floorTexture.wrapS = THREE.RepeatWrapping;
    this.floorTexture.wrapT = THREE.RepeatWrapping;
    this.floorTexture.repeat.set(14, 8);
    this.hazardTexture = makeHazardTexture();
    this.hazardTexture.wrapS = THREE.RepeatWrapping;
    this.hazardTexture.wrapT = THREE.RepeatWrapping;
    this.hazardTexture.repeat.set(6, 1);
    this.wallMaterial = material(0xb6bec7, { roughness: 0.88, metalness: 0.03 });
    this.trimMaterial = material(0x343e4c, { roughness: 0.6, metalness: 0.25 });
    this.darkMaterial = material(COLORS.darkMetal, { roughness: 0.55, metalness: 0.35 });
    this.glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fdcff,
      roughness: 0.12,
      metalness: 0.55,
      transparent: true,
      opacity: 0.32,
    });
  }

  addCollider(cx, cz, w, d) {
    this.colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
  }

  wall(cx, cz, w, d, height = 2.0, thickness = 0.3, collider = true) {
    const mesh = box(w, height, d, COLORS.wall, { material: this.wallMaterial });
    mesh.position.set(cx, height / 2, cz);
    this.group.add(mesh);
    const baseTrim = box(w + 0.02, 0.12, d + 0.04, 0x343e4c, { material: this.trimMaterial });
    baseTrim.position.set(cx, 0.08, cz);
    this.group.add(baseTrim);
    if (collider) this.addCollider(cx, cz, w, d);
    return mesh;
  }

  floor() {
    const slab = box(57.4, 0.34, 32.4, COLORS.floorDark);
    slab.position.set(-1.5, -0.17, 0);
    slab.receiveShadow = true;
    slab.castShadow = false;
    this.group.add(slab);

    const floorMat = new THREE.MeshStandardMaterial({
      map: this.floorTexture,
      roughness: 0.9,
      metalness: 0.05,
      color: 0xcdd3dc,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(57, 32), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-1.5, 0.02, 0);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Coloured room accents keep the five rooms readable from above.
    const accents = [
      [-21.5, -9.25, 17, 13.5, 0xffd8b0, 0.06],
      [-5, -9.25, 16, 13.5, 0x8ef0b0, 0.04],
      [15, -9.25, 24, 13.5, 0xffcf88, 0.04],
      [-18.5, 9.25, 23, 13.5, 0x8fb4ff, 0.04],
      [17, 9.25, 20, 13.5, 0xffc08a, 0.04],
      [-1.5, 0, 57, 5, 0x7f9bc4, 0.02],
      [0, 4.25, 14, 3.5, 0x4de2ff, 0.04],
      [0, 11, 14, 10, 0xffb347, 0.02],
    ];
    for (const [x, z, w, d, color, opacity] of accents) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(x, 0.045, z);
      plane.renderOrder = 1;
      this.group.add(plane);
    }

    for (const z of [6, 16]) {
      const hazard = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 1.1),
        new THREE.MeshBasicMaterial({ map: this.hazardTexture, transparent: true, opacity: 0.8 })
      );
      hazard.rotation.x = -Math.PI / 2;
      hazard.position.set(0, 0.06, z);
      this.group.add(hazard);
    }
  }

  outerWalls() {
    // North / south / west / east. The south wall has the airlock gap.
    this.wall(-1.5, -16, 57, 0.4, 2.35);
    this.wall(-16, 16, 28, 0.4, 2.35);
    this.wall(14.5, 16, 25, 0.4, 2.35);
    this.wall(-30, 0, 0.4, 32, 2.35);
    this.wall(27, 0, 0.4, 32, 2.35);
  }

  innerWalls() {
    // Corridor north wall: gaps at the three north rooms.
    this.wall(-28, -2.5, 4, 0.3);
    this.wall(-14.5, -2.5, 15, 0.3);
    this.wall(6, -2.5, 18, 0.3);
    this.wall(23, -2.5, 8, 0.3);

    // Corridor south wall: gaps at comms, hub and workshop.
    this.wall(-28, 2.5, 4, 0.3);
    this.wall(-14.5, 2.5, 15, 0.3);
    this.wall(11, 2.5, 8, 0.3);
    this.wall(23, 2.5, 8, 0.3);

    // North room dividers.
    this.wall(-13, -9.25, 0.3, 13.5);
    this.wall(3, -9.25, 0.3, 13.5);

    // South room dividers / airlock side walls.
    this.wall(-7, 9.25, 0.3, 13.5);
    this.wall(7, 9.25, 0.3, 13.5);

    // Hub -> airlock wall, with the inner door gap.
    this.wall(-4.5, 6, 5, 0.3);
    this.wall(4.5, 6, 5, 0.3);
  }

  doorFrame(centerX, centerZ, width, { label = null, height = 2.15, horizontal = true } = {}) {
    const group = new THREE.Group();
    const postSize = 0.18;
    for (const side of [-1, 1]) {
      const post = box(postSize, height, 0.38, COLORS.wallTrim, { material: this.trimMaterial });
      post.position.set(centerX + side * (width / 2 + postSize / 2), height / 2, centerZ);
      group.add(post);
    }
    const beam = box(width + postSize * 2, 0.16, 0.38, COLORS.wallTrim, { material: this.trimMaterial });
    beam.position.set(centerX, height + 0.02, centerZ);
    group.add(beam);
    if (label) {
      const sprite = makeTextSprite(label, {
        worldWidth: Math.min(3.8, width + 1.2),
        background: 'rgba(6, 12, 20, 0.9)',
        border: 'rgba(77,226,255,0.65)',
        accent: '#4de2ff',
        fontSize: 46,
      });
      sprite.position.set(centerX, height + 0.45, centerZ + (horizontal ? 0.05 : 0));
      group.add(sprite);
    }
    this.group.add(group);
    return group;
  }

  signAt(text, x, z, rotation = 0, color = '#4de2ff') {
    const sprite = makeTextSprite(text, {
      worldWidth: 3.2,
      background: 'rgba(5, 10, 18, 0.86)',
      border: color,
      accent: color,
      fontSize: 36,
    });
    sprite.position.set(x, 2.45, z);
    sprite.material.depthTest = false;
    this.group.add(sprite);
    return sprite;
  }

  roomDecal(text, x, z, width = 6, color = '#dfe8f4') {
    const decal = makeFloorDecal(text, width, color, { accent: true, fontSize: 62 });
    decal.position.set(x, 0.07, z);
    this.group.add(decal);
    return decal;
  }

  wallLight(x, z, rotation = 0, color = COLORS.warm) {
    // Compact sconce: the old 1.8 m emissive bar read as a stray line in the corridor.
    const bracket = box(0.42, 0.26, 0.12, COLORS.darkMetal);
    bracket.position.set(x, 1.43, z);
    bracket.rotation.y = rotation;
    this.group.add(bracket);
    const lamp = glowBar(0.26, 0.05, 0.04, color, 1.8);
    const normalX = Math.sin(rotation);
    const normalZ = Math.cos(rotation);
    lamp.position.set(x + normalX * 0.08, 1.38, z + normalZ * 0.08);
    lamp.rotation.y = rotation;
    this.group.add(lamp);
  }

  pointLight(x, z, { intensity = 18, distance = 14, color = COLORS.warm, y = 2.55 } = {}) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    light.castShadow = false;
    this.group.add(light);
    this.lights.push(light);
    return light;
  }

  addDoor({ x, z, width = 4.2, height = 2.05, label = 'AIRLOCK', pocket = 1.05, panelColor = COLORS.metal }) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const panels = [];
    for (const side of [-1, 1]) {
      const panel = new THREE.Group();
      const body = box(width / 2, height, 0.14, panelColor, { material: material(panelColor, { metalness: 0.45, roughness: 0.4 }) });
      body.position.set(side * (width / 4), height / 2, 0);
      panel.add(body);
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(width / 2 - 0.2, 0.35),
        new THREE.MeshBasicMaterial({ map: this.hazardTexture, toneMapped: false })
      );
      stripe.position.set(side * (width / 4), height * 0.35, 0.08);
      panel.add(stripe);
      const window = box(width / 5, height * 0.3, 0.05, 0x14283a, { material: this.glassMaterial });
      window.position.set(side * (width / 4), height * 0.7, 0.08);
      panel.add(window);
      group.add(panel);
      panels.push({ group: panel, side, closedX: 0, openX: side * (width / 2 + 0.15) });
    }
    const light = sphere(0.09, 8, COLORS.red, {
      material: new THREE.MeshBasicMaterial({ color: COLORS.red, toneMapped: false }),
      castShadow: false,
    });
    light.position.set(0, height + 0.25, 0.2);
    group.add(light);
    const sprite = makeTextSprite(label, {
      worldWidth: 3.0,
      background: 'rgba(6, 12, 20, 0.9)',
      border: 'rgba(255,179,71,0.8)',
      accent: '#ffb347',
      fontSize: 44,
    });
    sprite.position.set(0, height + 0.7, 0);
    group.add(sprite);
    this.group.add(group);
    const door = {
      group,
      x,
      z,
      panels,
      light,
      open: false,
      update(playerX, playerZ, dt) {
        const dist = Math.hypot(playerX - x, playerZ - z);
        const target = dist < 5.2;
        if (target !== this.open) this.open = target;
        for (const panel of panels) {
          const targetX = this.open ? panel.openX : panel.closedX;
          panel.group.position.x += (targetX - panel.group.position.x) * Math.min(1, dt * 8);
        }
        light.material.color.setHex(this.open ? COLORS.green : COLORS.red);
      },
    };
    this.doors.push(door);
    return door;
  }

  addCrate(x, z, size = 1.1, color = 0x777f8c, rotation = 0) {
    const group = new THREE.Group();
    const crate = rounded(size, size * 0.8, size, 0.04, color);
    crate.position.y = size * 0.4 + 0.05;
    group.add(crate);
    const band = box(size * 1.02, 0.08, size * 1.02, COLORS.darkMetal);
    band.position.y = size * 0.52;
    group.add(band);
    const handle = box(0.24, 0.05, 0.05, COLORS.amber);
    handle.position.set(0, size * 0.4, size / 2 + 0.02);
    group.add(handle);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, size * 1.1, size * 1.1);
    return group;
  }

  addLocker(x, z, rotation = 0, color = 0x5d6878) {
    const group = new THREE.Group();
    const body = rounded(1.0, 1.9, 0.65, 0.04, color);
    body.position.y = 0.95;
    group.add(body);
    const seam = box(0.04, 1.7, 0.02, COLORS.darkMetal);
    seam.position.set(0, 0.95, 0.335);
    group.add(seam);
    for (const side of [-1, 1]) {
      const handle = box(0.05, 0.18, 0.04, COLORS.amber);
      handle.position.set(side * 0.18, 1.05, 0.37);
      group.add(handle);
    }
    const label = glowBar(0.5, 0.04, 0.02, COLORS.teal, 1.2);
    label.position.set(0, 1.72, 0.34);
    group.add(label);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, 1.1, 0.8);
    return group;
  }

  addSuitLocker(x, z, rotation = 0) {
    const group = this.addLocker(x, z, rotation, 0x4c5868);
    const suitMat = material(0xe0e5ea);
    const torso = rounded(0.4, 0.55, 0.22, 0.1, 0xe0e5ea, { material: suitMat });
    torso.position.set(0, 1.0, 0.34);
    group.add(torso);
    const helmet = sphere(0.19, 10, 0xe0e5ea, { material: suitMat });
    helmet.position.set(0, 1.42, 0.34);
    group.add(helmet);
    return group;
  }

  addBed(x, z, rotation = 0) {
    const group = new THREE.Group();
    const frame = box(1.4, 0.25, 2.6, COLORS.metal);
    frame.position.y = 0.3;
    group.add(frame);
    const mattress = rounded(1.25, 0.22, 2.35, 0.1, 0xd8d2c3);
    mattress.position.y = 0.52;
    group.add(mattress);
    const pillow = rounded(0.8, 0.16, 0.45, 0.08, 0xf0eee8);
    pillow.position.set(0, 0.68, -0.88);
    group.add(pillow);
    const blanket = rounded(1.22, 0.08, 1.55, 0.06, 0x5577aa);
    blanket.position.set(0, 0.64, 0.35);
    group.add(blanket);
    const legGeo = box(0.09, 0.25, 0.09, COLORS.darkMetal);
    for (const gx of [-0.6, 0.6]) {
      for (const gz of [-1.1, 1.1]) {
        const leg = legGeo.clone();
        leg.position.set(gx, 0.13, gz);
        group.add(leg);
      }
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, 1.6, 2.8);
    return group;
  }

  addTable(x, z, w = 2.2, d = 1.1, rotation = 0, color = COLORS.metal) {
    const group = new THREE.Group();
    const top = box(w, 0.12, d, color);
    top.position.y = 0.95;
    group.add(top);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = box(0.08, 0.92, 0.08, COLORS.darkMetal);
        leg.position.set(sx * (w / 2 - 0.12), 0.46, sz * (d / 2 - 0.12));
        group.add(leg);
      }
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, w + 0.1, d + 0.1);
    return group;
  }

  addShelf(x, z, w = 2.0, rotation = 0) {
    const group = new THREE.Group();
    for (const sx of [-1, 1]) {
      const side = box(0.08, 2.0, 0.5, COLORS.metal);
      side.position.set(sx * (w / 2 - 0.05), 1.0, 0);
      group.add(side);
    }
    for (let i = 0; i < 4; i += 1) {
      const shelf = box(w, 0.06, 0.5, COLORS.metal);
      shelf.position.y = 0.35 + i * 0.48;
      group.add(shelf);
      for (let j = 0; j < 3; j += 1) {
        if ((i + j) % 3 === 0) continue;
        const item = box(0.28, 0.3, 0.32, [0x6d7684, 0x8c6a4a, 0x4a6d5d][(i + j) % 3]);
        item.position.set(-w / 2 + 0.3 + j * 0.5, 0.35 + i * 0.48 + 0.18, 0);
        group.add(item);
      }
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, w + 0.1, 0.7);
    return group;
  }

  addPlanter(x, z, w = 1.5, d = 0.8, rotation = 0) {
    const group = new THREE.Group();
    const pot = rounded(w, 0.5, d, 0.04, 0x3a4652);
    pot.position.y = 0.3;
    group.add(pot);
    const soil = box(w * 0.88, 0.06, d * 0.82, 0x3b2c22);
    soil.position.y = 0.55;
    group.add(soil);
    for (let i = 0; i < 4; i += 1) {
      const plant = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.38, 5),
        material(i % 2 ? COLORS.green : 0x4f9e6c, { roughness: 0.9 })
      );
      plant.position.set(-w * 0.32 + i * (w * 0.21), 0.8, (i % 2 - 0.5) * d * 0.3);
      plant.castShadow = true;
      group.add(plant);
    }
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, w, d);
    return group;
  }

  addPoster(x, z, rotation, title, subtitle = '') {
    const texture = makeCanvasTexture(512, 320, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0a1824');
      grad.addColorStop(1, '#132c42');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#4de2ff';
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      ctx.fillStyle = '#e8eef7';
      ctx.font = '700 44px "Rajdhani", sans-serif';
      ctx.fillText(title, 34, 120);
      ctx.fillStyle = '#8fb6d4';
      ctx.font = '500 28px "Rajdhani", sans-serif';
      ctx.fillText(subtitle, 34, 170);
      ctx.strokeStyle = 'rgba(77,226,255,0.5)';
      ctx.beginPath();
      ctx.arc(410, 225, 52, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#6ee7a8';
      ctx.beginPath();
      ctx.arc(410, 225, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), mat);
    mesh.position.set(x, 1.55, z);
    mesh.rotation.y = rotation;
    this.group.add(mesh);
    return mesh;
  }

  addWallScreen(x, z, rotation, width, height, title, subtitle = '', accent = '#4de2ff') {
    const texture = makeCanvasTexture(1024, 640, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#07131f');
      grad.addColorStop(1, '#0a2333');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(77,226,255,0.18)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.fillStyle = accent;
      ctx.font = '700 44px "Rajdhani", sans-serif';
      ctx.fillText(title, 44, 86);
      ctx.fillStyle = '#8fa8c2';
      ctx.font = '500 28px "Rajdhani", sans-serif';
      ctx.fillText(subtitle, 44, 128);
      // A stylised orbital map with three survey markers.
      ctx.strokeStyle = 'rgba(77,226,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(w * 0.66, h * 0.58, 230, 95, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(w * 0.66, h * 0.58, 150, 60, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(77,226,255,0.5)';
      ctx.beginPath();
      ctx.arc(w * 0.66, h * 0.58, 6, 0, Math.PI * 2);
      ctx.fill();
      const markers = [
        [w * 0.52, h * 0.42, '#4de2ff', 'A'],
        [w * 0.72, h * 0.36, '#ffb347', 'B'],
        [w * 0.83, h * 0.7, '#6ee7a8', 'C'],
      ];
      for (const [mx, my, color, label] of markers) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(mx, my, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '700 22px "Rajdhani", sans-serif';
        ctx.fillText(label, mx + 18, my + 8);
      }
      ctx.fillStyle = '#6ee7a8';
      ctx.font = '600 22px "Rajdhani", sans-serif';
      ctx.fillText('DSN LINK OK · FORECAST ARCHIVE · OUTPOST LUNAR', 44, h - 44);
    });
    const normal = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
    const backing = box(width + 0.14, height + 0.14, 0.07, COLORS.darkMetal);
    backing.position.set(x, 1.4, z);
    backing.rotation.y = rotation;
    this.group.add(backing);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    );
    mesh.position.set(x + normal.x * 0.045, 1.4, z + normal.z * 0.045);
    mesh.rotation.y = rotation;
    mesh.renderOrder = 2;
    this.group.add(mesh);
    return mesh;
  }

  addChair(x, z, rotation = 0) {
    const group = new THREE.Group();
    const seat = box(0.58, 0.08, 0.54, 0x4c5868);
    seat.position.y = 0.48;
    group.add(seat);
    const back = box(0.58, 0.62, 0.08, 0x4c5868);
    back.position.set(0, 0.78, -0.26);
    group.add(back);
    for (const sx of [-0.24, 0.24]) {
      for (const sz of [-0.21, 0.21]) {
        const leg = box(0.05, 0.46, 0.05, COLORS.darkMetal);
        leg.position.set(sx, 0.23, sz);
        group.add(leg);
      }
    }
    const cushion = box(0.5, 0.05, 0.46, COLORS.teal, { material: material(COLORS.teal, { roughness: 0.8 }) });
    cushion.position.y = 0.53;
    group.add(cushion);
    group.position.set(x, 0, z);
    group.rotation.y = rotation;
    this.group.add(group);
    this.addCollider(x, z, 0.72, 0.72);
    return group;
  }

  addDeskClutter(x, z) {
    const mug = cylinder(0.055, 0.05, 0.14, 8, 0xe8eef7);
    mug.position.set(x, 1.08, z);
    this.group.add(mug);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 5, 10), material(COLORS.white));
    handle.position.set(x + 0.06, 1.08, z);
    handle.rotation.y = Math.PI / 2;
    this.group.add(handle);
    const pad = box(0.35, 0.025, 0.25, 0x1b2430);
    pad.position.set(x + 0.45, 1.02, z + 0.15);
    this.group.add(pad);
    const lampBase = cylinder(0.08, 0.1, 0.05, 8, COLORS.darkMetal);
    lampBase.position.set(x - 0.5, 1.02, z - 0.1);
    this.group.add(lampBase);
    const lampArm = cylinder(0.02, 0.02, 0.5, 5, COLORS.metal);
    lampArm.position.set(x - 0.5, 1.28, z - 0.1);
    this.group.add(lampArm);
    const lamp = sphere(0.07, 6, COLORS.warm, {
      material: new THREE.MeshBasicMaterial({ color: COLORS.warm, toneMapped: false }),
      castShadow: false,
    });
    lamp.position.set(x - 0.42, 1.52, z - 0.1);
    this.group.add(lamp);
  }

  addPipeRun(x1, z1, x2, z2, y = 1.72, color = COLORS.metal, radius = 0.055) {
    const group = new THREE.Group();
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const pipe = cylinder(radius, radius, length, 8, color);
    pipe.rotation.z = Math.PI / 2;
    pipe.rotation.y = Math.atan2(dz, dx);
    pipe.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    group.add(pipe);
    for (let t = 0; t <= 1; t += 0.2) {
      const bracket = box(0.06, 0.16, 0.06, COLORS.darkMetal);
      bracket.position.set(x1 + dx * t, y - 0.12, z1 + dz * t);
      group.add(bracket);
    }
    this.group.add(group);
    return group;
  }

  build() {
    this.floor();
    this.outerWalls();
    this.innerWalls();

    // Door frames and labels.
    this.doorFrame(-24, -2.5, 4, { label: 'DORMITORY' });
    this.doorFrame(-5, -2.5, 4, { label: 'GREENHOUSE' });
    this.doorFrame(17, -2.5, 4, { label: 'POWER' });
    this.doorFrame(-24, 2.5, 4, { label: 'COMMS' });
    this.doorFrame(17, 2.5, 4, { label: 'WORKSHOP' });
    // The sliding doors below carry their own signs; a frame label here would overlap them.
    this.doorFrame(0, 6, 4);
    this.doorFrame(0, 16, 4);
    // Airlock sliding doors.
    this.addDoor({ x: 0, z: 6, width: 4.2, label: 'AIRLOCK', panelColor: 0x6f7885 });
    this.addDoor({ x: 0, z: 16, width: 4.2, label: 'EVA HATCH', panelColor: 0x5b6470 });

    // Room floor labels.
    this.roomDecal('DORMITORY', -21.5, -4.2, 8.5, '#ffd8ad');
    this.roomDecal('GREENHOUSE', -5, -4.2, 8.5, '#b9ffd2');
    this.roomDecal('POWER', 15, -4.2, 8.0, '#ffe2a8');
    this.roomDecal('COMMUNICATIONS', -18.5, 4.3, 9.5, '#c6ddff');
    this.roomDecal('WORKSHOP', 17, 4.3, 8.5, '#ffd2a8');
    this.roomDecal('CENTRAL HUB', 0, 4.25, 7.5, '#bff4ff');
    this.roomDecal('AIRLOCK', 0, 7.0, 5.5, '#ffd2a8');

    // Corridor and room lighting.
    this.wallLight(-26, -2.32);
    this.wallLight(-14, -2.32);
    this.wallLight(4, -2.32);
    this.wallLight(20, -2.32);
    this.wallLight(-14, 2.32, Math.PI);
    this.wallLight(10, 2.32, Math.PI);
    this.wallLight(-24, -15.8, Math.PI);
    this.wallLight(-5, -15.8, Math.PI);
    this.wallLight(15, -15.8, Math.PI);
    this.wallLight(-24, 15.8, 0);
    this.wallLight(17, 15.8, 0);
    this.wallLight(0, 6.18, Math.PI, COLORS.amber);
    this.wallLight(0, 15.82, 0, COLORS.amber);

    this.pointLight(-21.5, -9.25, { color: 0xffd2a0, intensity: 42 });
    this.pointLight(-5, -9.25, { color: 0xd0ffd6, intensity: 38 });
    this.pointLight(15, -9.25, { color: 0xffcf8a, intensity: 38 });
    this.pointLight(-18.5, 9.25, { color: 0xb9d4ff, intensity: 40 });
    this.pointLight(-25.0, 10.0, { color: 0x9fd4ff, intensity: 24, distance: 10 });
    this.pointLight(17, 9.25, { color: 0xffc38a, intensity: 42 });
    this.pointLight(0, 4.25, { color: 0xa8e8ff, intensity: 30, distance: 11 });
    this.pointLight(0, 11, { color: 0xffc27a, intensity: 34, distance: 12 });
    this.pointLight(-22, 0, { color: 0xffe0b0, intensity: 26, distance: 13 });
    this.pointLight(12, 0, { color: 0xffe0b0, intensity: 26, distance: 13 });

    // Dormitory props.
    this.addBed(-18, -13.2, 0);
    this.addLocker(-29.0, -14.6, Math.PI / 2);
    this.addLocker(-29.0, -13.2, Math.PI / 2);
    this.addCrate(-28.2, -5.1, 1.2, 0x707887);
    this.addCrate(-27.0, -6.4, 0.9, 0x5d6674, 0.3);
    this.addCrate(-21.0, -15.0, 0.8, 0x7a6a58, -0.2);
    this.addShelf(-14.0, -7.5, 1.8, Math.PI / 2);
    this.addPoster(-29.7, -9.25, Math.PI / 2, 'ARTEMIS RIDGE', 'CREW QUARTERS');
    this.addPlanter(-16.0, -4.2, 1.2, 0.7, 0.1);

    // Greenhouse props.
    this.addPlanter(-11.5, -14.8, 2.4, 0.9, 0);
    this.addPlanter(1.2, -14.8, 2.4, 0.9, 0);
    this.addPipeRun(-12.5, -13.8, 2.4, -13.8, 0.6, COLORS.teal, 0.045);
    this.addTable(-11.2, -6.0, 1.6, 0.9, Math.PI / 2, 0x4d5b4b);
    this.addCrate(1.4, -6.2, 0.9, 0x4d6b58, 0.2);

    // Power room props.
    this.addShelf(4.2, -14.8, 2.0, 0);
    this.addPipeRun(9, -8.0, 22, -8.0, 0.35, COLORS.amber, 0.04);
    this.addPipeRun(9, -7.85, 9, -12, 0.35, COLORS.amber, 0.04);
    this.addCrate(25.0, -5.2, 0.9, 0x6d6a52, 0.4);
    this.addPoster(26.8, -9.25, -Math.PI / 2, 'HIGH VOLTAGE', 'AUTHORISED CREW ONLY');

    // Comms props: a proper operations room.
    this.addTable(-18.0, 6.0, 2.4, 1.1, 0, 0x3f4b5e);
    this.addDeskClutter(-18.6, 6.0);
    this.addChair(-20.2, 6.0, Math.PI / 2);
    this.addChair(-23.0, 7.8, 0);
    this.addChair(-21.0, 11.8, Math.PI);
    this.addShelf(-29.0, 13.8, 1.8, Math.PI / 2);
    this.addCrate(-8.4, 14.2, 0.9, 0x536070, 0.2);
    this.addPoster(-29.7, 9.0, Math.PI / 2, 'DEEP SPACE NETWORK', 'OUTPOST LUNAR');
    this.addPlanter(-27.8, 3.8, 1.2, 0.7, Math.PI / 2);
    this.addWallScreen(-29.7, 6.4, Math.PI / 2, 2.8, 1.7, 'DSN OPERATIONS', 'LUNAR SOUTH POLE · ARCHIVE LINK');
    this.addWallScreen(-29.7, 11.6, Math.PI / 2, 1.7, 1.05, 'SURFACE WATCH', 'STORMS · DUST · COMMS');
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 3.4),
      new THREE.MeshBasicMaterial({ color: 0x3a5f7f, transparent: true, opacity: 0.2, depthWrite: false })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-24, 0.065, 10);
    rug.renderOrder = 1;
    this.group.add(rug);

    // Workshop props.
    this.addShelf(26.35, 13.4, 2.2, Math.PI / 2);
    this.addShelf(8.4, 14.4, 2.2, 0);
    this.addCrate(25.0, 4.0, 1.1, 0x6b6252, 0.2);
    this.addCrate(8.8, 4.5, 0.8, 0x5a6270, -0.3);
    this.addPoster(7.25, 8.0, Math.PI / 2, 'REPAIR BAY', 'SUIT + MACHINE');
    this.addPipeRun(9.0, 14.6, 26.0, 14.6, 1.55, COLORS.metal);

    // Hub props.
    this.addPlanter(-6.0, 5.2, 1.3, 0.7, 0);
    this.addPlanter(6.0, 5.2, 1.3, 0.7, 0);
    this.addPoster(6.8, 4.2, -Math.PI / 2, 'MISSION', 'SCIENCE FIRST');

    // Airlock props.
    this.addSuitLocker(-5.6, 8.0, Math.PI / 2);
    this.addSuitLocker(-5.6, 10.2, Math.PI / 2);
    this.addSuitLocker(5.6, 8.0, -Math.PI / 2);
    this.addSuitLocker(5.6, 10.2, -Math.PI / 2);
    this.addTable(-4.2, 14.2, 1.8, 0.8, Math.PI / 2, 0x4b5666);
    this.addCrate(4.8, 14.4, 0.9, 0x626c7a, 0.2);
    this.addPoster(-6.8, 11.0, Math.PI / 2, 'EVA CHECKLIST', 'HELMET / O2 / TETHER');

    // Corridor details.
    this.addCrate(-9.0, 1.6, 0.7, 0x5e6674, 0.2);
    this.addPlanter(12.0, -1.7, 1.3, 0.7, 0);
    this.addPlanter(-17.0, 1.7, 1.3, 0.7, Math.PI);
    this.addPoster(-29.7, 0.0, Math.PI / 2, 'OUTPOST LUNAR', 'MISSION DAY 1 · ARTEMIS RIDGE');

    // Keep a few references for animation.
    this.animated.push(
      this.group,
    );

    return this;
  }
}

export function buildBase() {
  return new BaseBuilder().build();
}
