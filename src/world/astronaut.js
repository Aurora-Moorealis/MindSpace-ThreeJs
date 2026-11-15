/**
 * The astronaut avatar. Low-poly, rigged with simple pivots, animated with a
 * walk cycle and a breathing idle. The group faces +Z at rotation.y = 0.
 */

import * as THREE from 'three';
import { COLORS, box, cylinder, glowBar, material, rounded, sphere } from './primitives.js';

function addContactShadow(group) {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = 1;
  group.add(shadow);
}

export class Astronaut {
  constructor(template = null) {
    this.group = new THREE.Group();
    this.walkPhase = 0;
    this.moving = false;
    this.facing = 0;
    this.targetFacing = 0;
    this.speedMultiplier = 1;
    this.groundY = 0;

    if (template) {
      // Authored GLB with named rigid pivots. Clone it so a future second
      // astronaut instance would not share transforms.
      this.group.add(template.clone(true));
      this.loaded = true;
      this.torso = this.group.getObjectByName('Torso');
      this.armL = this.group.getObjectByName('ArmL');
      this.armR = this.group.getObjectByName('ArmR');
      this.legL = this.group.getObjectByName('LegL');
      this.legR = this.group.getObjectByName('LegR');
      this.chestLight = this.group.getObjectByName('ChestLight');
      this.antennaLight = this.group.getObjectByName('AntennaLight');
      addContactShadow(this.group);
      this.group.position.set(0, 0, 2.5);
      return;
    }

    this.loaded = false;

    const suit = material(0xe7ebef, { roughness: 0.62, metalness: 0.05 });
    const suitShade = material(0xc7ccd2, { roughness: 0.7, metalness: 0.05 });
    const dark = material(0x252b35, { roughness: 0.6, metalness: 0.3 });
    const orange = material(0xff9f43, { roughness: 0.55, metalness: 0.15 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x0a1822,
      roughness: 0.16,
      metalness: 0.65,
      emissive: 0x1f7fa8,
      emissiveIntensity: 0.7,
    });

    // Torso.
    const torso = rounded(0.56, 0.66, 0.4, 0.12, 0xe7ebef, { material: suit });
    torso.position.y = 1.02;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.group.add(torso);
    this.torso = torso;

    const chest = rounded(0.36, 0.24, 0.06, 0.03, 0x2f3a48);
    chest.position.set(0, 1.12, 0.215);
    this.group.add(chest);
    const chestLight = glowBar(0.22, 0.035, 0.02, COLORS.teal, 2);
    chestLight.position.set(0, 1.16, 0.25);
    this.group.add(chestLight);
    this.chestLight = chestLight;
    for (let i = 0; i < 3; i += 1) {
      const button = glowBar(0.04, 0.04, 0.02, [COLORS.amber, COLORS.green, COLORS.red][i], 1.5);
      button.position.set(-0.1 + i * 0.1, 1.04, 0.25);
      this.group.add(button);
    }

    // Belt and hip.
    const belt = box(0.5, 0.1, 0.38, orange);
    belt.position.y = 0.74;
    this.group.add(belt);
    const hip = rounded(0.46, 0.22, 0.36, 0.08, suitShade);
    hip.position.y = 0.63;
    this.group.add(hip);

    // Helmet.
    const helmet = sphere(0.31, 18, 0xe9edf1, { material: suit });
    helmet.position.y = 1.56;
    helmet.castShadow = true;
    this.group.add(helmet);
    const visor = sphere(0.245, 16, 0x0a1822, { material: visorMat });
    visor.scale.set(0.92, 0.72, 0.5);
    visor.position.set(0, 1.56, 0.19);
    this.group.add(visor);
    const neck = cylinder(0.18, 0.2, 0.14, 10, dark);
    neck.position.y = 1.34;
    this.group.add(neck);
    const helmetRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.235, 0.03, 6, 20),
      orange
    );
    helmetRim.rotation.x = 0.2;
    helmetRim.position.set(0, 1.35, 0.03);
    this.group.add(helmetRim);

    // Backpack.
    const pack = rounded(0.5, 0.62, 0.24, 0.06, suitShade);
    pack.position.set(0, 1.03, -0.31);
    this.group.add(pack);
    for (const x of [-0.14, 0.14]) {
      const tank = cylinder(0.08, 0.08, 0.5, 8, COLORS.metal);
      tank.position.set(x, 1.02, -0.46);
      this.group.add(tank);
    }
    const antenna = cylinder(0.012, 0.012, 0.35, 4, COLORS.metal);
    antenna.position.set(0.16, 1.52, -0.34);
    this.group.add(antenna);
    const antennaLight = sphere(0.035, 6, COLORS.red, {
      material: new THREE.MeshBasicMaterial({ color: COLORS.red, toneMapped: false }),
      castShadow: false,
    });
    antennaLight.position.set(0.16, 1.7, -0.34);
    this.group.add(antennaLight);
    this.antennaLight = antennaLight;

    // Arms.
    const makeArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.35, 1.22, 0);
      const upper = cylinder(0.075, 0.085, 0.34, 8, suit);
      upper.position.y = -0.17;
      upper.castShadow = true;
      pivot.add(upper);
      const elbow = sphere(0.082, 8, suitShade);
      elbow.position.y = -0.36;
      pivot.add(elbow);
      const fore = cylinder(0.065, 0.075, 0.3, 8, suit);
      fore.position.y = -0.53;
      fore.castShadow = true;
      pivot.add(fore);
      const glove = sphere(0.09, 8, dark);
      glove.position.y = -0.71;
      pivot.add(glove);
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.02, 4, 10), orange);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.63;
      pivot.add(cuff);
      this.group.add(pivot);
      return pivot;
    };
    this.armL = makeArm(-1);
    this.armR = makeArm(1);

    // Lunar pickaxe held in right hand when slot 1 is equipped.
    const pickaxe = new THREE.Group();
    const shaft = cylinder(0.025, 0.028, 0.72, 6, COLORS.amber);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, -0.71, 0.24);
    pickaxe.add(shaft);
    const head = box(0.36, 0.06, 0.08, COLORS.teal);
    head.position.set(0, -0.71, 0.54);
    pickaxe.add(head);
    pickaxe.visible = true;
    this.armR.add(pickaxe);
    this.pickaxe = pickaxe;

    // Legs.
    const makeLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.16, 0.62, 0);
      const thigh = cylinder(0.095, 0.105, 0.34, 8, suit);
      thigh.position.y = -0.17;
      thigh.castShadow = true;
      pivot.add(thigh);
      const knee = sphere(0.1, 8, suitShade);
      knee.position.y = -0.36;
      pivot.add(knee);
      const shin = cylinder(0.085, 0.09, 0.3, 8, suit);
      shin.position.y = -0.52;
      shin.castShadow = true;
      pivot.add(shin);
      const boot = rounded(0.18, 0.14, 0.3, 0.04, dark);
      boot.position.set(0, -0.7, 0.06);
      pivot.add(boot);
      this.group.add(pivot);
      return pivot;
    };
    this.legL = makeLeg(-1);
    this.legR = makeLeg(1);

    addContactShadow(this.group);

    this.group.position.set(0, 0, 2.5);
  }

  setPosition(x, z) {
    this.group.position.x = x;
    this.group.position.z = z;
  }

  setFacing(angle) {
    this.targetFacing = angle;
  }

  setGroundY(y) {
    this.groundY = y;
  }

  setPickaxeEquipped(equipped) {
    if (this.pickaxe) this.pickaxe.visible = Boolean(equipped);
  }

  update(dt, moving, speedFactor = 1, mining = false) {
    this.moving = moving;
    const speed = 8.5;
    if (moving) this.walkPhase += dt * speed * speedFactor;
    else if (mining) this.walkPhase += dt * 9.5;
    else this.walkPhase += dt * 1.6;
    const swing = moving ? Math.sin(this.walkPhase) * 0.62 : Math.sin(this.walkPhase) * 0.025;
    const armSwing = moving ? Math.sin(this.walkPhase) * 0.5 : Math.sin(this.walkPhase) * 0.02;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -armSwing;
    this.armR.rotation.x = mining ? -0.65 + Math.sin(this.walkPhase) * 0.85 : armSwing;
    this.armL.rotation.z = 0.04;
    this.armR.rotation.z = -0.04;
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.045 : Math.sin(this.walkPhase) * 0.008;
    this.group.position.y = this.groundY + bob;
    this.torso.rotation.z = moving ? Math.sin(this.walkPhase) * 0.03 : 0;

    let delta = this.targetFacing - this.facing;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.facing += delta * (1 - Math.exp(-dt * 14));
    this.group.rotation.y = this.facing;

    const now = performance.now();
    this.antennaLight.visible = Math.sin(now * 0.004) > 0.4;
    if (this.loaded) {
      // The GLB chest panel uses an emissive PBR material; pulse its intensity
      // instead of changing the base colour.
      const pulse = Math.sin(now * 0.002) > 0.6;
      this.chestLight.material.emissiveIntensity = pulse ? 2.6 : 0.4;
    } else {
      this.chestLight.material.color.setHex(Math.sin(now * 0.002) > 0.6 ? COLORS.teal : 0x2a6a80);
    }
  }
}
