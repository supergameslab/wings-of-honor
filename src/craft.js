import * as THREE from 'three';
import { PLANES, planeById, isCraftUnlocked, cockpitGuns, COCKPIT_SIGHT, COCKPIT_CAM } from './sim/planes.js';

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
  t.anisotropy = 4;
  return t;
}

const rivetMap = canvasTex((x, W) => {
  x.fillStyle = '#8a9088';
  x.fillRect(0, 0, W, W);
  x.fillStyle = 'rgba(20,24,22,0.18)';
  for (let y = 8; y < W; y += 16) {
    x.fillRect(0, y, W, 1);
    for (let px = 6; px < W; px += 14) {
      x.beginPath();
      x.arc(px + ((y / 16) % 2) * 7, y, 1.1, 0, Math.PI * 2);
      x.fill();
    }
  }
  x.fillStyle = 'rgba(255,255,250,0.08)';
  for (let i = 0; i < 40; i++) x.fillRect((i * 19) % W, 0, 1, W);
}, 256, 3, 2);

const camoMap = canvasTex((x, W) => {
  x.fillStyle = '#3d4a32';
  x.fillRect(0, 0, W, W);
  x.fillStyle = '#6a5340';
  for (let i = 0; i < 18; i++) {
    x.beginPath();
    x.ellipse((i * 47) % W, (i * 73) % W, 28 + (i % 5) * 8, 16 + (i % 4) * 6, i, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = '#2a3426';
  for (let i = 0; i < 10; i++) {
    x.beginPath();
    x.ellipse((i * 61 + 20) % W, (i * 41) % W, 18, 12, i * 0.4, 0, Math.PI * 2);
    x.fill();
  }
}, 256, 2, 2);

const desertMap = canvasTex((x, W) => {
  x.fillStyle = '#c4a46a';
  x.fillRect(0, 0, W, W);
  x.fillStyle = '#8a6a40';
  for (let i = 0; i < 14; i++) {
    x.beginPath();
    x.ellipse((i * 53) % W, (i * 71) % W, 30, 14, i, 0, Math.PI * 2);
    x.fill();
  }
}, 256, 2, 2);

const mats = {
  metal: new THREE.MeshStandardMaterial({ color: 0x6a706c, map: rivetMap, roughness: 0.42, metalness: 0.62, envMapIntensity: 0.7 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a3034, roughness: 0.4, metalness: 0.7, envMapIntensity: 0.65 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb68c4a, roughness: 0.38, metalness: 0.62, envMapIntensity: 0.7 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x202326, roughness: 0.95, metalness: 0.05 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xcfe4ee, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.28, envMapIntensity: 0.9 }),
  gun: new THREE.MeshStandardMaterial({ color: 0x252c30, roughness: 0.36, metalness: 0.7 }),
  leather: new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.78, metalness: 0.02 }),
  dash: new THREE.MeshStandardMaterial({ color: 0x1c2226, roughness: 0.55, metalness: 0.25 }),
};

const mat = (color, roughness = 0.55, metalness = 0.35) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: metalness > 0.2 ? 0.7 : 0.22 });

function typeSpec(type, enemy) {
  if (type === 'p40') {
    return {
      fuse: [0.34, 0.46, 5.4],
      wingY: 0.02,
      wingZ: -0.15,
      wingW: 9.4,
      wingT: 0.14,
      wingC: 1.7,
      color: 0x5a6a3a,
      wing: 0x6a5340,
      nose: 0.48,
      blades: 3,
      scoop: false,
      shark: true,
      map: desertMap,
      spinner: 0xc45a28,
    };
  }
  if (type === 'mustang') {
    return {
      fuse: [0.32, 0.44, 5.6],
      wingY: 0.0,
      wingZ: 0.05,
      wingW: 9.6,
      wingT: 0.12,
      wingC: 1.65,
      color: 0x8a9084,
      wing: 0x6a7068,
      nose: 0.44,
      blades: 4,
      scoop: true,
      map: rivetMap,
      spinner: 0xc4a24a,
    };
  }
  if (type === 'bf109') {
    return {
      fuse: [0.3, 0.4, 5.05],
      wingY: 0.04,
      wingZ: -0.05,
      wingW: 8.2,
      wingT: 0.12,
      wingC: 1.45,
      color: enemy ? 0x6a7460 : 0x7a8068,
      wing: 0x4a5340,
      nose: 0.42,
      blades: 3,
      axis: true,
      yellowNose: true,
      map: camoMap,
      spinner: 0xc4a24a,
    };
  }
  if (type === 'hellcat') {
    return {
      fuse: [0.4, 0.52, 5.5],
      wingY: 0.08,
      wingZ: 0.0,
      wingW: 10.4,
      wingT: 0.18,
      wingC: 1.95,
      color: 0x2a3a52,
      wing: 0x243448,
      nose: 0.52,
      blades: 3,
      chunky: true,
      map: rivetMap,
      spinner: 0xc8c4b0,
    };
  }
  if (type === 'stuka') {
    return {
      fuse: [0.32, 0.46, 5.2],
      wingY: 0.22,
      wingZ: -0.1,
      wingW: 10.6,
      wingT: 0.16,
      wingC: 1.8,
      color: 0x5a6248,
      wing: 0x4a5238,
      nose: 0.4,
      blades: 3,
      axis: true,
      gull: true,
      fixedGear: true,
      yellowNose: true,
      map: camoMap,
      spinner: 0xc4a24a,
    };
  }
  if (type === 'zero') {
    return {
      fuse: [0.3, 0.4, 5.0],
      wingY: 0.02,
      wingZ: 0.0,
      wingW: 9.8,
      wingT: 0.11,
      wingC: 1.7,
      color: 0x6a7a48,
      wing: 0x5a6a3a,
      nose: 0.4,
      blades: 3,
      axis: true,
      hinomaru: true,
      map: camoMap,
      spinner: 0xc4b060,
    };
  }
  return {
    fuse: [0.32, 0.44, 5.25],
    wingY: 0.02,
    wingZ: -0.08,
    wingW: 9.2,
    wingT: 0.11,
    wingC: 1.72,
    color: enemy ? 0x5a6248 : 0x4a5840,
    wing: enemy ? 0x6a5340 : 0x3d4a32,
    nose: 0.44,
    blades: 3,
    elliptical: true,
    map: camoMap,
    spinner: 0xc8c4b0,
  };
}

function mark(root, spec, side, y, z) {
  if (spec.hinomaru) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.28, 18), mat(0xb43028));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(side * 2.2, y + 0.08, z);
    root.add(disc);
    return;
  }
  if (spec.axis) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.02, 0.55), mat(0xe8e2d4));
    plate.position.set(side * 2.1, y + 0.08, z);
    root.add(plate);
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.12), mat(0x1a1a1a));
    cross.position.set(side * 2.1, y + 0.1, z);
    root.add(cross);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.42), mat(0x1a1a1a));
    cross2.position.set(side * 2.1, y + 0.1, z);
    root.add(cross2);
    return;
  }
  const rings = [
    [0.28, 0xd8d7c9],
    [0.19, 0x344e70],
    [0.09, 0x9c4031],
  ];
  rings.forEach(([r, color], i) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 18), mat(color));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(side * 2.2, y + 0.075 + i * 0.006, z);
    root.add(disc);
  });
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

function makeCockpitInterior(type = 'spitfire') {
  const guns = cockpitGuns(type);
  const spec = typeSpec(type, false);
  const g = new THREE.Group();
  g.name = 'cockpit';
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.035, 0.95), mats.darkMetal);
  floor.position.set(0, -0.2, 0.06);
  floor.receiveShadow = true;
  g.add(floor);
  const bulk = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.42, 0.07), mats.darkMetal);
  bulk.position.set(0, 0.02, 0.5);
  g.add(bulk);
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.9), mats.darkMetal);
    wall.position.set(side * 0.5, -0.02, 0.04);
    g.add(wall);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.28), mats.leather);
  seat.position.set(0, -0.14, 0.22);
  g.add(seat);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.2, 0.38), mats.dash);
  dash.position.set(0, 0.0, -0.26);
  dash.rotation.x = -0.46;
  dash.receiveShadow = true;
  g.add(dash);
  const labels = ['ALT', 'RPM', 'ASI', 'FUEL'];
  const needles = [];
  labels.forEach((label, i) => {
    const gauge = makeGauge(label);
    gauge.position.set([-0.42, -0.26, 0.26, 0.42][i], 0.1, -0.38);
    gauge.rotation.x = -0.55;
    gauge.scale.setScalar(1.18);
    g.add(gauge);
    needles.push(gauge.userData.needle);
  });
  g.userData.needles = needles;
  const stick = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.02, 0.4, 8), mats.darkMetal);
  shaft.position.set(0, 0.08, 0);
  stick.add(shaft);
  const grip = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), mats.leather);
  grip.position.set(0, 0.28, 0.01);
  stick.add(grip);
  stick.position.set(0, -0.16, 0.1);
  stick.rotation.x = 0.42;
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
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mats.glass);
  glass.position.set(COCKPIT_SIGHT.x, COCKPIT_SIGHT.y, COCKPIT_SIGHT.z);
  g.add(glass);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.006, 8, 24), mats.darkMetal);
  ring.position.set(COCKPIT_SIGHT.x, COCKPIT_SIGHT.y, COCKPIT_SIGHT.z);
  g.add(ring);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), spec.axis ? mats.metal : mats.brass);
  bead.position.set(COCKPIT_SIGHT.x, COCKPIT_SIGHT.y, COCKPIT_SIGHT.z);
  g.add(bead);
  g.visible = false;
  g.userData.guns = guns;
  return g;
}

function addWing(shell, spec, y, z, w, chord, tilt = 0) {
  const wingMat = Object.assign(mat(spec.wing, 0.62, 0.28), spec.map ? { map: spec.map } : {});
  const wing = new THREE.Mesh(new THREE.BoxGeometry(w, spec.wingT, chord), wingMat);
  wing.position.set(0, y, z);
  wing.rotation.z = tilt;
  wing.castShadow = true;
  shell.add(wing);
  if (spec.elliptical) {
    const tipL = new THREE.Mesh(new THREE.SphereGeometry(chord * 0.42, 10, 8), wingMat);
    tipL.scale.set(0.55, 0.18, 1);
    tipL.position.set(-w * 0.48, y, z);
    shell.add(tipL);
    const tipR = tipL.clone();
    tipR.position.x = w * 0.48;
    shell.add(tipR);
  }
  for (const side of [-1, 1]) mark(shell, spec, side, y, z);
  return wing;
}

export function makeAircraft({ enemy = false, team = null, scale = 1, type = 'spitfire', paint = null } = {}) {
  const spec = typeSpec(type, enemy);
  if (paint?.color != null) spec.color = paint.color;
  if (paint?.wing != null) spec.wing = paint.wing;
  const plane = planeById(type);
  const root = new THREE.Group();
  root.scale.setScalar(scale * (type === 'stuka' ? 1.04 : type === 'zero' ? 0.94 : 1));
  root.rotation.order = 'YXZ';
  const fuseMat = Object.assign(mat(spec.color, 0.52, 0.4), spec.map ? { map: spec.map } : {});
  const german = Boolean(spec.axis) || (enemy && team == null && (type === 'bf109' || type === 'stuka' || type === 'zero'));
  spec.axis = german || spec.axis;
  const shell = new THREE.Group();
  root.add(shell);
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(spec.fuse[0], spec.fuse[1], spec.fuse[2], 14), fuseMat);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.castShadow = true;
  shell.add(fuselage);
  const noseCol = spec.yellowNose ? mat(0xc4a24a, 0.45, 0.35) : mats.darkMetal;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(spec.nose * 0.72, spec.nose, 0.95, 16), noseCol);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -spec.fuse[2] * 0.48;
  shell.add(nose);
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.55), mats.darkMetal);
  intake.position.set(0, -0.28, -spec.fuse[2] * 0.38);
  shell.add(intake);
  if (spec.shark) {
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.7), mat(0xe8e0cf, 0.7, 0.05));
    jaw.position.set(0, -0.12, -spec.fuse[2] * 0.5);
    shell.add(jaw);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), mat(0x1a1a1a));
      eye.position.set(side * 0.28, 0.08, -spec.fuse[2] * 0.52);
      eye.rotation.y = side * 0.6;
      shell.add(eye);
    }
  }
  if (spec.scoop) {
    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 1.15), mats.darkMetal);
    scoop.position.set(0, -0.42, 0.35);
    shell.add(scoop);
  }
  if (spec.gull) {
    addWing(shell, spec, spec.wingY + 0.18, spec.wingZ, spec.wingW * 0.55, spec.wingC, 0);
    addWing(shell, spec, spec.wingY - 0.12, spec.wingZ + 0.08, spec.wingW, spec.wingC * 0.85, 0.12);
  } else {
    addWing(shell, spec, spec.wingY, spec.wingZ, spec.wingW, spec.wingC);
  }
  const guns = [];
  const gunCount = Math.min(4, plane.guns || 2);
  const span = spec.wingW * 0.32;
  for (let i = 0; i < gunCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const out = 0.9 + Math.floor(i / 2) * 0.7;
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), mats.gun);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(side * (span * 0.35 + out), spec.wingY + 0.02, spec.wingZ - spec.wingC * 0.42);
    shell.add(gun);
    guns.push(gun);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(german ? 2.6 : 2.4, 0.07, 0.95), Object.assign(mat(spec.wing, 0.62, 0.28), spec.map ? { map: spec.map } : {}));
  tail.position.set(0, 0.08, spec.fuse[2] * 0.46);
  shell.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, spec.chunky ? 0.95 : 0.82, 0.85), fuseMat);
  fin.position.set(0, 0.48, spec.fuse[2] * 0.44);
  shell.add(fin);
  if (spec.fixedGear) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 6), mats.darkMetal);
      leg.position.set(side * 1.15, -0.55, 0.15);
      leg.rotation.z = side * 0.18;
      shell.add(leg);
      const pant = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fuseMat);
      pant.scale.set(0.7, 1.1, 1.4);
      pant.position.set(side * 1.25, -1.05, 0.2);
      shell.add(pant);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 8, 14), mats.rubber);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(side * 1.25, -1.08, 0.2);
      shell.add(wheel);
    }
  } else {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), mats.darkMetal);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, -0.62, 0.55);
    shell.add(axle);
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 14), mats.rubber);
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(side * 0.72, -0.66, 0.55);
      shell.add(wheel);
    }
  }
  const tailWheel = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 6, 10), mats.rubber);
  tailWheel.rotation.y = Math.PI / 2;
  tailWheel.position.set(0, -0.28, spec.fuse[2] * 0.46);
  shell.add(tailWheel);
  const prop = new THREE.Group();
  prop.position.set(0, 0, -spec.fuse[2] * 0.62);
  shell.add(prop);
  prop.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: spec.spinner || 0xc4a24a, roughness: 0.35, metalness: 0.55 })));
  const blades = spec.blades || plane.blades || 3;
  for (let i = 0; i < blades; i++) {
    const holder = new THREE.Group();
    holder.rotation.z = (i / blades) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.55, 0.05), mats.darkMetal);
    blade.position.set(0, 0.72, 0);
    blade.rotation.z = -0.12;
    holder.add(blade);
    prop.add(holder);
  }
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.glass);
  canopy.position.set(0, 0.42, 0.12);
  canopy.scale.set(1.05, 0.85, 1.35);
  shell.add(canopy);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 1.05), mats.darkMetal);
  rail.position.set(0.22, 0.38, 0.08);
  shell.add(rail);
  const rail2 = rail.clone();
  rail2.position.x = -0.22;
  shell.add(rail2);
  const pilot = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat(0x2a2620));
  head.position.set(0, 0.52, 0.18);
  pilot.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 8, 0, Math.PI * 2, 0, 1.2), mat(german ? 0x3a4a32 : 0x3a4038));
  helmet.position.set(0, 0.54, 0.18);
  pilot.add(helmet);
  shell.add(pilot);
  const cockpit = makeCockpitInterior(type);
  root.add(cockpit);
  root.userData.prop = prop;
  root.userData.pilot = pilot;
  root.userData.cockpit = cockpit;
  root.userData.guns = guns;
  root.userData.hideInCockpit = [shell];
  root.userData.shell = shell;
  root.userData.type = type;
  root.userData.cockpitCam = { ...COCKPIT_CAM };
  return root;
}
