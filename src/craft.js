import * as THREE from 'three';
import { PLANES, planeById, isCraftUnlocked, cockpitGuns, COCKPIT_CAM, gunLayout, sightFor } from './sim/planes.js';

export const CRAFTS = PLANES.filter((p) => !p.aiOnly);
export const craftById = planeById;
export { isCraftUnlocked };

function canvasTex(draw, size = 256, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

const panelMap = canvasTex((x, W) => {
  x.fillStyle = '#9aa194';
  x.fillRect(0, 0, W, W);
  x.strokeStyle = 'rgba(18, 22, 20, 0.28)';
  x.lineWidth = 1;
  for (let y = 0; y < W; y += 32) {
    x.beginPath();
    x.moveTo(0, y + 0.5);
    x.lineTo(W, y + 0.5);
    x.stroke();
  }
  for (let px = 0; px < W; px += 48) {
    x.beginPath();
    x.moveTo(px + 0.5, 0);
    x.lineTo(px + 0.5, W);
    x.stroke();
  }
  x.fillStyle = 'rgba(12, 14, 16, 0.22)';
  for (let y = 8; y < W; y += 16) {
    for (let px = 8; px < W; px += 16) {
      x.beginPath();
      x.arc(px + ((y / 16) % 2) * 8, y, 0.9, 0, Math.PI * 2);
      x.fill();
    }
  }
  x.fillStyle = 'rgba(255, 252, 245, 0.05)';
  for (let i = 0; i < 50; i++) x.fillRect((i * 23) % W, 0, 1, W);
}, 256, 3, 2);

const camoMap = canvasTex((x, W) => {
  x.fillStyle = '#3f4c34';
  x.fillRect(0, 0, W, W);
  x.fillStyle = '#6a5340';
  for (let i = 0; i < 16; i++) {
    x.beginPath();
    x.ellipse((i * 47) % W, (i * 73) % W, 36 + (i % 5) * 8, 18 + (i % 4) * 6, i * 0.5, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = '#2c3628';
  for (let i = 0; i < 9; i++) {
    x.beginPath();
    x.ellipse((i * 61 + 20) % W, (i * 41) % W, 22, 14, i * 0.4, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = 'rgba(10, 12, 10, 0.2)';
  for (let y = 0; y < W; y += 36) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(W, y);
    x.stroke();
  }
}, 256, 2, 2);

const desertMap = canvasTex((x, W) => {
  x.fillStyle = '#c4a46a';
  x.fillRect(0, 0, W, W);
  x.fillStyle = '#8a6a40';
  for (let i = 0; i < 12; i++) {
    x.beginPath();
    x.ellipse((i * 53) % W, (i * 71) % W, 34, 16, i, 0, Math.PI * 2);
    x.fill();
  }
  x.strokeStyle = 'rgba(60, 40, 18, 0.18)';
  for (let y = 0; y < W; y += 32) {
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(W, y);
    x.stroke();
  }
}, 256, 2, 2);

const navyMap = canvasTex((x, W) => {
  x.fillStyle = '#2c3d55';
  x.fillRect(0, 0, W, W);
  x.fillStyle = 'rgba(18, 26, 38, 0.35)';
  for (let y = 0; y < W; y += 28) x.fillRect(0, y, W, 1);
  for (let px = 0; px < W; px += 40) x.fillRect(px, 0, 1, W);
  x.fillStyle = 'rgba(8, 10, 14, 0.25)';
  for (let y = 8; y < W; y += 14) {
    for (let px = 8; px < W; px += 14) {
      x.beginPath();
      x.arc(px, y, 0.8, 0, Math.PI * 2);
      x.fill();
    }
  }
}, 256, 2, 2);

const mats = {
  metal: new THREE.MeshStandardMaterial({ color: 0x6a706c, map: panelMap, roughness: 0.42, metalness: 0.62, envMapIntensity: 0.85 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a3034, roughness: 0.38, metalness: 0.72, envMapIntensity: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb68c4a, roughness: 0.38, metalness: 0.62, envMapIntensity: 0.75 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.96, metalness: 0.04 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xb9d4e4,
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.32,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
  }),
  gun: new THREE.MeshStandardMaterial({ color: 0x252c30, roughness: 0.36, metalness: 0.7 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.78, metalness: 0.02 }),
  dash: new THREE.MeshStandardMaterial({ color: 0x1c2226, roughness: 0.55, metalness: 0.25 }),
};

const mat = (color, roughness = 0.55, metalness = 0.35) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: metalness > 0.2 ? 0.85 : 0.28 });

function hexCss(n) {
  return `#${n.toString(16).padStart(6, '0')}`;
}

const pitSkinCache = {};
function pitSkin(hex) {
  const key = `p${hex}`;
  if (pitSkinCache[key]) return pitSkinCache[key];
  const t = canvasTex((x, W) => {
    x.fillStyle = hexCss(hex);
    x.fillRect(0, 0, W, W);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = `rgba(${i % 3 === 0 ? '20,16,10' : '0,0,0'},${0.025 + (i % 6) * 0.012})`;
      x.fillRect((i * 47) % W, (i * 31) % W, 1 + (i % 3), 1 + (i % 2));
    }
    x.fillStyle = 'rgba(255, 248, 230, 0.045)';
    for (let i = 0; i < 14; i++) x.fillRect((i * 41 + 8) % W, 0, 2, W);
    x.fillStyle = 'rgba(30, 22, 12, 0.08)';
    for (let i = 0; i < 10; i++) {
      x.beginPath();
      x.ellipse((i * 67) % W, (i * 53) % W, 28, 10, i * 0.4, 0, Math.PI * 2);
      x.fill();
    }
    for (let y = 28; y < W; y += 56) {
      x.strokeStyle = 'rgba(12, 14, 12, 0.16)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(0, y + 0.5);
      x.lineTo(W, y + 0.5);
      x.stroke();
      for (let px = 18; px < W; px += 36) {
        const cx = px + ((y / 56) % 2) * 18;
        x.fillStyle = 'rgba(28, 28, 24, 0.5)';
        x.beginPath();
        x.arc(cx, y, 2.4, 0, Math.PI * 2);
        x.fill();
        x.strokeStyle = 'rgba(8, 8, 6, 0.45)';
        x.lineWidth = 1;
        x.beginPath();
        x.arc(cx, y, 2.4, 0, Math.PI * 2);
        x.stroke();
        x.fillStyle = 'rgba(220, 210, 190, 0.28)';
        x.beginPath();
        x.arc(cx - 0.6, y - 0.7, 0.7, 0, Math.PI * 2);
        x.fill();
      }
    }
  }, 256, 1.15, 1.15);
  pitSkinCache[key] = t;
  return t;
}

const leatherCache = {};
function leatherMap(hex) {
  const key = `l${hex}`;
  if (leatherCache[key]) return leatherCache[key];
  const t = canvasTex((x, W) => {
    x.fillStyle = hexCss(hex);
    x.fillRect(0, 0, W, W);
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(20, 10, 6, ${0.08 + (i % 5) * 0.04})`;
      x.beginPath();
      x.moveTo((i * 19) % W, 0);
      x.bezierCurveTo((i * 29) % W, W * 0.35, (i * 13) % W, W * 0.7, (i * 41) % W, W);
      x.stroke();
    }
    x.fillStyle = 'rgba(0, 0, 0, 0.2)';
    for (let y = 2; y < W; y += 4) {
      for (let px = 2; px < W; px += 4) x.fillRect(px + (y % 8), y, 1, 1);
    }
    x.fillStyle = 'rgba(255, 210, 160, 0.07)';
    for (let i = 0; i < 24; i++) x.fillRect((i * 31) % W, (i * 47) % W, 14, 2);
    x.strokeStyle = 'rgba(40, 18, 8, 0.18)';
    for (let y = 20; y < W; y += 40) {
      x.beginPath();
      x.moveTo(0, y);
      x.lineTo(W, y + 6);
      x.stroke();
    }
  }, 256, 1.4, 1.4);
  leatherCache[key] = t;
  return t;
}

function pitBasic(hex) {
  return new THREE.MeshBasicMaterial({ map: pitSkin(hex), color: 0xffffff });
}

function leatherBasic(hex) {
  return new THREE.MeshBasicMaterial({ map: leatherMap(hex), color: 0xffffff });
}

function skinMat(color, map, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: map || null,
    roughness: extra.roughness ?? 0.46,
    metalness: extra.metalness ?? 0.28,
    envMapIntensity: extra.envMapIntensity ?? 0.95,
    vertexColors: Boolean(extra.vertexColors),
    ...extra,
  });
}

function typeSpec(type, enemy) {
  if (type === 'p40') {
    return {
      fuse: [
        [-4.55, 0.02],
        [-4.32, 0.2],
        [-4.12, 0.34],
        [-3.55, 0.46],
        [-2.7, 0.44],
        [-1.5, 0.4],
        [-0.35, 0.38],
        [0.55, 0.36],
        [1.8, 0.3],
        [3.15, 0.2],
        [4.05, 0.1],
        [4.35, 0.03],
      ],
      oval: 0.9,
      wingY: -0.02,
      wingZ: 0.15,
      halfSpan: 5.5,
      rootC: 2.05,
      tipC: 0.95,
      thick: 0.13,
      dihedral: 0.07,
      sweep: 0.1,
      color: 0x5a6a3a,
      wing: 0x6a5340,
      blades: 3,
      shark: true,
      map: desertMap,
      spinner: 0xc45a28,
      radial: false,
      canopyZ: 0.18,
      canopyY: 0.42,
      gearX: 1.55,
      gearZ: 0.22,
      fin: 'p40',
    };
  }
  if (type === 'mustang') {
    return {
      fuse: [
        [-4.7, 0.02],
        [-4.48, 0.22],
        [-4.2, 0.38],
        [-3.5, 0.48],
        [-2.55, 0.44],
        [-1.35, 0.4],
        [-0.2, 0.38],
        [0.7, 0.36],
        [2.05, 0.28],
        [3.35, 0.18],
        [4.15, 0.09],
        [4.45, 0.03],
      ],
      oval: 0.86,
      wingY: -0.06,
      wingZ: 0.22,
      halfSpan: 5.55,
      rootC: 1.92,
      tipC: 0.78,
      thick: 0.11,
      dihedral: 0.09,
      sweep: 0.16,
      color: 0xb8bdb6,
      wing: 0xa8aea6,
      blades: 4,
      scoop: true,
      bubble: true,
      map: panelMap,
      spinner: 0xc4a24a,
      metalness: 0.52,
      roughness: 0.3,
      canopyZ: 0.22,
      canopyY: 0.46,
      canopyLen: 1.7,
      gearX: 1.7,
      gearZ: 0.18,
      fin: 'mustang',
    };
  }
  if (type === 'bf109') {
    return {
      fuse: [
        [-4.15, 0.02],
        [-3.95, 0.18],
        [-3.7, 0.32],
        [-3.15, 0.4],
        [-2.2, 0.36],
        [-1.1, 0.34],
        [-0.15, 0.32],
        [0.7, 0.3],
        [1.9, 0.24],
        [3.05, 0.16],
        [3.75, 0.08],
        [4.05, 0.025],
      ],
      oval: 0.82,
      wingY: 0.0,
      wingZ: 0.08,
      halfSpan: 4.85,
      rootC: 1.72,
      tipC: 0.92,
      thick: 0.12,
      dihedral: 0.1,
      sweep: 0.08,
      color: enemy ? 0x6a7460 : 0x7a8068,
      wing: 0x4a5340,
      blades: 3,
      axis: true,
      yellowNose: true,
      map: camoMap,
      spinner: 0xc4a24a,
      canopyZ: 0.08,
      canopyY: 0.38,
      gearX: 1.05,
      gearZ: 0.12,
      gearSplay: 0.22,
      fin: 'bf109',
    };
  }
  if (type === 'hellcat') {
    return {
      fuse: [
        [-4.55, 0.04],
        [-4.35, 0.28],
        [-4.15, 0.52],
        [-3.55, 0.58],
        [-2.6, 0.54],
        [-1.35, 0.5],
        [-0.2, 0.48],
        [0.85, 0.44],
        [2.15, 0.34],
        [3.4, 0.22],
        [4.2, 0.11],
        [4.5, 0.03],
      ],
      oval: 1.02,
      wingY: 0.04,
      wingZ: 0.12,
      halfSpan: 6.2,
      rootC: 2.25,
      tipC: 1.05,
      thick: 0.16,
      dihedral: 0.08,
      sweep: 0.14,
      color: 0x3a4e6a,
      wing: 0x324860,
      blades: 3,
      chunky: true,
      radial: true,
      map: navyMap,
      spinner: 0xc8c4b0,
      canopyZ: 0.2,
      canopyY: 0.52,
      canopyLen: 1.5,
      gearX: 1.85,
      gearZ: 0.2,
      fin: 'hellcat',
    };
  }
  if (type === 'stuka') {
    return {
      fuse: [
        [-4.35, 0.02],
        [-4.15, 0.2],
        [-3.9, 0.34],
        [-3.2, 0.44],
        [-2.15, 0.46],
        [-0.9, 0.44],
        [0.15, 0.4],
        [1.15, 0.36],
        [2.4, 0.28],
        [3.55, 0.18],
        [4.25, 0.1],
        [4.55, 0.03],
      ],
      oval: 0.95,
      wingY: 0.12,
      wingZ: 0.05,
      halfSpan: 6.4,
      rootC: 2.15,
      tipC: 1.05,
      thick: 0.14,
      dihedral: 0.12,
      sweep: 0.06,
      gull: true,
      color: 0x5a6248,
      wing: 0x4a5238,
      blades: 3,
      axis: true,
      fixedGear: true,
      yellowNose: true,
      map: camoMap,
      spinner: 0xc4a24a,
      canopyZ: 0.28,
      canopyY: 0.48,
      canopyLen: 1.85,
      gearX: 1.35,
      gearZ: 0.22,
      gearLen: 1.35,
      spats: true,
      fin: 'stuka',
    };
  }
  if (type === 'zero') {
    return {
      fuse: [
        [-4.25, 0.03],
        [-4.08, 0.24],
        [-3.88, 0.42],
        [-3.3, 0.44],
        [-2.2, 0.4],
        [-1.05, 0.36],
        [0.05, 0.34],
        [1.05, 0.32],
        [2.25, 0.24],
        [3.35, 0.16],
        [4.05, 0.08],
        [4.32, 0.025],
      ],
      oval: 0.88,
      wingY: 0.0,
      wingZ: 0.1,
      halfSpan: 5.9,
      rootC: 1.95,
      tipC: 0.88,
      thick: 0.11,
      dihedral: 0.1,
      sweep: 0.05,
      color: 0x6a7a48,
      wing: 0x5a6a3a,
      blades: 3,
      axis: true,
      hinomaru: true,
      radial: true,
      map: camoMap,
      spinner: 0xc4b060,
      canopyZ: 0.14,
      canopyY: 0.4,
      gearX: 1.65,
      gearZ: 0.16,
      fin: 'zero',
    };
  }
  if (type === 'oscar') {
    return {
      fuse: [
        [-4.05, 0.03],
        [-3.88, 0.22],
        [-3.68, 0.38],
        [-3.15, 0.4],
        [-2.1, 0.36],
        [-1.0, 0.33],
        [0.05, 0.31],
        [1.0, 0.29],
        [2.15, 0.22],
        [3.2, 0.14],
        [3.85, 0.07],
        [4.12, 0.022],
      ],
      oval: 0.84,
      wingY: 0.02,
      wingZ: 0.08,
      halfSpan: 5.45,
      rootC: 1.82,
      tipC: 0.82,
      thick: 0.1,
      dihedral: 0.09,
      sweep: 0.04,
      color: 0x7a8a58,
      wing: 0x6a7a48,
      blades: 2,
      axis: true,
      hinomaru: true,
      radial: true,
      map: camoMap,
      spinner: 0xc4a24a,
      canopyZ: 0.12,
      canopyY: 0.38,
      gearX: 1.55,
      gearZ: 0.14,
      fin: 'oscar',
    };
  }
  return {
    fuse: [
      [-4.45, 0.02],
      [-4.22, 0.2],
      [-4.0, 0.36],
      [-3.35, 0.46],
      [-2.4, 0.42],
      [-1.2, 0.38],
      [-0.15, 0.36],
      [0.75, 0.34],
      [2.05, 0.26],
      [3.25, 0.16],
      [4.0, 0.08],
      [4.32, 0.025],
    ],
    oval: 0.84,
    wingY: -0.02,
    wingZ: 0.12,
    halfSpan: 5.5,
    rootC: 2.05,
    tipC: 0.55,
    thick: 0.11,
    dihedral: 0.1,
    sweep: 0.04,
    elliptical: true,
    color: enemy ? 0x6a7460 : 0x5a6a48,
    wing: enemy ? 0x7a6450 : 0x4a5840,
    blades: 3,
    map: camoMap,
    spinner: 0xc8c4b0,
    canopyZ: 0.1,
    canopyY: 0.4,
    gearX: 1.45,
    gearZ: 0.18,
    fin: 'spitfire',
  };
}

function fuseGeometry(stations) {
  const pts = stations.map(([z, r]) => new THREE.Vector2(Math.max(0.018, r), z));
  const g = new THREE.LatheGeometry(pts, 24);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function makeWingGeometry(spec) {
  const halfSpan = spec.halfSpan;
  const sections = spec.gull ? 14 : 11;
  const chordSegs = 9;
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const spanStations = sections + 1;
  const chordStations = chordSegs + 1;

  const station = (s) => {
    const span = s * halfSpan;
    const chord = spec.elliptical
      ? spec.rootC * Math.sqrt(Math.max(0.06, 1 - s * s))
      : spec.rootC + (spec.tipC - spec.rootC) * s;
    let y = Math.tan(spec.dihedral || 0) * span;
    if (spec.gull) {
      y = s < 0.26 ? -0.58 * (s / 0.26) : -0.58 + 0.92 * ((s - 0.26) / 0.74);
    }
    const zLe = -chord * 0.3 - (spec.sweep || 0) * span;
    return { span, chord, y, zLe };
  };

  const foil = (chord, t, upper) => {
    const x = Math.max(t, 0.001);
    const yt =
      spec.thick *
      chord *
      (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    return { zOff: t * chord, yOff: upper ? yt : -yt * 0.34 };
  };

  for (const side of [-1, 1]) {
    for (let i = 0; i < spanStations; i++) {
      const st = station(i / sections);
      for (let j = 0; j < chordStations; j++) {
        const t = j / chordSegs;
        for (const upper of [true, false]) {
          const af = foil(st.chord, t, upper);
          positions.push(side * st.span, st.y + af.yOff, st.zLe + af.zOff);
          uvs.push(t, i / sections);
          if (upper) colors.push(1, 1, 1);
          else colors.push(0.7, 0.78, 0.86);
        }
      }
    }
  }

  const perStation = chordStations * 2;
  const perSide = spanStations * perStation;
  const vid = (sideIdx, i, j, upper) => sideIdx * perSide + i * perStation + j * 2 + (upper ? 0 : 1);

  for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
    const left = sideIdx === 0;
    for (let i = 0; i < sections; i++) {
      for (let j = 0; j < chordSegs; j++) {
        for (const upper of [true, false]) {
          const a = vid(sideIdx, i, j, upper);
          const b = vid(sideIdx, i + 1, j, upper);
          const c = vid(sideIdx, i + 1, j + 1, upper);
          const d = vid(sideIdx, i, j + 1, upper);
          const flip = left ? !upper : upper;
          if (flip) indices.push(a, b, c, a, c, d);
          else indices.push(a, c, b, a, d, c);
        }
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function finGeometry(kind) {
  const s = new THREE.Shape();
  if (kind === 'bf109') {
    s.moveTo(0, 0);
    s.lineTo(0.78, 0.02);
    s.lineTo(0.62, 1.18);
    s.lineTo(0.1, 1.2);
    s.lineTo(0, 0.16);
  } else if (kind === 'mustang') {
    s.moveTo(0, 0);
    s.lineTo(0.95, 0.02);
    s.lineTo(0.52, 1.32);
    s.lineTo(0.08, 1.24);
    s.lineTo(0, 0.18);
  } else if (kind === 'hellcat') {
    s.moveTo(0, 0);
    s.lineTo(1.08, 0.02);
    s.quadraticCurveTo(1.18, 0.55, 0.72, 1.28);
    s.quadraticCurveTo(0.18, 1.32, 0, 0.22);
  } else if (kind === 'stuka') {
    s.moveTo(0, 0);
    s.lineTo(1.18, 0);
    s.lineTo(0.98, 1.42);
    s.lineTo(0.12, 1.46);
    s.lineTo(0, 0.18);
  } else if (kind === 'p40') {
    s.moveTo(0, 0);
    s.lineTo(0.9, 0);
    s.lineTo(0.5, 1.14);
    s.lineTo(0.06, 1.06);
    s.lineTo(0, 0.16);
  } else if (kind === 'zero') {
    s.moveTo(0, 0);
    s.lineTo(0.84, 0);
    s.quadraticCurveTo(0.98, 0.48, 0.5, 1.08);
    s.quadraticCurveTo(0.1, 1.1, 0, 0.18);
  } else if (kind === 'oscar') {
    s.moveTo(0, 0);
    s.lineTo(0.78, 0);
    s.quadraticCurveTo(0.92, 0.42, 0.42, 1.18);
    s.quadraticCurveTo(0.08, 1.2, 0, 0.16);
  } else {
    s.moveTo(0, 0);
    s.lineTo(0.98, 0.02);
    s.bezierCurveTo(1.18, 0.38, 0.88, 1.02, 0.4, 1.22);
    s.bezierCurveTo(0.1, 1.26, 0.06, 0.72, 0, 0.2);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.09,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 1,
  });
  g.rotateY(-Math.PI / 2);
  g.translate(0.045, 0, 0);
  g.computeVertexNormals();
  return g;
}

function bladeGeometry(len = 1.62) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.08);
  s.quadraticCurveTo(0.09, len * 0.28, 0.08, len * 0.62);
  s.quadraticCurveTo(0.045, len * 0.92, 0.01, len);
  s.quadraticCurveTo(-0.045, len * 0.92, -0.08, len * 0.62);
  s.quadraticCurveTo(-0.09, len * 0.28, 0, 0.08);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.028, bevelEnabled: false });
  g.translate(0, 0, -0.014);
  g.rotateY(0.18);
  return g;
}

function decalTex(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const roundelTex = decalTex((x, S) => {
  const rings = [
    [S * 0.46, '#d8d7c9'],
    [S * 0.32, '#344e70'],
    [S * 0.16, '#9c4031'],
  ];
  rings.forEach(([r, col]) => {
    x.fillStyle = col;
    x.beginPath();
    x.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    x.fill();
  });
});

const crossTex = decalTex((x, S) => {
  x.fillStyle = '#e8e2d4';
  x.fillRect(S * 0.08, S * 0.08, S * 0.84, S * 0.84);
  x.fillStyle = '#1a1a1a';
  x.fillRect(S * 0.18, S * 0.42, S * 0.64, S * 0.16);
  x.fillRect(S * 0.42, S * 0.18, S * 0.16, S * 0.64);
});

const hinomaruTex = decalTex((x, S) => {
  x.fillStyle = '#b43028';
  x.beginPath();
  x.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  x.fill();
});

const starTex = decalTex((x, S) => {
  x.fillStyle = '#d8d7c9';
  x.beginPath();
  x.arc(S / 2, S / 2, S * 0.46, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#3a5a8a';
  x.beginPath();
  x.arc(S / 2, S / 2, S * 0.34, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#d8d7c9';
  x.beginPath();
  const cx = S / 2;
  const cy = S / 2;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const px = cx + Math.cos(a) * S * 0.28;
    const py = cy + Math.sin(a) * S * 0.28;
    if (i === 0) x.moveTo(px, py);
    else x.lineTo(px, py);
    const b = a + Math.PI / 5;
    x.lineTo(cx + Math.cos(b) * S * 0.11, cy + Math.sin(b) * S * 0.11);
  }
  x.closePath();
  x.fill();
});

const sharkTex = decalTex((x, S) => {
  x.clearRect(0, 0, S, S);
  x.fillStyle = '#e8e0cf';
  x.beginPath();
  x.moveTo(8, S * 0.55);
  x.lineTo(S * 0.92, S * 0.2);
  x.lineTo(S * 0.92, S * 0.85);
  x.closePath();
  x.fill();
  x.fillStyle = '#1a1a1a';
  for (let i = 0; i < 6; i++) {
    const u = 18 + i * 16;
    x.beginPath();
    x.moveTo(u, S * 0.52);
    x.lineTo(u + 7, S * 0.72);
    x.lineTo(u + 14, S * 0.52);
    x.fill();
  }
  x.fillStyle = '#c43028';
  x.beginPath();
  x.arc(S * 0.72, S * 0.38, 10, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#111';
  x.beginPath();
  x.arc(S * 0.72, S * 0.38, 4, 0, Math.PI * 2);
  x.fill();
}, 160);

function wingPoint(spec, s, chordT = 0.4) {
  const span = s * spec.halfSpan;
  const chord = spec.elliptical
    ? spec.rootC * Math.sqrt(Math.max(0.06, 1 - s * s))
    : spec.rootC + (spec.tipC - spec.rootC) * s;
  let y = Math.tan(spec.dihedral || 0) * span;
  let dihedral = spec.dihedral || 0;
  if (spec.gull) {
    if (s < 0.26) {
      y = -0.58 * (s / 0.26);
      dihedral = -Math.atan2(0.58, 0.26 * spec.halfSpan);
    } else {
      y = -0.58 + 0.92 * ((s - 0.26) / 0.74);
      dihedral = Math.atan2(0.92, 0.74 * spec.halfSpan);
    }
  }
  const zLe = -chord * 0.3 - (spec.sweep || 0) * span;
  const t = Math.max(chordT, 0.001);
  const yt =
    spec.thick *
    chord *
    (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1036 * t ** 4);
  return { span, y, z: zLe + t * chord, yt, dihedral };
}

function addDecal(parent, tex, pos, rot, size) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      roughness: 0.62,
      metalness: 0.08,
      envMapIntensity: 0.4,
    }),
  );
  m.position.set(pos[0], pos[1], pos[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}

function addMarkings(shell, spec) {
  const pt = wingPoint(spec, spec.gull ? 0.62 : 0.55, 0.38);
  const y = spec.wingY + pt.y + pt.yt + 0.014;
  const z = spec.wingZ + pt.z;
  const tex = spec.hinomaru
    ? hinomaruTex
    : spec.axis
      ? crossTex
      : spec.shark || spec.fin === 'mustang' || spec.fin === 'hellcat'
        ? starTex
        : roundelTex;
  const size = spec.hinomaru ? 0.72 : 0.7;
  for (const side of [-1, 1]) {
    addDecal(shell, tex, [side * pt.span, y, z], [-Math.PI / 2, 0, side * pt.dihedral], size);
  }
}

function gaugeFace(label) {
  const W = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const x = c.getContext('2d');
  x.fillStyle = '#0d0c0a';
  x.beginPath();
  x.arc(64, 64, 62, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#c4a06a';
  x.lineWidth = 3;
  x.stroke();
  x.strokeStyle = '#d8c4a0';
  x.lineWidth = 1.5;
  for (let a = -2.3; a <= 2.3; a += 0.38) {
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * 42, 64 + Math.sin(a) * 42);
    x.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
    x.stroke();
  }
  x.fillStyle = '#c4a06a';
  x.font = 'bold 14px sans-serif';
  x.textAlign = 'center';
  x.fillText(label, 64, 96);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeGauge(label, bezelHex = 0xc4a06a) {
  const g = new THREE.Group();
  const rim = new THREE.MeshBasicMaterial({ color: bezelHex });
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.016, 22), rim);
  bezel.rotation.x = Math.PI / 2;
  g.add(bezel);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.052, 22),
    new THREE.MeshBasicMaterial({ color: 0xc8d8e4, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  glass.position.z = 0.014;
  g.add(glass);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.05, 22), new THREE.MeshBasicMaterial({ map: gaugeFace(label) }));
  face.position.z = 0.009;
  g.add(face);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.003), rim);
  needle.position.set(0, 0.012, 0.012);
  g.add(needle);
  g.userData.needle = needle;
  return g;
}

function drawDial(ctx, cx, cy, r, label = '', face = '#0c0c0a') {
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#080806';
  ctx.fill();
  const bezel = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.08, cx, cy, r + 3);
  bezel.addColorStop(0, '#e0c48a');
  bezel.addColorStop(0.45, '#9a7844');
  bezel.addColorStop(1, '#2a2010');
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2.2, 0, Math.PI * 2);
  ctx.strokeStyle = bezel;
  ctx.lineWidth = Math.max(2.2, r * 0.16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = '#3a3830';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#d8d0b8';
  ctx.lineWidth = Math.max(1, r * 0.04);
  const ticks = r > 18 ? 12 : 8;
  for (let i = 0; i < ticks; i++) {
    const a = -Math.PI * 0.8 + (i / (ticks - 1)) * Math.PI * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
    ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f0c45a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.42, cy - r * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1.4, r * 0.06), 0, Math.PI * 2);
  ctx.fillStyle = '#c4a06a';
  ctx.fill();
  if (label) {
    ctx.fillStyle = '#c8c0a4';
    ctx.font = `bold ${Math.max(7, Math.round(r * 0.26))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r * 0.52);
  }
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.22, cy - r * 0.3, r * 0.52, r * 0.26, -0.55, 0, Math.PI);
  ctx.fillStyle = 'rgba(210, 225, 235, 0.16)';
  ctx.fill();
}

function panelArt(type) {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = type === 'stuka' || type === 'bf109' ? '#141612' : '#161616';
  x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255, 252, 240, 0.035)';
  for (let i = 0; i < W; i += 2) x.fillRect(i, 0, 1, H);
  const screw = (sx, sy) => {
    x.beginPath();
    x.arc(sx, sy, 5, 0, Math.PI * 2);
    x.fillStyle = '#6a6458';
    x.fill();
    x.strokeStyle = '#1c1a14';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(sx - 3, sy);
    x.lineTo(sx + 3, sy);
    x.stroke();
  };
  [
    [14, 14],
    [W - 14, 14],
    [14, H - 14],
    [W - 14, H - 14],
    [W * 0.5, 14],
    [W * 0.5, H - 14],
  ].forEach(([sx, sy]) => screw(sx, sy));
  if (type === 'stuka') {
    x.fillStyle = '#7a4e2c';
    x.fillRect(0, 0, W, 36);
    x.fillStyle = '#9a6840';
    x.fillRect(28, 6, W - 56, 24);
    [
      [180, 100, 44, ''],
      [296, 88, 56, ''],
      [420, 76, 68, ''],
      [544, 76, 68, ''],
      [668, 88, 56, ''],
      [792, 100, 44, ''],
      [236, 200, 36, ''],
      [336, 212, 48, ''],
      [452, 220, 40, ''],
      [556, 220, 40, ''],
      [672, 212, 48, ''],
      [780, 200, 36, ''],
      [336, 340, 32, ''],
      [452, 348, 36, ''],
      [572, 348, 36, ''],
      [688, 340, 32, ''],
    ].forEach(([cx, cy, r, label]) => drawDial(x, cx, cy, r, label));
    x.fillStyle = '#2a2c24';
    x.fillRect(56, 300, 104, 144);
    x.fillStyle = '#c4a24a';
    x.fillRect(860, 300, 36, 140);
  } else if (type === 'bf109') {
    x.fillStyle = '#0e100e';
    x.beginPath();
    x.moveTo(140, 8);
    x.lineTo(884, 8);
    x.lineTo(1000, 500);
    x.lineTo(24, 500);
    x.closePath();
    x.fill();
    [
      [300, 96, 52, ''],
      [428, 80, 64, ''],
      [572, 80, 64, ''],
      [700, 96, 52, ''],
      [336, 200, 36, ''],
      [452, 208, 40, ''],
      [572, 208, 40, ''],
      [688, 200, 36, ''],
      [336, 320, 32, ''],
      [452, 332, 36, ''],
      [572, 332, 36, ''],
      [688, 320, 32, ''],
    ].forEach(([cx, cy, r, label]) => drawDial(x, cx, cy, r, label));
    x.fillStyle = '#1c1e1a';
    x.fillRect(80, 300, 140, 160);
    x.fillRect(800, 300, 140, 160);
  } else if (type === 'spitfire') {
    [
      [280, 140, 64, 'ASI'],
      [420, 124, 72, 'ALT'],
      [568, 140, 64, 'RPM'],
      [280, 296, 56, 'BOOST'],
      [420, 308, 60, 'TURN'],
      [568, 296, 56, 'FUEL'],
      [712, 176, 36, ''],
      [712, 264, 32, ''],
      [176, 220, 32, ''],
      [176, 308, 28, ''],
      [420, 444, 40, ''],
    ].forEach(([cx, cy, r, label]) => drawDial(x, cx, cy, r, label));
    x.fillStyle = '#2a4a8a';
    x.fillRect(780, 140, 44, 44);
    x.fillStyle = '#8a2a1c';
    x.fillRect(836, 140, 44, 44);
  } else if (type === 'zero' || type === 'oscar') {
    x.fillStyle = '#3a4630';
    x.fillRect(0, 0, 80, H);
    x.fillRect(W - 80, 0, 80, H);
    [
      [260, 156, 60, 'ASI'],
      [400, 140, 68, 'ALT'],
      [548, 140, 68, 'RPM'],
      [696, 156, 60, 'OIL'],
      [336, 300, 40, ''],
      [460, 312, 44, ''],
      [588, 300, 40, ''],
      [460, 420, 32, ''],
    ].forEach(([cx, cy, r, label]) => drawDial(x, cx, cy, r, label));
  } else {
    [
      [240, 144, 60, 'ASI'],
      [376, 128, 68, 'ALT'],
      [520, 128, 68, 'RPM'],
      [656, 144, 60, type === 'mustang' ? 'MP' : 'FUEL'],
      [312, 280, 44, 'OIL'],
      [428, 292, 48, 'TEMP'],
      [548, 292, 48, ''],
      [664, 280, 44, ''],
      [240, 400, 32, ''],
      [376, 412, 36, ''],
      [520, 412, 36, ''],
      [656, 400, 32, ''],
      [792, 200, 32, ''],
      [792, 296, 32, ''],
    ].forEach(([cx, cy, r, label]) => drawDial(x, cx, cy, r, label));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const panelTexCache = {};
function panelTexture(type) {
  if (!panelTexCache[type]) panelTexCache[type] = panelArt(type);
  return panelTexCache[type];
}

function pitTheme(type) {
  const cam = { x: COCKPIT_CAM.x, y: COCKPIT_CAM.y, z: COCKPIT_CAM.z, look: 0 };
  const germanBezel = 0x2a2c28;
  const brassBezel = 0xc4a06a;
  const themes = {
    spitfire: {
      pit: 0x6a7a68,
      dash: 0x141614,
      leather: 0x6a4030,
      gauges: ['ASI', 'ALT', 'RPM', 'BOOST', 'TURN', 'FUEL'],
      stick: 'spade',
      sight: 'aldis',
      bezel: brassBezel,
      width: 1.22,
      cam,
    },
    p40: {
      pit: 0x3d5a38,
      dash: 0x1a1e16,
      leather: 0x4a3224,
      gauges: ['ASI', 'ALT', 'RPM', 'FUEL', 'OIL', 'TEMP'],
      stick: 'us',
      sight: 'n9',
      bezel: brassBezel,
      width: 1.24,
      cam,
    },
    mustang: {
      pit: 0x3a4a38,
      dash: 0x121416,
      leather: 0x3a281c,
      gauges: ['ASI', 'ALT', 'RPM', 'MP', 'FUEL', 'TEMP'],
      stick: 'us',
      sight: 'n9',
      bezel: brassBezel,
      width: 1.26,
      cam,
    },
    hellcat: {
      pit: 0x2e3a34,
      dash: 0x101214,
      leather: 0x2e241c,
      gauges: ['ASI', 'ALT', 'RPM', 'FUEL', 'OIL', 'TEMP'],
      stick: 'us',
      sight: 'n9',
      bezel: brassBezel,
      width: 1.32,
      cam,
    },
    stuka: {
      pit: 0x6a7458,
      dash: 0x141612,
      leather: 0x8a5a30,
      gauges: ['FAHRT', 'HOEHE', 'DREZ', 'KRAFT', 'OEL', 'TEMP'],
      stick: 'german',
      sight: 'revi',
      bezel: germanBezel,
      width: 1.38,
      cam,
    },
    bf109: {
      pit: 0x5a6a58,
      dash: 0x101210,
      leather: 0x4a3828,
      gauges: ['FAHRT', 'HOEHE', 'DREZ', 'BOOST', 'OEL', 'TEMP'],
      stick: 'german',
      sight: 'revi',
      bezel: germanBezel,
      width: 1.18,
      cam,
    },
    zero: {
      pit: 0x6a7a52,
      dash: 0x222018,
      leather: 0x5a4030,
      gauges: ['ASI', 'ALT', 'RPM', 'OIL', 'TEMP', 'FUEL'],
      stick: 'ijn',
      sight: 'type99',
      bezel: brassBezel,
      width: 1.2,
      cam,
    },
    oscar: {
      pit: 0x74805a,
      dash: 0x222018,
      leather: 0x6a4a32,
      gauges: ['ASI', 'ALT', 'RPM', 'OIL', 'TEMP', 'FUEL'],
      stick: 'ijn',
      sight: 'type99',
      bezel: brassBezel,
      width: 1.18,
      cam,
    },
  };
  return themes[type] || themes.spitfire;
}

function addGunsight() {
  // Aim mark is the HUD reticle. 3D sight bodies in the look path read as
  // floating boxes (Revi) or off-center rings (Type 99).
}

function frameTube(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 7, false), material);
}

function addWindscreen(g, type, w, pitHex) {
  const frame = new THREE.MeshBasicMaterial({ color: pitHex });
  const hw = w * 0.47;
  const z = -0.36;
  const top = type === 'stuka' ? 0.98 : type === 'hellcat' || type === 'mustang' ? 0.92 : 0.86;
  g.add(
    frameTube(
      [
        new THREE.Vector3(-hw, 0.0, z + 0.06),
        new THREE.Vector3(-hw * 0.97, top * 0.46, z + 0.02),
        new THREE.Vector3(-hw * 0.42, top * 0.94, z - 0.02),
        new THREE.Vector3(0, top, z - 0.03),
        new THREE.Vector3(hw * 0.42, top * 0.94, z - 0.02),
        new THREE.Vector3(hw * 0.97, top * 0.46, z + 0.02),
        new THREE.Vector3(hw, 0.0, z + 0.06),
      ],
      type === 'stuka' ? 0.016 : 0.014,
      frame,
    ),
  );
  if (type === 'stuka') {
    g.add(
      frameTube(
        [
          new THREE.Vector3(-hw * 0.9, 0.22, z + 0.03),
          new THREE.Vector3(0, 0.5, z - 0.05),
          new THREE.Vector3(hw * 0.9, 0.22, z + 0.03),
        ],
        0.01,
        frame,
      ),
    );
    for (const t of [-0.52, 0, 0.52]) {
      const h = 0.46;
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, h, 6), frame);
      rib.position.set(t * hw * 0.7, 0.04 + h * 0.5, z);
      rib.rotation.x = 0.06;
      g.add(rib);
    }
  }
}

function makeStick(kind) {
  const stick = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.02, 0.4, 8), mats.darkMetal);
  shaft.position.set(0, 0.08, 0);
  stick.add(shaft);
  if (kind === 'spade') {
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.04), mats.leather);
    grip.position.set(0, 0.28, 0.01);
    stick.add(grip);
  } else if (kind === 'german') {
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), mats.leather);
    grip.position.set(0, 0.28, 0.01);
    stick.add(grip);
    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.02), mats.darkMetal);
    horn.position.set(0, 0.3, 0.02);
    stick.add(horn);
  } else if (kind === 'ijn') {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.1, 8), mats.leather);
    grip.position.set(0, 0.28, 0);
    stick.add(grip);
  } else {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.09, 8), mats.leather);
    grip.position.set(0, 0.28, 0);
    stick.add(grip);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), mats.leather);
    head.position.set(0, 0.33, 0);
    stick.add(head);
  }
  stick.position.set(0, -0.16, 0.1);
  stick.rotation.x = 0.42;
  return stick;
}

function makeCockpitInterior(type = 'spitfire') {
  const guns = cockpitGuns(type);
  const theme = pitTheme(type);
  const wallMat = pitBasic(theme.pit);
  const seatMat = leatherBasic(theme.leather);
  const dashMat = new THREE.MeshBasicMaterial({ map: panelTexture(type) });
  const w = theme.width;
  const g = new THREE.Group();
  g.name = 'cockpit';
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, 0.9), wallMat);
  floor.position.set(0, -0.38, 0.08);
  floor.receiveShadow = true;
  g.add(floor);
  const bulk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.46, 0.06), wallMat);
  bulk.position.set(0, -0.08, 0.7);
  g.add(bulk);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.92), wallMat);
    wall.position.set(side * (w * 0.5), -0.04, 0.08);
    g.add(wall);
    const console = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.48), wallMat);
    console.position.set(side * (w * 0.4), -0.18, 0.08);
    g.add(console);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.78), wallMat);
    sill.position.set(side * (w * 0.44), -0.02, 0.02);
    g.add(sill);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.28), seatMat);
  seat.position.set(0, -0.32, 0.36);
  g.add(seat);

  const coaming = { y: 0.02, z: -0.3 };
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.9, 0.034, 0.08),
    type === 'stuka' ? seatMat : wallMat,
  );
  pad.position.set(0, coaming.y, coaming.z);
  g.add(pad);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 0.3, 0.04), dashMat);
  panel.position.set(0, -0.16, -0.24);
  panel.rotation.x = -0.2;
  g.add(panel);

  const needles = [];
  const n = theme.gauges.length;
  const span = w * 0.7;
  theme.gauges.forEach((label, i) => {
    const gauge = makeGauge(label, theme.bezel);
    const t = n === 1 ? 0 : i / (n - 1);
    gauge.position.set(-span * 0.5 + t * span, -0.02, -0.27);
    gauge.rotation.x = -0.2;
    gauge.scale.setScalar(0.78);
    g.add(gauge);
    needles.push(gauge.userData.needle);
  });
  g.userData.needles = needles;

  const stick = makeStick(theme.stick);
  stick.position.set(0, -0.22, 0.14);
  stick.rotation.x = 0.28;
  g.add(stick);
  g.userData.stick = stick;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.016, 0.024), mats.metal);
  bar.position.set(0, -0.32, 0.0);
  g.add(bar);
  for (const side of [-1, 1]) {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.12), mats.darkMetal);
    pedal.position.set(side * 0.15, -0.32, -0.1);
    g.add(pedal);
  }
  const throttle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.018, 0.14, 8),
    type === 'stuka' ? new THREE.MeshBasicMaterial({ color: 0xc4a24a }) : mats.darkMetal,
  );
  throttle.position.set(-w * 0.38, -0.14, 0.0);
  throttle.rotation.z = 0.45;
  g.add(throttle);
  if (type === 'bf109') {
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.048, 0.42, 10), mats.darkMetal);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, -0.28, 0.02);
    g.add(cannon);
  }
  if (type === 'stuka') {
    const dive = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.03), new THREE.MeshBasicMaterial({ color: 0xc4a24a }));
    dive.position.set(w * 0.36, -0.14, 0.0);
    g.add(dive);
    const stuvi = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.06, 10), new THREE.MeshBasicMaterial({ color: 0x1c2024 }));
    stuvi.position.set(0, -0.08, -0.22);
    stuvi.rotation.x = 0.85;
    g.add(stuvi);
  }
  if (type === 'spitfire') {
    const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 16), mats.brass);
    compass.position.set(0, -0.3, -0.1);
    g.add(compass);
  }
  addWindscreen(g, type, w, theme.pit);
  addGunsight(g, theme.sight || sightFor(type), coaming);
  g.visible = false;
  g.userData.guns = guns;
  g.userData.theme = theme;
  return g;
}

function add(parent, geom, material, pos, rot) {
  const m = new THREE.Mesh(geom, material);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function makeAircraft({ enemy = false, team = null, scale = 1, type = 'spitfire', paint = null, gear = false } = {}) {
  const gearDown = Boolean(gear);
  const spec = typeSpec(type, enemy);
  if (paint?.color != null) spec.color = paint.color;
  if (paint?.wing != null) spec.wing = paint.wing;
  const plane = planeById(type);
  const root = new THREE.Group();
  root.scale.setScalar(scale * (type === 'stuka' ? 1.02 : type === 'zero' || type === 'oscar' ? 0.96 : 1));
  root.rotation.order = 'YXZ';
  const german = Boolean(spec.axis) || (enemy && team == null && (type === 'bf109' || type === 'stuka' || type === 'zero' || type === 'oscar'));
  spec.axis = german || spec.axis;
  const fuseMat = skinMat(spec.color, spec.map, { roughness: spec.roughness ?? 0.46, metalness: spec.metalness ?? 0.28 });
  const wingMat = skinMat(spec.wing, spec.map, {
    roughness: spec.roughness ?? 0.5,
    metalness: spec.metalness ?? 0.24,
    vertexColors: true,
  });
  const shell = new THREE.Group();
  root.add(shell);

  const fuselage = add(shell, fuseGeometry(spec.fuse), fuseMat);
  fuselage.scale.y = spec.oval || 0.88;

  const noseZ = spec.fuse[0][0];
  const tailZ = spec.fuse[spec.fuse.length - 1][0];
  if (spec.yellowNose) {
    const band = add(shell, new THREE.CylinderGeometry(0.47, 0.5, 0.62, 20), mat(0xc4a24a, 0.42, 0.32), [0, 0.02, noseZ + 0.85], [Math.PI / 2, 0, 0]);
    band.scale.z = spec.oval || 0.88;
  }
  if (spec.radial) {
    add(shell, new THREE.TorusGeometry(0.5, 0.035, 8, 22), mats.darkMetal, [0, 0.02, noseZ + 0.55], [Math.PI / 2, 0, 0]);
  }

  if (spec.shark) {
    for (const side of [-1, 1]) {
      addDecal(shell, sharkTex, [side * 0.36, -0.04, noseZ + 0.95], [0, side * 1.25, 0], 0.7);
    }
  }

  add(shell, makeWingGeometry(spec), wingMat, [0, spec.wingY, spec.wingZ]);
  addMarkings(shell, spec);

  const stab = Object.assign({}, spec, {
    halfSpan: spec.halfSpan * 0.28,
    rootC: spec.rootC * 0.55,
    tipC: spec.tipC * 0.45,
    thick: spec.thick * 0.85,
    elliptical: false,
    gull: false,
    dihedral: 0.04,
    sweep: 0.18,
  });
  add(shell, makeWingGeometry(stab), wingMat, [0, 0.12, tailZ - 0.55]);

  const fin = add(shell, finGeometry(spec.fin), fuseMat, [0, 0.12, tailZ - 0.95]);
  const mast = add(shell, new THREE.CylinderGeometry(0.012, 0.01, 0.85, 6), mats.darkMetal, [0, 1.05, tailZ - 1.05]);
  mast.rotation.z = 0.08;

  const guns = [];
  const layout = gunLayout(type);
  if (layout.cowl) {
    for (const side of [-1, 1]) {
      guns.push(
        add(
          shell,
          new THREE.CylinderGeometry(0.02, 0.014, 0.82, 8),
          mats.gun,
          [side * layout.cowl, 0.18, noseZ + 0.92],
          [Math.PI / 2, 0, 0],
        ),
      );
    }
  }
  for (const s of layout.wing || []) {
    const pt = wingPoint(spec, s, 0.05);
    for (const side of [-1, 1]) {
      guns.push(
        add(
          shell,
          new THREE.CylinderGeometry(0.026, 0.02, 1.05, 8),
          mats.gun,
          [side * pt.span, spec.wingY + pt.y - 0.02, spec.wingZ + pt.z - 0.38],
          [Math.PI / 2, 0, 0],
        ),
      );
    }
  }

  if (spec.scoop) {
    add(shell, new THREE.BoxGeometry(0.62, 0.22, 1.35), mats.darkMetal, [0, -0.48, 0.55]);
  } else if (!spec.radial) {
    add(shell, new THREE.BoxGeometry(0.5, 0.16, 0.72), mats.darkMetal, [0, -0.32, spec.wingZ + 0.15]);
  }

  for (const side of [-1, 1]) {
    add(shell, new THREE.BoxGeometry(0.08, 0.07, 0.42), mats.darkMetal, [side * 0.38, 0.04, noseZ + 1.15]);
  }

  const undercart = new THREE.Group();
  undercart.name = 'gear';
  const gearLen = spec.gearLen || 1.08;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, gearLen, 8), mats.darkMetal);
    strut.position.y = -gearLen * 0.5;
    strut.castShadow = true;
    leg.add(strut);
    if (spec.spats) {
      const pant = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), fuseMat);
      pant.scale.set(0.62, 1.12, 1.5);
      pant.position.y = -gearLen + 0.02;
      pant.castShadow = true;
      leg.add(pant);
    }
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.065, 8, 16), mats.rubber);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.y = -gearLen;
    wheel.castShadow = true;
    leg.add(wheel);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.48), fuseMat);
    door.position.set(side * 0.08, -0.32, 0.02);
    door.rotation.z = side * 0.18;
    door.castShadow = true;
    if (!spec.fixedGear) leg.add(door);
    leg.position.set(side * spec.gearX, spec.wingY - 0.02, spec.gearZ);
    leg.rotation.z = side * (spec.gearSplay || 0.1);
    undercart.add(leg);
  }
  const tailWheel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 12), mats.rubber);
  tailWheel.rotation.y = Math.PI / 2;
  tailWheel.position.set(0, -0.22, tailZ - 0.35);
  undercart.add(tailWheel);
  shell.add(undercart);

  const prop = new THREE.Group();
  prop.position.set(0, 0.02, noseZ - 0.02);
  shell.add(prop);
  const spinner = new THREE.Mesh(
    new THREE.SphereGeometry(spec.radial ? 0.22 : 0.18, 14, 12),
    new THREE.MeshStandardMaterial({ color: spec.spinner || 0xc4a24a, roughness: 0.28, metalness: 0.62, envMapIntensity: 1.1 }),
  );
  spinner.scale.set(1, 1, spec.radial ? 1.15 : 1.35);
  prop.add(spinner);
  const bladeGeom = bladeGeometry(spec.radial ? 1.72 : 1.58);
  const blades = spec.blades || plane.blades || 3;
  for (let i = 0; i < blades; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = (i / blades) * Math.PI * 2;
    const blade = new THREE.Mesh(bladeGeom, mats.darkMetal);
    blade.castShadow = false;
    holder.add(blade);
    prop.add(holder);
  }
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(spec.radial ? 1.68 : 1.52, 40),
    new THREE.MeshBasicMaterial({
      color: 0x1a1e22,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  disk.position.copy(prop.position);
  disk.renderOrder = 2;
  shell.add(disk);

  const canopyY = spec.canopyY || 0.4;
  const canopyZ = spec.canopyZ || 0.12;
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(spec.bubble ? 0.44 : 0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    mats.glass,
  );
  canopy.scale.set(spec.bubble ? 1.08 : 0.98, spec.bubble ? 0.92 : 0.8, spec.canopyLen || (spec.bubble ? 1.62 : 1.38));
  canopy.position.set(0, canopyY, canopyZ);
  canopy.castShadow = false;
  shell.add(canopy);
  for (const zOff of spec.bubble ? [-0.28, 0.08, 0.38] : [-0.22, 0.06, 0.3]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.011, 6, 18, Math.PI), mats.darkMetal);
    rib.rotation.x = Math.PI / 2;
    rib.scale.set(spec.bubble ? 1.05 : 0.92, spec.bubble ? 0.72 : 0.6, 1);
    rib.position.set(0, canopyY + 0.02, canopyZ + zOff);
    shell.add(rib);
  }
  for (const side of [-1, 1]) {
    add(shell, new THREE.BoxGeometry(0.03, 0.03, spec.bubble ? 1.28 : 1.02), mats.darkMetal, [side * 0.24, canopyY - 0.08, canopyZ]);
  }

  const pilot = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0x2a2620));
  head.position.set(0, canopyY + 0.04, canopyZ + 0.06);
  pilot.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8, 0, Math.PI * 2, 0, 1.2), mat(german ? 0x3a4a32 : 0x3a4038));
  helmet.position.set(0, canopyY + 0.06, canopyZ + 0.06);
  pilot.add(helmet);
  shell.add(pilot);

  const cockpit = makeCockpitInterior(type);
  root.add(cockpit);

  const setGear = (down) => {
    const show = Boolean(spec.fixedGear || down);
    undercart.visible = show;
    disk.visible = !show;
  };
  setGear(gearDown);

  root.userData.prop = prop;
  root.userData.propDisk = disk;
  root.userData.pilot = pilot;
  root.userData.cockpit = cockpit;
  root.userData.guns = guns;
  root.userData.hideInCockpit = [shell];
  root.userData.shell = shell;
  root.userData.type = type;
  root.userData.setGear = setGear;
  root.userData.cockpitCam = { ...(cockpit.userData.theme?.cam || COCKPIT_CAM) };
  return root;
}
