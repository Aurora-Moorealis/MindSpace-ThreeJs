/**
 * Stage: renderer, cameras, sky, lighting and post-processing.
 *
 * The gameplay camera is orthographic and tilted, which keeps the outpost
 * readable from above while the astronaut and machines stay volumetric. Title
 * and intro use a perspective camera for a more cinematic look.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLORS, makeEarthTexture, seededRandom } from './primitives.js';
import { getHourOfDay, isDaylight } from '../data/economy.js';

const CINEMATIC_SHOTS = [
  { pos: [38, 32, 44], look: [0, 0, 3], fov: 48, drift: [0.5, 0.2, 0.3] },
  { pos: [13, 9, 25], look: [0, 1, 11], fov: 45, drift: [0.2, 0.05, 0.15] },
  { pos: [30, 17, 48], look: [3, 0, 33], fov: 55, drift: [-0.4, 0.25, 0.2] },
];

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.space);
    this.scene.fog = new THREE.FogExp2(0x0a1220, 0.0026);

    this.perspective = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
    this.orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.camera = this.perspective;
    this.mode = 'title';
    this.orthoHeight = 30;
    this.orthoTargetHeight = 30;
    this.userZoom = 0;
    this.followTarget = new THREE.Vector3(0, 0, 0);
    this.titleTime = 0;
    this.intro = { shot: 0, progress: 0 };
    this.interiorLights = [];
    this.env = { dayFactor: 1, storm: 0, outside: false, lightsOn: true };
    this._envKey = '';
    this._fogNightColor = new THREE.Color(0x070b14);
    this._fogDayColor = new THREE.Color(0x1a2a3f);
    this._fogStormColor = new THREE.Color(0x3a1218);
    this._fogWorkColor = new THREE.Color();
    this.quality = 'high';

    this._buildLights();
    this._buildSky();

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(window.innerWidth / 2)), Math.max(1, Math.floor(window.innerHeight / 2))),
      0.22,
      0.6,
      0.9
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  _buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9bb8ff, 0x3f4650, 0.5);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.position.set(30, 46, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -62;
    this.sun.shadow.camera.right = 62;
    this.sun.shadow.camera.top = 62;
    this.sun.shadow.camera.bottom = -62;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.sun.target.position.set(0, 0, 10);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0x4b6cff, 0.35);
    this.fill.position.set(-42, 26, -36);
    this.scene.add(this.fill);

    this.stormLight = new THREE.PointLight(0xff4a3a, 0, 90, 1.8);
    this.stormLight.position.set(0, 24, 34);
    this.scene.add(this.stormLight);

    this.ambient = new THREE.AmbientLight(0x26364c, 0.25);
    this.scene.add(this.ambient);
  }

  _buildSky() {
    const skyGeo = new THREE.SphereGeometry(230, 32, 20);
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x02030a) },
        uMid: { value: new THREE.Color(0x0a1424) },
        uBottom: { value: new THREE.Color(0x1b3550) },
        uDay: { value: 1.0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uBottom;
        uniform float uDay;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 night = mix(uBottom, uTop, smoothstep(-0.1, 0.65, h));
          vec3 day = mix(uBottom * 1.35, uTop + vec3(0.02, 0.04, 0.07), smoothstep(-0.1, 0.7, h));
          vec3 color = mix(night, day, clamp(uDay, 0.0, 1.0));
          float horizon = pow(1.0 - abs(h), 8.0);
          color += vec3(0.9, 0.45, 0.2) * horizon * 0.10 * uDay;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.sky.renderOrder = -20;
    this.scene.add(this.sky);

    // Stars.
    const rand = seededRandom(1337);
    const count = 1700;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const radius = 190 + rand() * 20;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) * 0.8 + 6;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const tint = rand();
      color.setHSL(0.58 + tint * 0.08, 0.25 + tint * 0.3, 0.7 + rand() * 0.25);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.starMaterial = new THREE.PointsMaterial({
      size: 1.25,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
    });
    this.starField = new THREE.Points(starGeo, this.starMaterial);
    this.starField.renderOrder = -19;
    this.scene.add(this.starField);

    // Earth, low on the northern horizon.
    const earthTexture = makeEarthTexture();
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(8, 48, 32),
      new THREE.MeshBasicMaterial({ map: earthTexture, fog: false })
    );
    earth.position.set(-74, 52, -126);
    earth.rotation.y = 2.1;
    this.earth = earth;
    this.scene.add(earth);

    const glowTexture = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 126);
      grad.addColorStop(0, 'rgba(125,205,255,0.55)');
      grad.addColorStop(0.45, 'rgba(70,150,255,0.18)');
      grad.addColorStop(1, 'rgba(20,60,140,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    glow.scale.set(34, 34, 1);
    glow.position.copy(earth.position);
    this.earthGlow = glow;
    this.scene.add(glow);

    // Distant sun disk (cinematic only).
    const sunTexture = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, 'rgba(255,252,235,1)');
      grad.addColorStop(0.2, 'rgba(255,230,170,0.9)');
      grad.addColorStop(0.5, 'rgba(255,180,80,0.25)');
      grad.addColorStop(1, 'rgba(255,120,20,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();
    this.sunSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sunTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    this.sunSprite.scale.set(22, 22, 1);
    this.sunSprite.position.set(112, 76, -150);
    this.scene.add(this.sunSprite);
  }

  registerInteriorLight(light) {
    this.interiorLights.push(light);
    if (!light.userData.baseIntensity) light.userData.baseIntensity = light.intensity;
    return light;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'follow') this.camera = this.orthographic;
    else this.camera = this.perspective;
    if (this.renderPass) this.renderPass.camera = this.camera;
  }

  setCinematicShot(shot, progress = 0) {
    this.mode = 'cinematic';
    this.camera = this.perspective;
    this.intro.shot = Math.max(0, Math.min(CINEMATIC_SHOTS.length - 1, shot));
    this.intro.progress = progress;
    const cfg = CINEMATIC_SHOTS[this.intro.shot];
    const drift = cfg.drift;
    this.camera.position.set(cfg.pos[0] + drift[0] * progress, cfg.pos[1] + drift[1] * progress, cfg.pos[2] + drift[2] * progress);
    this.camera.fov = cfg.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(cfg.look[0], cfg.look[1], cfg.look[2]);
  }

  snapFollow(target) {
    this.followTarget.copy(target);
    this.orthographic.position.set(target.x, target.y + 20, target.z + 24);
    this.orthographic.lookAt(target.x, target.y, target.z);
  }

  adjustZoom(delta) {
    this.userZoom = Math.max(-8, Math.min(12, this.userZoom + delta));
  }

  setEnvironment({ time, storm = 0, outside = false, lightsOn = true }) {
    const envKey = `${Math.floor(time * 20)}|${Math.round(storm * 250)}|${outside ? 1 : 0}|${lightsOn ? 1 : 0}`;
    if (envKey === this._envKey) return;
    this._envKey = envKey;

    const tick = Math.floor(time);
    const day = isDaylight(tick);
    const hour = getHourOfDay(tick);
    const sunElevation = Math.sin(((hour - 6) / 12) * Math.PI);
    const dayFactor = day ? Math.max(0.35, 0.35 + 0.65 * sunElevation) : 0;
    const nightFactor = 1 - dayFactor;
    this.env = { dayFactor, storm, outside, lightsOn };

    this.sun.intensity = 0.35 + dayFactor * 3.0;
    this.sun.color.setHSL(0.11 - dayFactor * 0.03, 0.35 + dayFactor * 0.35, 0.62 + dayFactor * 0.26);
    this.hemi.intensity = 0.3 + dayFactor * 0.7;
    this.ambient.intensity = 0.34 + dayFactor * 0.26;
    this.fill.intensity = 0.25 + nightFactor * 0.3;
    this.starMaterial.opacity = 0.18 + nightFactor * 0.8;
    this.skyMaterial.uniforms.uDay.value = dayFactor * 0.9 + 0.1;
    this.sunSprite.material.opacity = Math.max(0, dayFactor - 0.15) * 0.9;
    this.stormLight.intensity = storm * 1.3;
    this.stormLight.color.setRGB(1, 0.28, 0.18);

    this._fogWorkColor.copy(this._fogNightColor).lerp(this._fogDayColor, dayFactor);
    if (storm > 0) this._fogWorkColor.lerp(this._fogStormColor, Math.min(0.65, storm * 0.6));
    this.scene.fog.color.copy(this._fogWorkColor);
    this.scene.fog.density = 0.0022 + (outside ? 0.0006 : 0) + storm * 0.0012;

    for (const light of this.interiorLights) {
      const base = light.userData.baseIntensity ?? light.intensity;
      const on = lightsOn ? 1 : 0.12;
      light.intensity = base * on * (0.95 + nightFactor * 0.75) * (1 - storm * 0.15);
    }

    this.earth.material.color.setScalar(0.75 + dayFactor * 0.25);
    this.earthGlow.material.opacity = 0.55 + nightFactor * 0.35;
  }

  updateCamera(dt, { target, outside = false } = {}) {
    if (this.mode === 'follow' && target) {
      const smooth = 1 - Math.exp(-dt * 8);
      this.followTarget.lerp(target, smooth);
      this.orthoTargetHeight = (outside ? 32 : 30) + this.userZoom;
      const heightDiff = this.orthoTargetHeight - this.orthoHeight;
      if (Math.abs(heightDiff) > 0.001) {
        this.orthoHeight += heightDiff * (1 - Math.exp(-dt * 6));
        if (Math.abs(this.orthoTargetHeight - this.orthoHeight) <= 0.001) {
          this.orthoHeight = this.orthoTargetHeight;
        }
        this._updateOrthoFrustum();
      }
      const shake = this.env.storm > 0.35 ? Math.sin(performance.now() * 0.02) * 0.02 * this.env.storm : 0;
      this.orthographic.position.set(
        this.followTarget.x + shake,
        this.followTarget.y + 20,
        this.followTarget.z + 24
      );
      this.orthographic.lookAt(this.followTarget.x, this.followTarget.y, this.followTarget.z);
    } else if (this.mode === 'title' || this.mode === 'overview') {
      this.titleTime += dt;
      const speed = this.mode === 'overview' ? 0.035 : 0.045;
      const angle = 0.65 + this.titleTime * speed;
      const radius = this.mode === 'overview' ? 54 : 62;
      const height = this.mode === 'overview' ? 38 : 48;
      this.camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
      const targetFov = this.mode === 'overview' ? 46 : 48;
      if (this.camera.fov !== targetFov) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
      this.camera.lookAt(0, 0, this.mode === 'overview' ? 5 : 4);
    } else if (this.mode === 'cinematic') {
      const cfg = CINEMATIC_SHOTS[this.intro.shot];
      const p = this.intro.progress;
      this.camera.position.set(
        cfg.pos[0] + cfg.drift[0] * p,
        cfg.pos[1] + cfg.drift[1] * p,
        cfg.pos[2] + cfg.drift[2] * p
      );
      this.camera.lookAt(cfg.look[0], cfg.look[1], cfg.look[2]);
    }
  }

  _updateOrthoFrustum() {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const halfHeight = this.orthoHeight / 2;
    const halfWidth = halfHeight * aspect;
    this.orthographic.left = -halfWidth;
    this.orthographic.right = halfWidth;
    this.orthographic.top = halfHeight;
    this.orthographic.bottom = -halfHeight;
    this.orthographic.updateProjectionMatrix();
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.perspective.aspect = width / Math.max(1, height);
    this.perspective.updateProjectionMatrix();
    this._updateOrthoFrustum();
    this.bloomPass?.setSize(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
  }

  render() {
    this.composer.render();
  }
}
