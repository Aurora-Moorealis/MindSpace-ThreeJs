/**
 * World orchestrator: builds the outpost and the lunar exterior, mounts all
 * data-driven machines and POIs, owns collision resolution, floating labels,
 * the objective beacon and the astronaut.
 */

import * as THREE from 'three';
import { buildBase, getRoomAt } from './base.js';
import { buildExterior } from './exterior.js';
import { Astronaut } from './astronaut.js';
import {
  buildMachine,
  buildMissionBoard,
  buildHoloTable,
  buildPoi,
  buildMineralVein,
  buildNasaTruck,
  buildIceMelter,
} from './machines3d.js';
import { MACHINES, MISSION_BOARD } from '../data/machines.js';
import { POIS } from '../data/pois.js';
import { MINERALS, MINERAL_VEINS, NASA_PROTOTYPE_TRUCK } from '../data/minerals.js';
import { STRINGS } from '../data/strings.js';
import { COLORS, makeCanvasTexture } from './primitives.js';

class WorldLabel {
  constructor(text, { worldWidth = 3.0, height = 190, fontSize = 38 } = {}) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(worldWidth, worldWidth * (height / 640), 1);
    this.sprite.center.set(0.5, 0);
    this.sprite.renderOrder = 25;
    this.worldWidth = worldWidth;
    this.fontSize = fontSize;
    this.lastTitle = '';
    this.lastSub = '';
    this.lastAccent = '';
    this.draw(text, '', '#4de2ff');
  }

  draw(title, subtitle, accent = '#4de2ff', detail = null) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5, 11, 20, 0.88)';
    ctx.beginPath();
    ctx.roundRect(6, 6, w - 12, h - 12, 18);
    ctx.fill();
    ctx.strokeStyle = `${accent}cc`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(6, 6, 12, h - 12);
    ctx.fillStyle = '#eef5ff';
    ctx.font = `700 ${this.fontSize}px "Rajdhani", "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 38, subtitle ? 57 : h / 2, w - 60);
    if (subtitle) {
      ctx.fillStyle = '#9db4cc';
      ctx.font = `600 ${Math.round(this.fontSize * 0.56)}px "Rajdhani", "Segoe UI", sans-serif`;
      ctx.fillText(subtitle, 38, 104, w - 60);
    }
    if (detail) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(38, h - 44, w - 76, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(38, h - 44, (w - 76) * Math.max(0, Math.min(1, detail.value)), 10);
      if (detail.label) {
        ctx.fillStyle = '#8fa8c2';
        ctx.font = '600 20px "Rajdhani", sans-serif';
        ctx.fillText(detail.label, 38, h - 62, w - 60);
      }
    }
    this.texture.needsUpdate = true;
  }

  update(title, subtitle, accent, detail = null) {
    const key = `${title}|${subtitle}|${accent}|${detail?.value?.toFixed?.(2) ?? ''}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.draw(title, subtitle, accent, detail);
  }
}

function rotateLocal(x, z, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

export class World {
  constructor(scene, sim) {
    this.scene = scene;
    this.sim = sim;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.colliders = [];
    this.interactables = [];
    this.machineVisuals = new Map();
    this.poiVisuals = new Map();
    this.poiLabels = new Map();
    this.veinVisuals = new Map();
    this.stateAccum = 0;
    this.nearestId = null;

    this.base = buildBase();
    this.group.add(this.base.group);
    this.colliders.push(...this.base.colliders);

    this.exterior = buildExterior();
    this.group.add(this.exterior.group);
    this.colliders.push(...this.exterior.colliders);

    this._buildMachines();
    this._buildStations();
    this._buildPois();
    this._buildMineralVeins();
    this._buildNasaTruck();
    this._buildRoomSigns();

    this.astronaut = new Astronaut();
    this.group.add(this.astronaut.group);

    this._buildHighlight();
    this._buildObjectiveMarker();

    this.bounds = { minX: -46, maxX: 46, minZ: -15.1, maxZ: 61.5 };
  }

  _buildMachines() {
    for (const row of Object.values(MACHINES)) {
      const visual = buildMachine(row.id);
      const isExterior = row.roomKey === 'room.exterior';
      visual.group.position.set(row.position[0], isExterior ? -0.08 : 0, row.position[2]);
      visual.group.rotation.y = row.rotationY ?? 0;
      this.group.add(visual.group);
      this.machineVisuals.set(row.id, visual);

      for (const collider of visual.colliders ?? []) {
        const rotated = rotateLocal(collider.x, collider.z, row.rotationY ?? 0);
        const swap = Math.abs(Math.sin(row.rotationY ?? 0)) > 0.5;
        const cx = row.position[0] + rotated.x;
        const cz = row.position[2] + rotated.z;
        const w = swap ? collider.d : collider.w;
        const d = swap ? collider.w : collider.d;
        this.colliders.push({
          minX: cx - w / 2,
          maxX: cx + w / 2,
          minZ: cz - d / 2,
          maxZ: cz + d / 2,
        });
      }

      this.interactables.push({
        id: row.id,
        type: 'machine',
        machineId: row.id,
        position: new THREE.Vector3(row.position[0], isExterior ? -0.08 : 0, row.position[2]),
        radius: row.id === 'solar_array' ? 4.6 : row.id === 'storm_shelter' ? 3.6 : 2.9,
        visual,
      });
    }
  }

  _buildStations() {
    const board = buildMissionBoard();
    board.group.position.set(MISSION_BOARD.position[0], 0, MISSION_BOARD.position[2]);
    board.group.rotation.y = MISSION_BOARD.rotationY ?? 0;
    this.group.add(board.group);
    this.colliders.push({ minX: -5.9, maxX: -3.1, minZ: 3.95, maxZ: 5.05 });
    this.interactables.push({
      id: 'mission_board',
      type: 'station',
      stationId: 'mission_board',
      position: new THREE.Vector3(MISSION_BOARD.position[0], 0, MISSION_BOARD.position[2]),
      radius: 2.6,
      visual: board,
    });

    const holo = buildHoloTable();
    holo.group.position.set(4.5, 0, 3.6);
    this.group.add(holo.group);
    this.colliders.push({ minX: 3.2, maxX: 5.8, minZ: 2.3, maxZ: 4.9 });
    this.holo = holo;

    // Greenhouse Ice Melter connected by liquid pipe to Hydroponics plants.
    const iceMelter = buildIceMelter();
    iceMelter.group.position.set(-9.2, 0, -10);
    this.group.add(iceMelter.group);
    this.colliders.push({ minX: -10.3, maxX: -8.1, minZ: -10.95, maxZ: -9.05 });
    const melterLabel = new WorldLabel('ICE MELTER', { worldWidth: 3.4, height: 170, fontSize: 44 });
    melterLabel.update('ICE MELTER', 'MELT H₂O ICE → PLANTS', '#4de2ff');
    melterLabel.sprite.position.set(-9.2, iceMelter.labelHeight, -10);
    this.group.add(melterLabel.sprite);
    this.iceMelter = iceMelter;
    this.interactables.push({
      id: 'ice_melter',
      type: 'station',
      stationId: 'ice_melter',
      position: new THREE.Vector3(-9.2, 0, -10),
      radius: 3.1,
      label: melterLabel,
      visual: iceMelter,
    });
  }

  _buildPois() {
    for (const poi of POIS) {
      const visual = buildPoi(poi);
      visual.group.position.set(poi.position[0], -0.08, poi.position[2]);
      this.group.add(visual.group);
      this.poiVisuals.set(poi.id, visual);
      const label = new WorldLabel(`SITE ${poi.code}`, { worldWidth: 4.8, height: 190, fontSize: 48 });
      label.sprite.position.set(poi.position[0], visual.labelHeight, poi.position[2]);
      this.group.add(label.sprite);
      this.poiLabels.set(poi.id, label);
      this.interactables.push({
        id: poi.id,
        type: 'poi',
        poiId: poi.id,
        position: new THREE.Vector3(poi.position[0], 0, poi.position[2]),
        radius: 3.4,
        label,
        visual,
      });
    }
  }

  _buildMineralVeins() {
    for (const vein of MINERAL_VEINS) {
      const mineral = MINERALS[vein.mineralId];
      if (!mineral) continue;
      const visual = buildMineralVein(vein, mineral);
      visual.group.position.set(vein.position[0], -0.08, vein.position[2]);
      this.group.add(visual.group);
      this.veinVisuals.set(vein.id, visual);

      for (const collider of visual.colliders ?? []) {
        this.colliders.push({
          minX: vein.position[0] + collider.x - collider.w / 2,
          maxX: vein.position[0] + collider.x + collider.w / 2,
          minZ: vein.position[2] + collider.z - collider.d / 2,
          maxZ: vein.position[2] + collider.z + collider.d / 2,
        });
      }

      const label = new WorldLabel(mineral.short, { worldWidth: 3.6, height: 170, fontSize: 44 });
      label.update(
        `${mineral.name.toUpperCase()} · ${mineral.formula}`,
        `MOHS ${mineral.mohs} · ${mineral.mineSeconds.toFixed(1)}s · INFINITE`,
        mineral.hex
      );
      label.sprite.position.set(vein.position[0], visual.labelHeight, vein.position[2]);
      this.group.add(label.sprite);

      this.interactables.push({
        id: vein.id,
        type: 'mineral',
        veinId: vein.id,
        mineralId: mineral.id,
        position: new THREE.Vector3(vein.position[0], 0, vein.position[2]),
        radius: 3.1,
        label,
        visual,
      });
    }
  }

  _buildNasaTruck() {
    const proto = NASA_PROTOTYPE_TRUCK;
    const visual = buildNasaTruck(proto);
    visual.group.position.set(proto.position[0], -0.08, proto.position[2]);
    visual.group.rotation.y = proto.rotationY ?? 0;
    this.group.add(visual.group);
    this.truckVisual = visual;

    for (const collider of visual.colliders ?? []) {
      const rotated = rotateLocal(collider.x, collider.z, proto.rotationY ?? 0);
      const swap = Math.abs(Math.sin(proto.rotationY ?? 0)) > 0.5;
      const cx = proto.position[0] + rotated.x;
      const cz = proto.position[2] + rotated.z;
      const w = swap ? collider.d : collider.w;
      const d = swap ? collider.w : collider.d;
      this.colliders.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
      });
    }

    const label = new WorldLabel('NASA SEV · CHARIOT', { worldWidth: 4.8, height: 180, fontSize: 44 });
    label.update('NASA SEV · CHARIOT', '12-WHEEL LUNAR TRUCK PROTOTYPE', '#ffb347');
    label.sprite.position.set(proto.position[0], visual.labelHeight, proto.position[2]);
    this.group.add(label.sprite);

    this.interactables.push({
      id: proto.id,
      type: 'prototype',
      position: new THREE.Vector3(proto.position[0], 0, proto.position[2]),
      radius: 4.5,
      label,
      visual,
    });
  }

  _buildRoomSigns() {
    // Wall-mounted plates, not billboards. Each one is placed on the inner face
    // of a north wall that faces the tilted camera, so it reads as a real sign.
    const rows = [
      { id: 'dormitory', title: 'DORMITORY', sub: 'CREW QUARTERS · STORM SHELTER', color: '#ffd8ad', x: -21.5, y: 1.35, z: -15.72, width: 6.0 },
      { id: 'greenhouse', title: 'GREENHOUSE', sub: 'HYDROPONICS · FOOD + O₂', color: '#8ef0b0', x: -5, y: 1.35, z: -15.72, width: 6.0 },
      { id: 'energy', title: 'POWER ROOM', sub: 'SOLAR · BATTERY · DISTRIBUTION', color: '#ffcf88', x: 15, y: 1.35, z: -15.72, width: 6.0 },
      { id: 'comms', title: 'COMMUNICATIONS', sub: 'DSN TERMINAL · SCIENCE REPORTS', color: '#9fc4ff', x: -18.5, y: 1.15, z: 2.71, width: 6.0 },
      { id: 'workshop', title: 'WORKSHOP', sub: 'O₂ · WATER · REPAIR BENCH', color: '#ffc08a', x: 22.5, y: 1.15, z: 2.71, width: 6.0 },
    ];
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c3442,
      roughness: 0.55,
      metalness: 0.35,
    });
    for (const row of rows) {
      const height = row.width * 0.25;
      const texture = makeCanvasTexture(1024, 256, (ctx, w, h) => {
        ctx.fillStyle = '#07131f';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(126,190,230,0.13)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.strokeStyle = row.color;
        ctx.lineWidth = 5;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = row.color;
        ctx.fillRect(10, 10, 14, h - 20);
        ctx.fillStyle = '#eef5ff';
        ctx.font = '700 100px "Rajdhani", "Segoe UI", sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(row.title, 48, 104, w - 80);
        ctx.fillStyle = '#9db4cc';
        ctx.font = '600 54px "Rajdhani", "Segoe UI", sans-serif';
        ctx.fillText(row.sub, 48, 186, w - 80);
        ctx.fillStyle = row.color;
        ctx.beginPath();
        ctx.arc(w - 44, 48, 9, 0, Math.PI * 2);
        ctx.fill();
      });
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(row.width + 0.16, height + 0.16, 0.08),
        frameMaterial
      );
      frame.position.set(row.x, row.y, row.z - 0.045);
      this.group.add(frame);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(row.width, height),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
      );
      plate.position.set(row.x, row.y, row.z);
      plate.renderOrder = 2;
      this.group.add(plate);
    }
  }

  _buildHighlight() {
    const geo = new THREE.RingGeometry(1.25, 1.48, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.teal,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    this.highlight = new THREE.Mesh(geo, mat);
    this.highlight.rotation.x = -Math.PI / 2;
    this.highlight.position.y = 0.14;
    this.highlight.visible = false;
    this.highlight.renderOrder = 3;
    this.group.add(this.highlight);
  }

  _buildObjectiveMarker() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.35, 5.5, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: COLORS.teal,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    beam.position.y = 2.75;
    group.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false })
    );
    diamond.position.y = 5.6;
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.035, 6, 28),
      new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 5.2;
    group.add(ring);
    group.visible = false;
    this.objective = { group, beam, diamond, ring };
    this.group.add(group);
  }

  setObjective(targetId) {
    if (!targetId) {
      this.objective.group.visible = false;
      this.objectiveTarget = null;
      return;
    }
    const interactable = this.interactables.find((item) => item.id === targetId);
    if (!interactable) {
      this.objective.group.visible = false;
      return;
    }
    this.objectiveTarget = targetId;
    this.objective.group.visible = true;
    this.objective.group.position.set(interactable.position.x, 0, interactable.position.z);
  }

  getRoomAt(x, z) {
    return getRoomAt(x, z);
  }

  getInteractable(id) {
    return this.interactables.find((item) => item.id === id) ?? null;
  }

  getPoi(id) {
    return POIS.find((poi) => poi.id === id) ?? null;
  }

  getMachineWorldPosition(id) {
    const row = MACHINES[id];
    if (!row) return null;
    return new THREE.Vector3(row.position[0], 0, row.position[2]);
  }

  getNearestInteractable(position, maxDistance = 3.6) {
    let best = null;
    let bestDist = Infinity;
    for (const item of this.interactables) {
      const dx = position.x - item.position.x;
      const dz = position.z - item.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= Math.max(maxDistance, item.radius) && dist < bestDist) {
        best = item;
        bestDist = dist;
      }
    }
    return best ? { ...best, distance: bestDist } : null;
  }

  describeInteraction(item, { pickaxeEquipped = true } = {}) {
    if (!item) return null;
    if (item.type === 'machine') {
      const row = MACHINES[item.machineId];
      const name = STRINGS[row.nameKey] ?? item.machineId;
      if (item.machineId === 'solar_array') {
        const dust = this.sim.state.dust;
        return {
          id: item.id,
          name,
          action: dust > 2 ? 'Clean panels' : 'Inspect array',
          hint: `${Math.round(dust)}% dust`,
          key: 'E',
        };
      }
      if (item.machineId === 'comms_console') {
        return {
          id: item.id,
          name,
          action: 'Open comms',
          hint: 'Reports · contracts · forecast',
          key: 'E',
        };
      }
      if (item.machineId === 'storm_shelter') {
        return {
          id: item.id,
          name,
          action: this.sim.state.shelterLocked ? 'Unlock shelter' : 'Lock shelter',
          hint: this.sim.state.shelterLocked ? 'Sealed' : 'Open',
          key: 'E',
        };
      }
      return { id: item.id, name, action: 'Inspect', hint: '', key: 'E' };
    }
    if (item.type === 'poi') {
      const poi = this.getPoi(item.poiId);
      const scanned = this.sim.state.scans.includes(item.poiId);
      return {
        id: item.id,
        name: `${STRINGS[poi.nameKey]}`,
        action: scanned ? 'Site sampled' : 'Scan site',
        hint: scanned ? 'Sample collected' : 'Stay still for 3 s',
        key: scanned ? '—' : 'E',
        disabled: scanned,
      };
    }
    if (item.type === 'mineral') {
      const mineral = MINERALS[item.mineralId];
      return {
        id: item.id,
        name: `${mineral.name} (${mineral.formula})`,
        action: pickaxeEquipped ? `Mine ${mineral.name}` : 'Equip Pickaxe [1]',
        hint: `Mohs ${mineral.mohs} · ${mineral.mineSeconds.toFixed(1)} s · Infinite`,
        key: pickaxeEquipped ? 'E' : '1',
      };
    }
    if (item.type === 'prototype') {
      return {
        id: item.id,
        name: NASA_PROTOTYPE_TRUCK.name,
        action: 'Inspect NASA Prototype',
        hint: '12-wheel Chariot / SEV data',
        key: 'E',
      };
    }
    if (item.id === 'ice_melter') {
      const iceCount = this.sim.state.minerals?.water_ice ?? 0;
      return {
        id: item.id,
        name: 'Ice Melter (Greenhouse)',
        action: iceCount > 0 ? 'Melt Water Ice → Plants' : 'Needs Water Ice',
        hint: iceCount > 0 ? `Carrying ×${iceCount} H₂O Ice · +12% Water, +4% Food` : 'Mine Water Ice outside first',
        key: 'E',
      };
    }
    return {
      id: item.id,
      name: STRINGS['station.mission_board.name'],
      action: 'Open',
      hint: '',
      key: 'E',
    };
  }

  isBlocked(x, z, radius) {
    for (const collider of this.colliders) {
      if (
        x + radius > collider.minX &&
        x - radius < collider.maxX &&
        z + radius > collider.minZ &&
        z - radius < collider.maxZ
      ) {
        return true;
      }
    }
    return false;
  }

  move(position, dx, dz, radius = 0.55) {
    let nx = position.x + dx;
    if (!this.isBlocked(nx, position.z, radius)) position.x = nx;
    let nz = position.z + dz;
    if (!this.isBlocked(position.x, nz, radius)) position.z = nz;

    position.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, position.x));
    position.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, position.z));

    // Keep the astronaut from walking around the outside of the outpost.
    if (position.z > 16.2) {
      const inAirlockExit = Math.abs(position.x) <= 2.2 && position.z < 18.4;
      if (!inAirlockExit) position.z = Math.max(17.1, position.z);
    } else if (position.z > 15.4 && Math.abs(position.x) > 2.2) {
      position.z = Math.min(15.4, position.z);
    }
    return position;
  }

  update(
    dt,
    sim,
    {
      nearest,
      scanProgress = 0,
      scanTarget = null,
      mineProgress = 0,
      mineTarget = null,
      pickaxeEquipped = true,
      moving = false,
      outside = false,
      time = 0,
      storm = 0,
    } = {}
  ) {
    this.stateAccum += dt;
    const refreshState = this.stateAccum > 0.2;
    if (refreshState) this.stateAccum = 0;

    for (const door of this.base.doors) {
      door.update(this.astronaut.group.position.x, this.astronaut.group.position.z, dt);
    }

    this.astronaut.setGroundY(outside ? -0.06 : 0);
    this.astronaut.setPickaxeEquipped(pickaxeEquipped);
    this.astronaut.update(dt, moving, Boolean(mineTarget));
    this.nearestId = nearest?.id ?? null;

    const now = performance.now();

    // Highlight ring.
    if (nearest && nearest.type !== 'poi') {
      this.highlight.visible = true;
      this.highlight.position.set(nearest.position.x, nearest.position.y + 0.14, nearest.position.z);
      const pulse = 1 + Math.sin(now * 0.004) * 0.06;
      this.highlight.scale.setScalar(pulse);
      this.highlight.material.opacity = 0.45 + Math.sin(now * 0.004) * 0.15;
    } else {
      this.highlight.visible = false;
    }

    // Machine state + labels.
    if (refreshState) {
      for (const [id, visual] of this.machineVisuals) {
        const view = sim.machineView(id);
        if (!view) continue;
        visual.setState?.(view, sim);
      }
      // POI labels.
      for (const poi of POIS) {
        const label = this.poiLabels.get(poi.id);
        if (!label) continue;
        const scanned = sim.state.scans.includes(poi.id);
        const reported = sim.state.reports.includes(poi.id);
        const sample = sim.state.samples.includes(poi.id);
        let status = scanned ? 'SAMPLE READY' : 'UNSCANNED';
        let accent = '#4de2ff';
        if (sample) {
          status = 'SAMPLE READY · TAKE TO COMMS';
          accent = '#ffb347';
        }
        if (reported) {
          status = 'REPORT SENT';
          accent = '#6ee7a8';
        }
        label.update(`SITE ${poi.code} · ${STRINGS[poi.nameKey]}`, status, accent);
      }
    }

    // Machine idle animations.
    for (const visual of this.machineVisuals.values()) visual.update?.(dt, sim);
    this.holo?.update?.(dt);
    this.iceMelter?.update?.(dt, sim);

    // POI scan progress and flags.
    for (const poi of POIS) {
      const visual = this.poiVisuals.get(poi.id);
      if (!visual) continue;
      const scanned = sim.state.scans.includes(poi.id);
      const progress = scanTarget === poi.id ? scanProgress : scanned ? 1 : 0;
      if (visual._lastProgress !== progress || visual._lastScanned !== scanned) {
        visual._lastProgress = progress;
        visual._lastScanned = scanned;
        visual.setProgress(progress, scanned);
      }
      visual.update?.(dt);
    }

    // Mineral vein mining progress.
    for (const vein of MINERAL_VEINS) {
      const visual = this.veinVisuals.get(vein.id);
      if (!visual) continue;
      const progress = mineTarget === vein.id ? mineProgress : 0;
      if (visual._lastProgress !== progress) {
        visual._lastProgress = progress;
        visual.setProgress(progress);
      }
    }
    this.truckVisual?.update?.(dt);

    // Label visibility & opacity.
    const player = this.astronaut.group.position;
    for (const item of this.interactables) {
      const label = item.label;
      if (!label) continue;
      const dist = Math.hypot(player.x - item.position.x, player.z - item.position.z);
      const maxDist = item.type === 'poi' ? 42 : 12.5;
      const visible = dist < maxDist;
      if (label.sprite.visible !== visible) label.sprite.visible = visible;
      if (!visible) continue;
      const isNearest = this.nearestId === item.id;
      const opacity = isNearest ? 1 : Math.min(1, Math.max(0.12, 1.25 - dist / maxDist));
      if (Math.abs(label.material.opacity - opacity) > 0.01) label.material.opacity = opacity;
      const wantDepth = !isNearest && item.type !== 'poi';
      if (label.material.depthTest !== wantDepth) label.material.depthTest = wantDepth;
      const wantOrder = isNearest ? 30 : 25;
      if (label.sprite.renderOrder !== wantOrder) label.sprite.renderOrder = wantOrder;
    }

    // Objective beacon.
    if (this.objective.group.visible) {
      const t = now * 0.001;
      this.objective.diamond.rotation.y += dt * 1.2;
      this.objective.diamond.position.y = 5.6 + Math.sin(t * 2.2) * 0.15;
      this.objective.ring.rotation.z += dt * 0.8;
      this.objective.beam.material.opacity = 0.09 + Math.sin(t * 1.4) * 0.03;
    }

    this.exterior.update(dt, storm);
  }

  /** Called when a scan begins/ends so the ring starts at zero cleanly. */
  resetScan() {}

  getSpawn() {
    return { x: 0, z: 2.5 };
  }
}
