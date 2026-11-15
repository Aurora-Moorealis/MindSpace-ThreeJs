/**
 * Small Three.js construction helpers shared by the world builders.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const MATERIAL_CACHE = new Map();

export const COLORS = {
  space: 0x05080f,
  moon: 0x8d8d93,
  moonDark: 0x63636b,
  moonLight: 0xb7b7bd,
  floor: 0x2b313d,
  floorLight: 0x39414f,
  floorDark: 0x1d222b,
  wall: 0xc9c4b9,
  wallDark: 0x8f8b82,
  wallTrim: 0x4e5666,
  metal: 0x76808f,
  darkMetal: 0x2d3442,
  black: 0x10141c,
  white: 0xe8eef7,
  hazard: 0xf2b134,
  teal: 0x4de2ff,
  green: 0x6ee7a8,
  amber: 0xffb347,
  red: 0xff5a6a,
  purple: 0xb98cff,
  blue: 0x5b8cff,
  glass: 0x8fd8ff,
  warm: 0xffd9a0,
};

export function material(
  color,
  {
    roughness = 0.82,
    metalness = 0.08,
    emissive = 0x000000,
    emissiveIntensity = 1,
    transparent = false,
    opacity = 1,
    flatShading = true,
    side = THREE.FrontSide,
    depthWrite = true,
  } = {}
) {
  const key = [color, roughness, metalness, emissive, emissiveIntensity, transparent, opacity, flatShading, side, depthWrite].join('|');
  if (MATERIAL_CACHE.has(key)) return MATERIAL_CACHE.get(key);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    transparent,
    opacity,
    flatShading,
    side,
    depthWrite,
  });
  MATERIAL_CACHE.set(key, mat);
  return mat;
}

export function glowMaterial(color, intensity = 2) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

export function box(w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, opts.material ?? material(color, opts));
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}

export function rounded(w, h, d, radius, color, opts = {}) {
  const geo = new RoundedBoxGeometry(w, h, d, 2, radius);
  const mesh = new THREE.Mesh(geo, opts.material ?? material(color, opts));
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}

export function cylinder(radiusTop, radiusBottom, height, segments, color, opts = {}) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  const mesh = new THREE.Mesh(geo, opts.material ?? material(color, opts));
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}

export function sphere(radius, segments, color, opts = {}) {
  const geo = new THREE.SphereGeometry(radius, segments, Math.max(8, Math.floor(segments / 2)));
  const mesh = new THREE.Mesh(geo, opts.material ?? material(color, opts));
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  return mesh;
}

export function glowBar(w, h, d, color, intensity = 2) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glowMaterial(color, intensity));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function makeTextSprite(
  text,
  {
    worldWidth = 3.2,
    color = '#e8eef7',
    background = 'rgba(8, 14, 24, 0.82)',
    border = '#4de2ff',
    accent = null,
    fontSize = 40,
    subtext = null,
    subColor = '#91a8c4',
    padding = 22,
    align = 'left',
    font = 'Rajdhani',
  } = {}
) {
  const canvasW = 640;
  const canvasH = subtext ? 180 : 128;
  const texture = makeCanvasTexture(canvasW, canvasH, (ctx) => {
    ctx.clearRect(0, 0, canvasW, canvasH);
    if (background) {
      ctx.fillStyle = background;
      ctx.beginPath();
      const r = 18;
      ctx.roundRect(4, 4, canvasW - 8, canvasH - 8, r);
      ctx.fill();
      ctx.strokeStyle = border ?? 'rgba(77,226,255,0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(4, 4, 10, canvasH - 8);
    }
    ctx.fillStyle = color;
    ctx.font = `700 ${fontSize}px "${font}", "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    const x = align === 'center' ? canvasW / 2 : accent ? 34 : padding;
    ctx.fillText(text, x, subtext ? 62 : canvasH / 2 + 2, canvasW - padding * 2);
    if (subtext) {
      ctx.fillStyle = subColor;
      ctx.font = `500 ${Math.round(fontSize * 0.66)}px "${font}", "Segoe UI", sans-serif`;
      ctx.fillText(subtext, x, 124, canvasW - padding * 2);
    }
  });
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvasH / canvasW;
  sprite.scale.set(worldWidth, worldWidth * aspect, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 20;
  return sprite;
}

export function makeFloorDecal(text, worldWidth, color = '#e8eef7', { accent = false, fontSize = 48 } = {}) {
  const texture = makeCanvasTexture(1024, 256, (ctx) => {
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = color;
    ctx.font = `700 ${fontSize}px "Rajdhani", "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 512, 128, 960);
    if (accent) {
      ctx.fillStyle = color;
      ctx.fillRect(180, 196, 664, 6);
    }
  });
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldWidth, worldWidth * 0.25), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  return mesh;
}

export function makePanelTexture({ base = '#2f3542', line = '#454f61', size = 256, cells = 4, bolts = true } = {}) {
  return makeCanvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const cell = w / cells;
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    for (let i = 0; i <= cells; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(w, i * cell);
      ctx.stroke();
    }
    // Subtle cell shading and dust speckle so large floors do not read as flat.
    let seed = 9137;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let cx = 0; cx < cells; cx += 1) {
      for (let cy = 0; cy < cells; cy += 1) {
        const shade = rand() * 0.05;
        ctx.fillStyle = `rgba(255,255,255,${shade.toFixed(3)})`;
        ctx.fillRect(cx * cell + 2, cy * cell + 2, cell - 4, cell - 4);
      }
    }
    for (let i = 0; i < 1600; i += 1) {
      const value = rand() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgba(${value},${value},${value},${(rand() * 0.035).toFixed(3)})`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }
    if (bolts) {
      ctx.fillStyle = 'rgba(180,195,215,0.35)';
      for (let x = 0; x <= cells; x += 1) {
        for (let y = 0; y <= cells; y += 1) {
          ctx.beginPath();
          ctx.arc(x * cell + 8, y * cell + 8, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
}

export function makeHazardTexture({ colorA = '#f2b134', colorB = '#1b1f27', size = 256 } = {}) {
  return makeCanvasTexture(size, size, (ctx, w, h) => {
    ctx.fillStyle = colorB;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = colorA;
    ctx.lineWidth = 30;
    for (let i = -h; i < w + h; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, h);
      ctx.lineTo(i + h, 0);
      ctx.stroke();
    }
  });
}

export function makeEarthTexture() {
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    const ocean = ctx.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, '#0b2a4d');
    ocean.addColorStop(0.5, '#155a8a');
    ocean.addColorStop(1, '#0a2743');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);
    // Fictional cloud-free continents: deliberately stylised, not a map.
    const blobs = [
      [95, 92, 42, 60],
      [150, 130, 28, 38],
      [270, 70, 52, 34],
      [300, 125, 30, 66],
      [400, 105, 44, 28],
      [430, 165, 26, 34],
      [60, 170, 24, 22],
    ];
    ctx.fillStyle = '#3f7d54';
    for (const [x, y, rx, ry] of blobs) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, Math.PI / 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 137) % w;
      const y = (i * 73) % h;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + (i % 5) * 7, 5 + (i % 3) * 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.7);
    glow.addColorStop(0, 'rgba(120,200,255,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });
}

export function seededRandom(seed = 1) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function addOutline(mesh, color = 0x0a0d13, opacity = 0.55) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 25),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.add(edges);
  return edges;
}

export function disposeTree(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}
