import * as THREE from 'three';
import { PLANES, planeById, isCraftUnlocked, cockpitGuns, COCKPIT_SIGHT, COCKPIT_CAM, gunLayout, sightFor } from './sim/planes.js';

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

function makeGauge(label) {
  const g = new THREE.Group();
  const brassLite = new THREE.MeshBasicMaterial({ color: 0xc4a06a });
  const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.018, 22), brassLite);
  bezel.rotation.x = Math.PI / 2;
  g.add(bezel);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.05, 22), new THREE.MeshBasicMaterial({ map: gaugeFace(label) }));
  face.position.z = 0.01;
  g.add(face);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.04, 0.003), brassLite);
  needle.position.set(0, 0.012, 0.012);
  g.add(needle);
  g.userData.needle = needle;
  return g;
}

function pitTheme(type) {
  const themes = {
    spitfire: {
      pit: 0x4a5348,
      dash: 0x1c1e1a,
      leather: 0x6a4030,
      gauges: ['ASI', 'ALT', 'RPM', 'BOOST'],
      stick: 'spade',
      sight: 'aldis',
      width: 0.94,
      cam: { x: 0, y: 0.34, z: 0.16 },
    },
    p40: {
      pit: 0x3a5a3c,
      dash: 0x22261e,
      leather: 0x4a3224,
      gauges: ['ASI', 'ALT', 'RPM', 'FUEL'],
      stick: 'us',
      sight: 'n9',
      width: 0.96,
      cam: { x: 0, y: 0.33, z: 0.18 },
    },
    mustang: {
      pit: 0x3c4a3c,
      dash: 0x141618,
      leather: 0x3a281c,
      gauges: ['ASI', 'ALT', 'RPM', 'MP'],
      stick: 'us',
      sight: 'n9',
      width: 1.0,
      cam: { x: 0, y: 0.36, z: 0.2 },
    },
    hellcat: {
      pit: 0x2a3a32,
      dash: 0x121416,
      leather: 0x2e241c,
      gauges: ['ASI', 'ALT', 'RPM', 'FUEL'],
      stick: 'us',
      sight: 'n9',
      width: 1.05,
      cam: { x: 0, y: 0.35, z: 0.18 },
    },
    stuka: {
      pit: 0x5a6248,
      dash: 0x2a2c24,
      leather: 0x8a6a38,
      gauges: ['FAHRT', 'HOEHE', 'DREZ', 'KRAFT'],
      stick: 'german',
      sight: 'revi',
      width: 1.02,
      cam: { x: 0, y: 0.38, z: 0.22 },
    },
    bf109: {
      pit: 0x3a403c,
      dash: 0x1a1c1a,
      leather: 0x4a3828,
      gauges: ['FAHRT', 'HOEHE', 'DREZ', 'BOOST'],
      stick: 'german',
      sight: 'revi',
      width: 0.82,
      cam: { x: 0, y: 0.3, z: 0.22 },
    },
    zero: {
      pit: 0x6a7a50,
      dash: 0x2c2a22,
      leather: 0x5a4030,
      gauges: ['ASI', 'ALT', 'RPM', 'OIL'],
      stick: 'ijn',
      sight: 'type99',
      width: 0.9,
      cam: { x: 0, y: 0.32, z: 0.18 },
    },
    oscar: {
      pit: 0x74805a,
      dash: 0x2a281e,
      leather: 0x6a4a32,
      gauges: ['ASI', 'ALT', 'RPM', 'OIL'],
      stick: 'ijn',
      sight: 'type99',
      width: 0.88,
      cam: { x: 0, y: 0.32, z: 0.18 },
    },
  };
  return themes[type] || themes.spitfire;
}

function addGunsight(g, kind, pos) {
  const x = pos.x;
  const y = pos.y;
  const z = pos.z;
  if (kind === 'revi') {
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), mats.darkMetal);
    house.position.set(x, y - 0.04, z + 0.08);
    g.add(house);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.09), mats.glass);
    glass.position.set(x, y + 0.02, z);
    g.add(glass);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), mat(0xf0c45a, 0.3, 0.2));
    bead.position.set(x, y + 0.01, z - 0.01);
    g.add(bead);
    return;
  }
  if (kind === 'n9') {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.12, 8), mats.darkMetal);
    post.position.set(x, y - 0.08, z + 0.06);
    g.add(post);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.006, 8, 24), mats.metal);
    ring.position.set(x, y, z);
    g.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), mats.glass);
    glass.position.set(x, y, z);
    g.add(glass);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), mats.brass);
    bead.position.set(x, y, z - 0.01);
    g.add(bead);
    return;
  }
  if (kind === 'type99') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.22, 10), mats.darkMetal);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(x, y - 0.02, z + 0.06);
    g.add(tube);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.005, 8, 18), mat(0xe8b86a, 0.4, 0.35));
    ring.position.set(x, y, z);
    g.add(ring);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), mat(0xe8b86a));
    bead.position.set(x, y, z);
    g.add(bead);
    return;
  }
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.09, 22), mats.glass);
  glass.position.set(x, y, z);
  g.add(glass);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 8, 24), mats.darkMetal);
  ring.position.set(x, y, z);
  g.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 6, 16), mats.brass);
  inner.position.set(x, y, z);
  g.add(inner);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), mats.brass);
  bead.position.set(x, y, z);
  g.add(bead);
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
  const pitMat = mat(theme.pit, 0.78, 0.08);
  const dashMat = mat(theme.dash, 0.62, 0.18);
  const seatMat = mat(theme.leather, 0.84, 0.04);
  const w = theme.width;
  const g = new THREE.Group();
  g.name = 'cockpit';
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.95), pitMat);
  floor.position.set(0, -0.2, 0.06);
  floor.receiveShadow = true;
  g.add(floor);
  const bulk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, 0.07), pitMat);
  bulk.position.set(0, 0.02, 0.5);
  g.add(bulk);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.9), pitMat);
    wall.position.set(side * (w * 0.5), -0.02, 0.04);
    g.add(wall);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.28), seatMat);
  seat.position.set(0, -0.14, 0.22);
  g.add(seat);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, type === 'bf109' ? 0.24 : 0.2, type === 'stuka' ? 0.44 : 0.38), dashMat);
  dash.position.set(0, type === 'bf109' ? 0.04 : 0.0, -0.26);
  dash.rotation.x = type === 'mustang' ? -0.38 : -0.46;
  dash.receiveShadow = true;
  g.add(dash);
  const needles = [];
  const xs = type === 'bf109' ? [-0.28, -0.1, 0.1, 0.28] : [-0.42, -0.26, 0.26, 0.42].map((v) => v * (w / 0.94));
  theme.gauges.forEach((label, i) => {
    const gauge = makeGauge(label);
    gauge.position.set(xs[i], type === 'bf109' ? 0.14 : 0.1, -0.38);
    gauge.rotation.x = -0.55;
    gauge.scale.setScalar(type === 'hellcat' ? 1.28 : 1.18);
    g.add(gauge);
    needles.push(gauge.userData.needle);
  });
  if (type === 'mustang' || type === 'hellcat') {
    ['OIL', 'TEMP'].forEach((label, i) => {
      const extra = makeGauge(label);
      extra.position.set([-0.12, 0.12][i], 0.02, -0.34);
      extra.rotation.x = -0.5;
      extra.scale.setScalar(0.82);
      g.add(extra);
      needles.push(extra.userData.needle);
    });
  }
  g.userData.needles = needles;
  const stick = makeStick(theme.stick);
  g.add(stick);
  g.userData.stick = stick;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.03), mats.metal);
  bar.position.set(0, -0.16, -0.06);
  g.add(bar);
  for (const side of [-1, 1]) {
    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.12), mats.darkMetal);
    pedal.position.set(side * 0.16, -0.15, -0.12);
    g.add(pedal);
  }
  const throttle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 8), type === 'stuka' ? mat(0xc4a24a) : mats.darkMetal);
  throttle.position.set(-w * 0.38, 0.02, -0.02);
  throttle.rotation.z = 0.4;
  g.add(throttle);
  if (type === 'bf109') {
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.55, 10), mats.darkMetal);
    cannon.rotation.x = Math.PI / 2;
    cannon.position.set(0, -0.08, -0.05);
    g.add(cannon);
  }
  if (type === 'stuka') {
    const dive = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), mat(0xc4a24a));
    dive.position.set(0.32, 0.02, 0.08);
    g.add(dive);
  }
  if (type === 'spitfire') {
    const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16), mats.brass);
    compass.position.set(0, -0.12, -0.18);
    g.add(compass);
  }
  addGunsight(g, theme.sight || sightFor(type), COCKPIT_SIGHT);
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
