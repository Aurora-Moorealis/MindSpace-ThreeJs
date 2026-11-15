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
} from './machines3d.js';
import { MACHINES, MISSION_BOARD } from '../data/machines.js';
import { POIS } from '../data/pois.js';
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
    this.missionStates = new Map();
    this.currentMissionTarget = null;
    this.missionMarkerSignature = '';
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

  _buildBeacon({ height = 5.5, top = 0.12, bottom = 0.35, diamondSize = 0.28, ringRadius = 0.5, labelHeight = 5.6 } = {}) {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(top, bottom, height, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: COLORS.teal,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      })
    );
    beam.position.y = height * 0.5;
    beam.renderOrder = 24;
    group.add(beam);
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(diamondSize, 0),
      new THREE.MeshBasicMaterial({ color: COLORS.teal, toneMapped: false, depthTest: false })
    );
    diamond.position.y = labelHeight;
    diamond.renderOrder = 25;
    group.add(diamond);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.035, 6, 28),
      new THREE.MeshBasicMaterial({
        color: COLORS.teal,
        toneMapped: false,
        transparent: true,
        opacity: 0.8,
        depthTest: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = labelHeight - 0.4;
    ring.renderOrder = 25;
    group.add(ring);
    group.visible = false;
    return { group, beam, diamond, ring, diamondY: labelHeight };
  }

  _buildObjectiveMarker() {
    this.objective = this._buildBeacon();
    this.group.add(this.objective.group);
  }

  _buildCommsMarker() {
    const pos = MACHINES.comms_console.position;
    this.commsMarker = this._buildBeacon({
      height: 4.6,
      top: 0.08,
      bottom: 0.22,
      diamondSize: 0.22,
      ringRadius: 0.4,
      labelHeight: 4.7,
    });
    this.commsMarker.group.position.set(pos[0], 0, pos[2]);
    this.commsMarker.group.visible = true;
    this.group.add(this.commsMarker.group);

    this.commsLabel = new WorldLabel('COMMS', { worldWidth: 3.4, height: 150, fontSize: 42 });
    this.commsLabel.sprite.position.set(pos[0], 4.15, pos[2]);
    this.commsLabel.sprite.renderOrder = 30;
    this.commsLabel.material.depthTest = false;
    this.group.add(this.commsLabel.sprite);
  }

  /**
   * Single entry point for mission guidance. The current target comes from the
   * same objective calculation as the HUD, so world and HUD cannot diverge.
   */
  setMissionMarkers({ currentId = null, scans = [], samples = [], reports = [] } = {}) {
    const signature = `${currentId ?? ''}|${scans.join(',')}|${samples.join(',')}|${reports.join(',')}`;
    if (signature === this.missionMarkerSignature) return;
    this.missionMarkerSignature = signature;
    this.currentMissionTarget = currentId;
    const reported = new Set(reports);
    const sampled = new Set(samples);

    for (const poi of POIS) {
      const state = reported.has(poi.id) ? 'reported' : sampled.has(poi.id) ? 'sampled' : 'pending';
      this.missionStates.set(poi.id, state);
      const current = currentId === poi.id;
      this.poiVisuals.get(poi.id)?.setMissionState(state, current);
      this._updatePoiLabel(poi, state, current);
    }

    const commsCurrent = currentId === 'comms_console';
    if (this.commsMarker) {
      const color = commsCurrent ? COLORS.teal : COLORS.metal;
      this.commsMarker.current = commsCurrent;
      this.commsMarker.beam.material.color.setHex(color);
      this.commsMarker.diamond.material.color.setHex(color);
      this.commsMarker.ring.material.color.setHex(color);
      this.commsMarker.beam.material.opacity = commsCurrent ? 0.2 : 0.05;
      this.commsLabel?.update(
        'COMMS',
        commsCurrent ? 'DELIVER SAMPLE' : 'REPORT TERMINAL',
        commsCurrent ? '#eef5ff' : '#9db4cc'
      );
    }

    // The generic beacon is reserved for non-POI targets; current POIs use
    // their own beacon so two beams never overlap on the same site.
    const genericTarget = Boolean(currentId && currentId !== 'comms_console' && !POIS.some((p) => p.id === currentId));
    this.objective.group.visible = genericTarget;
    if (genericTarget) {
      const item = this.getInteractable(currentId);
      if (item) this.objective.group.position.set(item.position.x, 0, item.position.z);
    }
  }

  /** Kept as a thin compatibility wrapper for old callers. */
  setObjective(targetId) {
    this.setMissionMarkers({
      currentId: targetId,
      scans: this.sim.state.scans,
      samples: this.sim.state.samples,
      reports: this.sim.state.reports,
    });
  }

  _updatePoiLabel(poi, state, current) {
    const label = this.poiLabels.get(poi.id);
    if (!label) return;
    let status = 'UNSCANNED';
    let accent = '#4de2ff';
    if (state === 'reported') {
      status = 'REPORT SENT';
      accent = '#6ee7a8';
    } else if (state === 'sampled') {
      status = 'SAMPLE READY · TAKE TO COMMS';
      accent = '#ffb347';
    } else if (current) {
      status = 'NEXT SURVEY';
      accent = '#eef5ff';
    }
    label.update(`SITE ${poi.code} · ${STRINGS[poi.nameKey]}`, status, accent);
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

  describeInteraction(item) {
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

  update(dt, sim, { nearest, scanProgress = 0, scanTarget = null, moving = false, sprinting = false, outside = false, time = 0, storm = 0 } = {}) {
    this.stateAccum += dt;
    const refreshState = this.stateAccum > 0.2;
    if (refreshState) this.stateAccum = 0;

    for (const door of this.base.doors) {
      door.update(this.astronaut.group.position.x, this.astronaut.group.position.z, dt);
    }

    this.astronaut.setGroundY(outside ? -0.06 : 0);
    this.astronaut.update(dt, moving, sprinting ? 1.5 : 1);
    this.nearestId = nearest?.id ?? null;

    // Highlight ring.
    if (nearest && nearest.type !== 'poi') {
      this.highlight.visible = true;
      this.highlight.position.set(nearest.position.x, nearest.position.y + 0.14, nearest.position.z);
      const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.06;
      this.highlight.scale.setScalar(pulse);
      this.highlight.material.opacity = 0.45 + Math.sin(performance.now() * 0.004) * 0.15;
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
        const state = this.missionStates.get(poi.id) ?? 'pending';
        this._updatePoiLabel(poi, state, this.currentMissionTarget === poi.id);
      }
    }

    // Machine idle animations.
    for (const visual of this.machineVisuals.values()) visual.update?.(dt, sim);
    this.holo?.update?.(dt);

    // POI scan progress and flags.
    for (const poi of POIS) {
      const visual = this.poiVisuals.get(poi.id);
      if (!visual) continue;
      const scanned = sim.state.scans.includes(poi.id);
      const progress = scanTarget === poi.id ? scanProgress : scanned ? 1 : 0;
      visual.setMissionState(this.missionStates.get(poi.id) ?? 'pending', this.currentMissionTarget === poi.id);
      visual.setProgress(progress, scanned);
      visual.update?.(dt);
    }

    // Label visibility & opacity.
    const player = this.astronaut.group.position;
    for (const item of this.interactables) {
      const label = item.label;
      if (!label) continue;
      const dist = Math.hypot(player.x - item.position.x, player.z - item.position.z);
      const maxDist = item.type === 'poi' ? 42 : 12.5;
      label.sprite.visible = dist < maxDist;
      label.material.opacity = Math.min(1, Math.max(0.12, 1.25 - dist / maxDist));
      const wantDepth = this.nearestId !== item.id && item.type !== 'poi';
      if (label.material.depthTest !== wantDepth) label.material.depthTest = wantDepth;
      if (this.nearestId === item.id) {
        label.sprite.renderOrder = 30;
        label.material.opacity = 1;
      }
    }

    // Comms marker label: permanent, but only legible near the base.
    if (this.commsLabel) {
      const comms = MACHINES.comms_console.position;
      const commsDistance = Math.hypot(player.x - comms[0], player.z - comms[2]);
      this.commsLabel.sprite.visible = commsDistance < 30;
      this.commsLabel.material.opacity = Math.min(1, Math.max(0.15, 1.25 - commsDistance / 30));
    }

    // Mission beacons.
    if (this.objective.group.visible) {
      this._animateBeacon(this.objective, dt, { current: true });
    }
    if (this.commsMarker?.group.visible) {
      this._animateBeacon(this.commsMarker, dt, {
        current: Boolean(this.commsMarker.current),
        dim: !this.commsMarker.current,
      });
    }

    this.exterior.update(dt, storm);
  }

  _animateBeacon(marker, dt, { current = false, dim = false } = {}) {
    const t = performance.now() * 0.001;
    marker.diamond.rotation.y += dt * (current ? 2.0 : 0.8);
    marker.diamond.position.y = marker.diamondY + Math.sin(t * (current ? 3.0 : 2.0)) * (current ? 0.18 : 0.08);
    marker.ring.rotation.z += dt * (current ? 1.3 : 0.4);
    marker.beam.material.opacity = current
      ? 0.2 + Math.sin(t * 2.4) * 0.05
      : dim
        ? 0.04
        : 0.09 + Math.sin(t * 1.4) * 0.02;
  }

  /** Called when a scan begins/ends so the ring starts at zero cleanly. */
  resetScan() {}

  getSpawn() {
    return { x: 0, z: 2.5 };
  }
}
