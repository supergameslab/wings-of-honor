import * as THREE from 'three';
import {
  DIFFICULTY,
  MISSIONS,
  THEATERS,
  loadProgress,
  saveProgress,
  missionById,
  layoutFor,
  describeWin,
  weatherLabel,
  terrainLabel,
  theaterLabel,
  targetNoun,
  checkWin,
  statusLine,
  bombingMission,
  winFor,
  makeQuickSortie,
  isCampaignMission,
  makePrologue,
  starRating,
  nextCraftUnlock,
  nextAceMission,
  usesFuel,
} from './campaign.js';
import { createWorld } from './world.js';
import { FLIGHT, COMBAT, FUEL, clamp, damp, analogStick, integrateFlight, updateAi, createCraft, createAiCraft, forwardFromEuler, segmentHitsSphere, spawnBomb, stepBomb, predictLanding, predictBombImpact, bombHitsTarget, groundSpec, isStrafeable, isConvoy, stepConvoy, aaFireDir, aceById, acesFor, killScore, planeById, planeRatings, enemyCraftFor, stripOffset, homeNav, homeStripCenter, canCommitLand, shouldAutoLand, landRejectReason, stepLandMeter, landingCue, linedUp } from './sim/index.js';
import { drawVintageStaffMap, drawBriefingPhoto } from './briefingArt.js';
import { makeAircraft, CRAFTS, craftById, isCraftUnlocked } from './craft.js';
import { getSession, bootAuth, api as authApi } from './auth.js';
import { bootSocial, fillLobby } from './social.js';
import { bootTelemetry, track, trackBoot, flush, acceptAge, ageAccepted, telemetryAllowed, getAid, bindUser } from './telemetry.js';
import { MpSession } from './net/room.js';
import { apiPath } from './paths.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const radarCanvas = $('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');
const briefMap = $('brief-map');
const briefCtx = briefMap.getContext('2d');
const briefPhoto = $('brief-photo');
const briefPhotoCtx = briefPhoto?.getContext('2d');
const ui = {
  menu: $('menu'),
  hud: $('hud'),
  briefing: $('briefing-screen'),
  pause: $('pause-screen'),
  result: $('result-screen'),
  help: $('help-screen'),
  objective: $('objective'),
  status: $('statusline'),
  score: $('score'),
  alt: $('alt'),
  hull: $('hullbar'),
  bombs: $('bombs'),
  fuel: $('fuelbar'),
  fuelStat: $('fuel-stat'),
  landBtn: $('land-btn'),
  takeoffBtn: $('takeoff-btn'),
  landPrompt: $('land-prompt'),
  homeCompass: $('home-compass'),
  homeNeedle: $('home-needle'),
  homeRange: $('home-range'),
  radarLegend: $('radar-legend'),
  target: $('target-label'),
  targetMark: $('target-mark'),
  bombsight: $('bombsight'),
  bombsightLabel: $('bombsight-label'),
  toast: $('toast'),
  campaign: $('campaign-screen'),
  auth: $('auth-screen'),
  callsign: $('callsign-screen'),
  mess: $('mess-screen'),
  lobby: $('lobby-screen'),
  legal: $('legal-screen'),
  forfeit: $('forfeit-screen'),
  hangar: $('hangar-screen'),
  age: $('age-screen'),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9dbfce);
scene.fog = new THREE.FogExp2(0xc5d4dc, 0.0009);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.15, 9800);
const lowMem = (navigator.deviceMemory || 8) < 4 || window.top !== window.self;
let webglOk = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
let renderer;
try {
  if (!webglOk) throw new Error('no webgl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowMem, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowMem ? 1 : 1.65));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = !lowMem;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
} catch {
  webglOk = false;
  $('webgl-fail')?.classList.remove('hidden');
  renderer = {
    setPixelRatio() {},
    setSize() {},
    shadowMap: { enabled: false, type: 1 },
    outputColorSpace: '',
    toneMapping: 0,
    toneMappingExposure: 1,
    capabilities: { getMaxAnisotropy: () => 1 },
    render() {},
    domElement: canvas,
  };
}

const hemi = new THREE.HemisphereLight(0xd4e8f4, 0x6a6848, 1.65);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c0, 2.55);
sun.position.set(-140, 220, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xc8dcec, 0.38);
fill.position.set(110, 36, -90);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xd8e8f4, 0.18);
rim.position.set(-40, 18, 160);
scene.add(rim);

function weaveTexture() {
  const W = 64;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8c4b4';
  ctx.fillRect(0, 0, W, W);
  for (let i = 0; i < W; i += 2) {
    ctx.fillStyle = i % 4 === 0 ? 'rgba(70,65,50,0.1)' : 'rgba(255,252,240,0.08)';
    ctx.fillRect(0, i, W, 1);
    ctx.fillRect(i, 0, 1, W);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 4);
  t.anisotropy = 4;
  return t;
}
const weave = weaveTexture();
const mat = (color, roughness = 0.82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: metalness > 0.2 ? 0.85 : 0.22 });
const materials = {
  fabric: Object.assign(mat(0x7e8a6e, 0.86), { map: weave }),
  fabricLight: Object.assign(mat(0xb0b294, 0.84), { map: weave }),
  wood: mat(0x8b5d37, 0.9),
  darkWood: mat(0x392f27, 0.92),
  metal: mat(0x42494a, 0.38, 0.72),
  brass: mat(0xb68c4a, 0.38, 0.62),
  rubber: mat(0x202326, 0.95),
  glass: mat(0x8db8c7, 0.16, 0.28),
  red: mat(0x9c4031),
  enemy: Object.assign(mat(0x8b4437, 0.86), { map: weave }),
  enemyWing: Object.assign(mat(0xc1b9a0, 0.84), { map: weave }),
  gun: mat(0x252c30, 0.36, 0.7),
  white: mat(0xded6c0),
};

const world = createWorld(scene, { sun, hemi, renderer, fill, rim });
const progress = loadProgress();
if (!isCraftUnlocked(craftById(progress.craftId), progress)) progress.craftId = 'spitfire';
let currentMission = missionById(Math.min(progress.unlocked, MISSIONS.length));
let viewMode = localStorage.getItem('wings-honor-view') === 'cockpit' ? 'cockpit' : 'chase';

const cloudMat = new THREE.MeshLambertMaterial({
  color: 0xf3f6fa,
  transparent: true,
  opacity: 0.78,
  depthWrite: false,
  fog: false,
});
function makeCloud(x, y, z, s = 1) {
  const g = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(5.4 + Math.random() * 7.2, 10, 8), cloudMat);
    m.position.set((Math.random() - 0.5) * 36, Math.random() * 12, (Math.random() - 0.5) * 28);
    m.scale.set(1.25 + Math.random() * 0.55, 0.48 + Math.random() * 0.32, 1.1 + Math.random() * 0.4);
    g.add(m);
  }
  g.position.set(x, y, z);
  g.scale.setScalar(s);
  scene.add(g);
  return g;
}
const clouds = [];
for (let i = 0; i < 40; i++) {
  const low = i % 7 === 0;
  clouds.push(makeCloud((Math.random() - 0.5) * 1600, (low ? 70 : 110) + Math.random() * (low ? 40 : 160), (Math.random() - 0.5) * 1600, 0.7 + Math.random() * 1.35));
}

function makeGroundTarget(x, z, kind = 'depot') {
  const g = new THREE.Group();
  const waterCraft = kind === 'ship' || kind === 'gunboat' || kind === 'boat';
  const sampled = world.heightAt(x, z);
  const gy = waterCraft && sampled < -44 ? -45.2 : sampled;
  if (kind === 'boat') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 3.1), mat(0x4a453c, 0.7, 0.12));
    hull.position.y = 0.85;
    g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 2.4), mat(0x8a7a62));
    cabin.position.set(-1.2, 1.8, 0);
    g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.2, 6), mat(0x5a4632));
    mast.position.set(1.4, 3.4, 0);
    g.add(mast);
  } else if (kind === 'ship' || kind === 'gunboat') {
    const long = kind === 'gunboat' ? 22 : 16;
    const hull = new THREE.Mesh(new THREE.BoxGeometry(long, kind === 'gunboat' ? 3.2 : 2.2, kind === 'gunboat' ? 5.4 : 4.2), mat(0x3d4548, 0.5, 0.35));
    hull.position.y = kind === 'gunboat' ? 2 : 1.4;
    g.add(hull);
    const superstructure = new THREE.Mesh(new THREE.BoxGeometry(kind === 'gunboat' ? 8 : 5, 2.4, 3.2), mat(0x6d6558));
    superstructure.position.set(-2, kind === 'gunboat' ? 4.2 : 3.4, 0);
    g.add(superstructure);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 2.8, 8), materials.gun);
    stack.position.set(2.2, kind === 'gunboat' ? 5.4 : 4.2, 0);
    g.add(stack);
  } else if (kind === 'wireless') {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 2.4, 5), mat(0xcfc3a6));
    hut.position.y = 1.2;
    g.add(hut);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 18, 6), materials.metal);
    mast.position.y = 9;
    g.add(mast);
    const stay = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 0.12), materials.metal);
    stay.position.y = 16;
    g.add(stay);
  } else if (kind === 'camp') {
    for (let i = 0; i < 3; i++) {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 4), mat(0xbba36a));
      tent.position.set((i - 1) * 6.5, 1.7, (i % 2) * 3);
      g.add(tent);
    }
  } else if (kind === 'aa') {
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.8, 1.1, 10), mat(0x5a5346, 0.85, 0.2));
    pit.position.y = 0.55;
    g.add(pit);
    for (let i = 0; i < 6; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.9), mat(0x8a7a58));
      const a = (i / 6) * Math.PI * 2;
      bag.position.set(Math.cos(a) * 3.6, 0.85, Math.sin(a) * 3.6);
      bag.rotation.y = a;
      g.add(bag);
    }
    const mount = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.6), mat(0x3a3a36, 0.4, 0.5));
    mount.position.y = 1.4;
    g.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 4.4, 8), materials.gun);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.15, -2.1);
    const turret = new THREE.Group();
    turret.position.y = 2.05;
    turret.add(barrel);
    g.add(turret);
    g.userData.barrel = turret;
  } else if (kind === 'truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 2.6), mat(0x4a4e42, 0.7, 0.2));
    cab.position.set(-2.4, 1.7, 0);
    g.add(cab);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.5, 2.8), mat(0x6a5a3e, 0.85, 0.15));
    bed.position.set(1.6, 1.35, 0);
    g.add(bed);
    const tarp = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 2.5), mat(0x5c6848));
    tarp.position.set(1.6, 2.4, 0);
    g.add(tarp);
    for (const wx of [-2.6, 2.2]) {
      for (const wz of [-1.35, 1.35]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.38, 8), mat(0x1a1a18));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.55, wz);
        g.add(wheel);
      }
    }
  } else if (kind === 'troops') {
    const wagon = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.3, 2.2), mat(0x6b5a3c));
    wagon.position.set(-2.2, 1.1, 0);
    g.add(wagon);
    for (let i = 0; i < 7; i++) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.15, 0.38), mat(i % 2 ? 0x4a4e3a : 0x5a4632));
      body.position.set(-0.6 + (i % 4) * 1.05, 0.9, (i < 4 ? -1.3 : 1.3) + (i % 2) * 0.2);
      g.add(body);
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), mat(0xc4b48a));
      helm.position.set(body.position.x, 1.58, body.position.z);
      g.add(helm);
    }
  } else if (kind === 'trench') {
    const ditch = new THREE.Mesh(new THREE.BoxGeometry(22, 1.4, 5.5), mat(0x4a4030, 0.95, 0.08));
    ditch.position.y = 0.2;
    g.add(ditch);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(22, 0.85, 1.4), mat(0x6a5a40));
    parapet.position.set(0, 1.05, -2.4);
    g.add(parapet);
    for (let i = -3; i <= 3; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 1.1), mat(0x8a7a58));
      bag.position.set(i * 3.05, 1.45, -2.35);
      g.add(bag);
    }
    const nest = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 2.4), mat(0x5a5348));
    nest.position.set(-4.5, 1.5, 0.4);
    g.add(nest);
    const mg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), materials.gun);
    mg.rotation.x = Math.PI / 2;
    mg.position.set(-4.5, 2.1, -1.4);
    g.add(mg);
  } else {
    const base = new THREE.Mesh(new THREE.BoxGeometry(kind === 'hangar' ? 12 : 8, 2.5, kind === 'hangar' ? 10 : 7), mat(0x796b54));
    base.position.y = 1.25;
    g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(kind === 'hangar' ? 8 : 6, 2.4, 4), mat(0x57483b));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 3.6;
    g.add(roof);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.2, 8), materials.gun);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 3.4, -1);
    g.add(barrel);
  }
  g.position.set(x, gy, z);
  scene.add(g);
  const spec = groundSpec(kind);
  g.userData.health = spec.health;
  g.userData.kind = kind;
  return g;
}

function attachBombBeacon(g) {
  if (g.userData.beacon) return;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(8.2, 10.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xe8c15a, side: THREE.DoubleSide, transparent: true, opacity: 0.88, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.45;
  g.add(ring);
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 14),
    new THREE.MeshBasicMaterial({ color: 0xe8c15a, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  dot.rotation.x = -Math.PI / 2;
  dot.position.y = 0.48;
  g.add(dot);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.28, 22, 6),
    new THREE.MeshBasicMaterial({ color: 0xe8c15a, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  pole.position.y = 11;
  g.add(pole);
  g.userData.beacon = ring;
}

function makeHomeField(x, z) {
  const g = new THREE.Group();
  const stripZ = z + (FUEL.STRIP_OFFSET_Z ?? -36);
  const gy = world.heightAt(x, z);
  const stripGy = world.heightAt(x, stripZ);
  const halfW = FUEL.STRIP_HALF_W;
  const halfL = FUEL.STRIP_HALF_L;
  const apron = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 6, 0.16, halfL * 2 + 4), mat(0xc9b36a, 0.88, 0.04));
  apron.position.set(x, stripGy + 0.04, stripZ);
  g.add(apron);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 - 4, 0.24, halfL * 2 - 6), mat(0x6f6d60, 0.94, 0.05));
  strip.position.set(x, stripGy + 0.1, stripZ);
  strip.receiveShadow = true;
  g.add(strip);
  const chalk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, halfL * 2 - 18), mat(0xf4efe2, 0.92, 0.05));
  chalk.position.set(x, stripGy + 0.22, stripZ);
  g.add(chalk);
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.4, 0.3, 3.2), mat(0xf4efe2, 0.9, 0.05));
    bar.position.set(x, stripGy + 0.24, stripZ + end * (halfL - 10));
    g.add(bar);
  }
  for (const side of [-1, 1]) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(16, 6.2, 12), mat(0x8a7a58, 0.84, 0.08));
    shed.position.set(x + side * 22, gy + 3.1, z + 28);
    shed.castShadow = true;
    g.add(shed);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(18, 1.2, 14), mat(0x5a4030));
    roof.position.set(x + side * 22, gy + 6.6, z + 28);
    g.add(roof);
  }
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 6), mat(0xb94738));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(x + 10, gy + 5.4, z + 8);
  g.add(sock);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), mat(0x3a3228));
  pole.position.set(x + 8.4, gy + 3.2, z + 8);
  g.add(pole);
  const beacon = new THREE.Mesh(
    new THREE.TorusGeometry(11, 0.32, 8, 22),
    new THREE.MeshBasicMaterial({ color: 0xf0c45a, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  beacon.rotation.x = Math.PI / 2;
  beacon.position.set(x, stripGy + 18, stripZ);
  g.add(beacon);
  g.userData.beacon = beacon;
  scene.add(g);
  return { x, z, stripX: x, stripZ, heading: 0, halfW, halfL, group: g };
}

function overStrip() {
  if (!homeField || !player) return null;
  return stripOffset(
    player.position.x,
    player.position.z,
    player.position.y,
    flight.heading,
    homeField,
    (x, z) => world.heightAt(x, z),
  );
}

function tryLand(opts = {}) {
  if (!fuelJob || flight.grounded) return false;
  const o = overStrip();
  if (!canCommitLand(o, landMeter, Boolean(opts.forced || opts.auto))) {
    notify(landRejectReason(o));
    return false;
  }
  flight.grounded = true;
  flight.pitch = 0;
  flight.roll = 0;
  airspeed = 0;
  fuel = 1;
  sputtered = false;
  landMeter = 0;
  if (bombingMission(currentMission)) {
    bombsLeft = playerPlane.bombLoad || COMBAT.BOMB_LOAD;
    if (ui.bombs) ui.bombs.textContent = String(bombsLeft);
  }
  player.position.y = world.heightAt(player.position.x, player.position.z) + FLIGHT.GROUND_CLEARANCE;
  applyFlightPose();
  notify(victoryAt ? 'DOWN · SORTIE COMPLETE' : 'DOWN · TANKS FULL · T TO GO');
  if (victoryAt) maybeWin();
  return true;
}

function tryTakeoff() {
  if (!flight.grounded) return;
  const rotate = playerPlane.handling?.rotateAt || 38;
  if (airspeed < rotate * 0.82) {
    notify('BUILD UP SPEED');
    return;
  }
  flight.grounded = false;
  flight.pitch = 0.16;
  notify('UP YOU GO');
}

function setLandPrompt(cue) {
  if (!ui.landPrompt) return;
  if (!cue?.show) {
    ui.landPrompt.classList.add('hidden');
    ui.landPrompt.replaceChildren();
    return;
  }
  const main = document.createElement('strong');
  main.textContent = cue.prompt;
  const sub = document.createElement('small');
  sub.textContent = cue.sub || '';
  ui.landPrompt.replaceChildren(main, sub);
  ui.landPrompt.classList.remove('hidden');
}

function hideHomeAids() {
  ui.landPrompt?.classList.add('hidden');
  ui.homeCompass?.classList.add('hidden');
  if (ui.radarLegend) ui.radarLegend.textContent = 'RADAR';
}

function updateHomePrompt(dt) {
  const show = fuelJob && mode === 'playing';
  ui.fuelStat?.classList.toggle('hidden', !show);
  ui.landBtn?.classList.toggle('hidden', !show || flight.grounded);
  ui.takeoffBtn?.classList.toggle('hidden', !show || !flight.grounded);
  if (ui.radarLegend) ui.radarLegend.textContent = show ? 'RADAR · GOLD STRIP' : 'RADAR';
  if (!show) {
    hideHomeAids();
    return;
  }
  if (ui.fuel) {
    ui.fuel.style.width = `${Math.round(fuel * 100)}%`;
    ui.fuel.style.background = fuel < FUEL.LOW ? '#b94738' : '#d9ae61';
  }
  const nav = homeField && player ? homeNav(player.position.x, player.position.z, flight.heading, homeField) : null;
  if (flight.grounded) landMeter = 0;
  else {
    const o = overStrip();
    landMeter = stepLandMeter(landMeter, linedUp(o), dt);
    if (shouldAutoLand(o, landMeter)) tryLand({ auto: true });
  }
  const cue = landingCue({
    grounded: flight.grounded,
    airspeed,
    rotateAt: playerPlane.handling?.rotateAt || 38,
    offset: overStrip(),
    meter: landMeter,
    fuel,
    jobDone: Boolean(victoryAt),
    nav,
  });
  setLandPrompt(cue);
  ui.landBtn?.classList.toggle('ready', cue.landReady);
  ui.takeoffBtn?.classList.toggle('ready', cue.takeoffReady);
  const showCompass = Boolean(cue.showCompass && nav);
  ui.homeCompass?.classList.toggle('hidden', !showCompass);
  ui.homeCompass?.classList.toggle('low', fuel <= FUEL.LOW || Boolean(victoryAt));
  if (showCompass && ui.homeNeedle) ui.homeNeedle.style.transform = `rotate(${nav.rel * (180 / Math.PI)}deg)`;
  if (showCompass && ui.homeRange) ui.homeRange.textContent = `${Math.round(nav.dist)} · HOME`;
  const beacon = homeField?.group?.userData?.beacon;
  if (beacon?.material) {
    beacon.material.opacity = 0.42 + Math.sin(elapsed * 6) * 0.28;
    const pulse = fuel <= FUEL.LOW || victoryAt ? 1.12 + Math.sin(elapsed * 7) * 0.1 : 1;
    beacon.scale.setScalar(pulse);
  }
}

function makeWaypoint(x, y, z) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(7.5, 0.22, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xd6b36e, transparent: true, opacity: 0.85 }),
  );
  ring.position.set(x, y, z);
  scene.add(ring);
  return { mesh: ring, x, y, z, hit: false };
}
const RADAR_RANGE = 520;
const MAX_AGL = FLIGHT.MAX_AGL;
const ENEMY_MAX_ABOVE = FLIGHT.ENEMY_MAX_ABOVE;

let targets = [];
let waypoints = [];
let waypointHits = 0;
let player;
let enemies = [];
let pendingSpawns = [];
let homeField = null;
let fuel = 1;
let fuelJob = false;
let sputtered = false;
let landMeter = 0;
let bullets = [];
let bombs = [];
let particles = [];
let score = 0;
let kills = 0;
let depots = 0;
let hull = 100;
let lastPropHit = 0;
let playerMaxHull = 100;
let playerPlane = planeById('spitfire');
let mode = 'menu';
let lastShot = 0;
let lastBomb = 0;
let bombsLeft = COMBAT.BOMB_LOAD;
let airspeed = FLIGHT.BASE_SPEED;
let bombImpact = null;
let bombSightRig = null;
let radarFocus = null;
let elapsed = 0;
let ordersDoneAt = 0;
let victoryAt = 0;
let toastTimer = 0;
let quality = lowMem ? 'MED' : 'HIGH';
let firstInputTracked = false;
let firstKillTracked = false;
let firstShotTracked = false;
let sortieKindName = 'campaign';
let audioCtx = null;
let engineOsc = null;
let engineGain = null;
let audioMaster = null;
let engineFilter = null;
let engineComp = null;
let wantSound = false;
(function hushOrphanAudio() {
  const bag = window.__wingsHonorAudio;
  if (!Array.isArray(bag)) return;
  for (const ctx of bag) {
    try { ctx.suspend(); } catch {}
    try { ctx.close(); } catch {}
  }
  window.__wingsHonorAudio = [];
})();
const held = new Set();
const touchState = { x: 0, y: 0, fire: false };
const controls = { pitch: 0, turn: 0, fire: false, takeoff: false, land: false };
const flight = { heading: 0, pitch: 0, roll: 0 };
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const camOffset = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const camEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const camQuat = new THREE.Quaternion();
const _to = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _ef = new THREE.Vector3();
const _pf = new THREE.Vector3();
const _right = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _bprev = new THREE.Vector3();

function worldToRadar(dx, dz, heading) {
  const sh = Math.sin(heading);
  const ch = Math.cos(heading);
  const ahead = dx * -sh + dz * -ch;
  const right = dx * -ch + dz * sh;
  return { x: right, y: ahead };
}

function applyFlightPose() {
  player.rotation.order = 'YXZ';
  player.rotation.set(flight.pitch, flight.heading, -flight.roll);
  player.userData.setGear?.(flight.grounded);
}

function updateCockpit(speed = 62) {
  const pit = player?.userData.cockpit;
  if (!pit?.visible) return;
  const needles = pit.userData.needles || [];
  if (needles[0]) needles[0].rotation.z = -0.8 - (player.position.y / 260) * 2.4;
  if (needles[1]) needles[1].rotation.z = -1.1 - Math.abs(controls.pitch) * 0.5 - (speed - 50) * 0.012;
  if (needles[2]) needles[2].rotation.z = -0.4 - speed * 0.018;
  if (needles[3]) needles[3].rotation.z = -0.9;
  const stick = pit.userData.stick;
  if (stick) {
    stick.rotation.x = 0.42 - controls.pitch * 0.2;
    stick.rotation.z = controls.turn * 0.24;
  }
}

function releaseCamera() {
  if (camera.parent && camera.parent !== scene) {
    camera.parent.remove(camera);
    scene.add(camera);
  }
}

function setView(next = viewMode === 'cockpit' ? 'chase' : 'cockpit') {
  viewMode = next === 'cockpit' ? 'cockpit' : 'chase';
  localStorage.setItem('wings-honor-view', viewMode);
  const pit = viewMode === 'cockpit';
  if (player?.userData.pilot) player.userData.pilot.visible = !pit;
  if (player?.userData.cockpit) player.userData.cockpit.visible = pit;
  player?.userData.hideInCockpit?.forEach((m) => {
    m.visible = !pit;
  });
  player?.userData.guns?.forEach((m) => {
    m.visible = !pit;
  });
  $('reticle')?.classList.remove('hidden');
  const btn = $('view-btn');
  if (btn) btn.textContent = pit ? 'COCKPIT' : 'CHASE';
  if (pit && player) {
    player.add(camera);
    const cam = player.userData.cockpitCam || { x: 0, y: 0.32, z: 0.16 };
    camera.position.set(cam.x, cam.y, cam.z);
    camera.rotation.set(0, 0, 0);
    camera.fov = 70;
    camera.near = 0.06;
    if (!player.userData.pitLamp && player.userData.cockpit) {
      const lamp = new THREE.PointLight(0xffe1b0, 0.65, 2.6);
      lamp.position.set(0, 0.28, 0.04);
      player.userData.cockpit.add(lamp);
      player.userData.pitLamp = lamp;
    }
  } else {
    releaseCamera();
    camera.fov = 58;
    camera.near = 0.15;
  }
  camera.updateProjectionMatrix();
}

function chaseCamTarget(target) {
  const back = 19.5;
  target.set(
    player.position.x + Math.sin(flight.heading) * back,
    player.position.y + 5.2,
    player.position.z + Math.cos(flight.heading) * back,
  );
}

function snapChaseCamera() {
  if (!player) return;
  releaseCamera();
  chaseCamTarget(camOffset);
  camera.position.copy(camOffset);
  camEuler.set(clamp(flight.pitch * 0.72 - 0.14, -0.9, 0.42), flight.heading, -flight.roll * 0.18, 'YXZ');
  camera.quaternion.setFromEuler(camEuler);
}

function applyCamera(dt) {
  if (!player) return;
  if (viewMode === 'cockpit') {
    if (camera.parent !== player) setView('cockpit');
    return;
  }
  chaseCamTarget(camOffset);
  camera.position.lerp(camOffset, 1 - Math.exp(-14 * dt));
  camEuler.set(clamp(flight.pitch * 0.72 - 0.14, -0.9, 0.42), flight.heading, -flight.roll * 0.18, 'YXZ');
  camQuat.setFromEuler(camEuler);
  camera.quaternion.slerp(camQuat, 1 - Math.exp(-12 * dt));
}

function resetFlight() {
  flight.heading = 0;
  flight.pitch = 0;
  flight.roll = 0;
  held.clear();
  touchState.x = 0;
  touchState.y = 0;
  touchState.fire = false;
  controls.pitch = 0;
  controls.turn = 0;
  controls.fire = false;
  controls.takeoff = false;
  controls.land = false;
}

const LIVE_SOUND = new Set(['playing', 'mp']);

function soundLive() {
  return LIVE_SOUND.has(mode) && !document.hidden;
}

function muteParam(param, t) {
  if (!param) return;
  try {
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(t);
  } catch {}
  try { param.cancelScheduledValues(0); } catch {}
  try { param.setValueAtTime(0, t); } catch {
    try { param.value = 0; } catch {}
  }
}

function killEngineOsc() {
  if (!engineOsc) return;
  try { engineOsc.stop(); } catch {}
  try { engineOsc.disconnect(); } catch {}
  engineOsc = null;
}

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    (window.__wingsHonorAudio ||= []).push(audioCtx);
    engineGain = audioCtx.createGain();
    audioMaster = audioCtx.createGain();
    engineFilter = audioCtx.createBiquadFilter();
    engineComp = audioCtx.createDynamicsCompressor();
    audioMaster.gain.value = 0;
    engineGain.gain.value = 0;
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 220;
    engineComp.threshold.value = -20;
    engineComp.knee.value = 10;
    engineComp.ratio.value = 3.2;
    engineComp.attack.value = 0.004;
    engineComp.release.value = 0.14;
    engineFilter.connect(engineGain);
    engineGain.connect(engineComp);
    engineComp.connect(audioMaster);
    audioMaster.connect(audioCtx.destination);
  } catch {
    audioCtx = null;
    engineOsc = null;
    engineGain = null;
    audioMaster = null;
    engineFilter = null;
    engineComp = null;
  }
}

function ensureEngineOsc() {
  if (engineOsc || !audioCtx || !engineFilter) return;
  engineOsc = audioCtx.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 62;
  engineOsc.connect(engineFilter);
  engineOsc.start();
}

function startEngine() {
  if (!soundLive()) {
    stopEngine();
    return;
  }
  wantSound = true;
  initAudio();
  if (!audioCtx) return;
  ensureEngineOsc();
  if (!engineGain) return;
  try {
    const t = audioCtx.currentTime;
    muteParam(engineGain.gain, t);
    muteParam(audioMaster.gain, t);
    audioMaster.gain.setValueAtTime(1, t);
    engineGain.gain.setValueAtTime(0.0001, t);
    engineGain.gain.setTargetAtTime(0.09, t, 0.08);
  } catch {}
  const resume = audioCtx.state === 'suspended' || audioCtx.state === 'interrupted'
    ? audioCtx.resume()
    : null;
  if (resume?.then) {
    resume.then(() => {
      if (!wantSound || !soundLive()) stopEngine();
    }).catch(() => {
      if (!wantSound || !soundLive()) stopEngine();
    });
  }
}

function stopEngine() {
  wantSound = false;
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    muteParam(engineGain?.gain, t);
    muteParam(audioMaster?.gain, t);
    killEngineOsc();
    if (audioCtx.state !== 'closed' && audioCtx.state !== 'suspended') audioCtx.suspend();
  } catch {}
}

function tone(freq, duration, type = 'square', gain = 0.08, slide = 0) {
  if (!soundLive() || !wantSound || !audioCtx || audioCtx.state !== 'running') return;
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), audioCtx.currentTime + duration);
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    o.connect(g);
    g.connect(audioMaster || audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration);
  } catch {}
}

window.__wingsHonorAudioState = () => ({
  mode,
  ctx: audioCtx ? audioCtx.state : 'none',
  osc: Boolean(engineOsc),
  want: wantSound,
  live: soundLive(),
  gain: engineGain ? engineGain.gain.value : 0,
  master: audioMaster ? audioMaster.gain.value : 0,
  bag: (window.__wingsHonorAudio || []).map((c) => (c ? c.state : 'gone')),
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    wantSound = false;
    killEngineOsc();
    const bag = window.__wingsHonorAudio;
    if (Array.isArray(bag)) {
      for (const ctx of bag.splice(0)) {
        try { ctx.suspend(); } catch {}
        try { ctx.close(); } catch {}
      }
    }
    audioCtx = null;
    engineGain = null;
    audioMaster = null;
    engineFilter = null;
    engineComp = null;
  });
}

function spawnExplosion(pos, big = false) {
  tone(big ? 95 : 180, big ? 0.48 : 0.18, 'sawtooth', big ? 0.18 : 0.08, big ? -60 : -110);
  const count = big ? 22 : 10;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 + Math.random() * 0.35, 6, 5),
      new THREE.MeshBasicMaterial({ color: [0xffc66d, 0xf2763b, 0x6e6256][i % 3], transparent: true, opacity: 0.95 }),
    );
    mesh.position.copy(pos);
    scene.add(mesh);
    particles.push({ mesh, vel: v3((Math.random() - 0.5) * 9, Math.random() * 8, (Math.random() - 0.5) * 9), life: 0.55 + Math.random() * 0.65, max: 1 });
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const tracerHud = $('tracer-hud');
const tracerHudCtx = tracerHud?.getContext('2d');

function glowMap() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,245,1)');
  g.addColorStop(0.18, 'rgba(255,236,140,1)');
  g.addColorStop(0.42, 'rgba(255,150,40,0.85)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GLOW = glowMap();

function makeGlow(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: GLOW,
    color,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  s.renderOrder = 8;
  return s;
}

let flashes = [];

function muzzleFlash() {
  if (!player) return;
  const pit = viewMode === 'cockpit';
  for (const side of [-0.14, 0.14]) {
    const flash = makeGlow(0xfff6c4, pit ? 0.72 : 1.45);
    flash.position.set(side, pit ? 0.3 : 0.48, pit ? -1.42 : -2.05);
    player.add(flash);
    flashes.push({ mesh: flash, life: 0.1, max: 0.1, scale: pit ? 0.72 : 1.45 });
  }
}

function addBullet(pos, dir, owner = 'player', opts = {}) {
  const playerShot = owner === 'player';
  const flak = owner === 'aa';
  const scale = playerShot ? (viewMode === 'cockpit' ? 1.65 : 2.2) : flak ? 2.4 : 1.4;
  const mesh = makeGlow(playerShot ? 0xffe58a : flak ? 0xffc14a : 0xff6a3a, scale);
  mesh.position.copy(pos);
  scene.add(mesh);
  const speed = opts.speed || (playerShot ? 210 : flak ? COMBAT.AA_BULLET_SPEED : 105);
  bullets.push({
    mesh,
    vel: dir.clone().multiplyScalar(speed),
    life: opts.life || (playerShot ? 1.8 : flak ? COMBAT.AA_BULLET_LIFE : 2.5),
    owner,
    scale,
    damage: opts.damage || COMBAT.BULLET_DAMAGE,
  });
}

function drawTracerHud() {
  if (!tracerHud || !tracerHudCtx) return;
  const w = tracerHud.clientWidth;
  const h = tracerHud.clientHeight;
  if (!w || !h) return;
  if (tracerHud.width !== w || tracerHud.height !== h) {
    tracerHud.width = w;
    tracerHud.height = h;
  }
  tracerHudCtx.clearRect(0, 0, w, h);
  if (!controls.fire || viewMode !== 'cockpit' || (mode !== 'playing' && mode !== 'mp')) return;
  const cx = w * 0.5;
  const cy = h * 0.48;
  tracerHudCtx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const gx = cx + side * w * 0.048;
    const gy = cy + h * 0.13;
    const tx = cx + side * w * 0.006;
    const ty = cy - h * 0.16;
    const grad = tracerHudCtx.createLinearGradient(gx, gy, tx, ty);
    grad.addColorStop(0, 'rgba(255,250,210,0.7)');
    grad.addColorStop(0.2, 'rgba(255,200,70,0.45)');
    grad.addColorStop(1, 'rgba(255,90,20,0)');
    tracerHudCtx.strokeStyle = grad;
    tracerHudCtx.lineWidth = Math.max(1.4, w * 0.002);
    tracerHudCtx.lineCap = 'round';
    tracerHudCtx.beginPath();
    tracerHudCtx.moveTo(gx, gy);
    tracerHudCtx.lineTo(tx, ty);
    tracerHudCtx.stroke();
  }
  tracerHudCtx.globalCompositeOperation = 'source-over';
}

function spawnEnemy(spawn, spec, incoming = false) {
  const ace = spawn.ace ? aceById(spawn.ace) : null;
  const model = makeAircraft({
    enemy: true,
    scale: ace ? 0.9 : 0.82,
    type: ace?.craft || enemyCraftFor(currentMission, enemies.length),
    paint: ace ? { color: ace.color, wing: ace.wing } : null,
  });
  let x = spawn.x;
  let z = spawn.z;
  let heading = spawn.heading ?? Math.PI;
  if (incoming && player) {
    const n = enemies.filter((e) => (e.wave || 0) > 0).length;
    const fwd = forwardFromEuler(flight.heading, 0);
    const rightX = Math.cos(flight.heading);
    const rightZ = -Math.sin(flight.heading);
    const along = 130 + n * 24;
    const side = (n % 2 === 0 ? 1 : -1) * (32 + n * 16);
    x = player.position.x + fwd.x * along + rightX * side;
    z = player.position.z + fwd.z * along + rightZ * side;
    heading = flight.heading + Math.PI + (n % 2 === 0 ? 0.18 : -0.18);
  }
  const gy = world.heightAt(x, z);
  let y = gy + (spawn.agl ?? 22);
  if (player) y = Math.min(y, player.position.y - 2);
  y = Math.max(y, gy + 16);
  model.position.set(x, y, z);
  model.rotation.order = 'YXZ';
  model.rotation.y = heading;
  scene.add(model);
  enemies.push({
    ...createAiCraft({
      ...spawn,
      x,
      z,
      heading,
      y,
      phase: Math.random() * 6,
      fireTimer: 0.8 + Math.random(),
      health: currentMission?.onboard ? 1 : undefined,
      hitRadius: currentMission?.onboard ? 7.2 : undefined,
    }, spec),
    model,
  });
}

function fillBriefing(mission) {
  const diff = mission.onboard ? DIFFICULTY.easy : DIFFICULTY[progress.difficulty];
  $('brief-eyebrow').textContent = mission.onboard ? 'FIRST FLIGHT' : mission.skirmish ? (mission.huntPractice ? 'PRACTICE' : 'QUICK MISSION') : `MISSION ${String(mission.id).padStart(2, '0')}`;
  $('brief-title').textContent = mission.name;
  $('brief-meta').textContent = mission.onboard
    ? 'Kent · sunrise · Cadet · skip anytime'
    : `${theaterLabel(mission.theater)} · ${mission.region} · ${terrainLabel(mission.terrain)} · ${weatherLabel(mission.weather)} · ${diff.label}`;
  $('brief-copy').textContent = mission.brief;
  const w = winFor(mission, mission.onboard ? 'easy' : progress.difficulty);
  const noun = targetNoun(mission);
  const primary = [];
  const secondary = [];
  if (w.targets) primary.push(`<li><i class="pip ground"></i>Destroy the enemy ${noun} <b>(0/${w.targets})</b></li>`);
  if (w.kills) {
    const intercept = `<li><i class="pip enemy"></i>Intercept enemy aircraft <b>(0/${w.kills})</b></li>`;
    if (w.targets) secondary.push(intercept);
    else primary.push(`<li><i class="pip enemy"></i>${describeWin({ ...mission, win: { type: 'kills', kills: w.kills } }, progress.difficulty)} <b>(0/${w.kills})</b></li>`);
  }
  if (w.waypoints) primary.push(`<li><i class="pip hull"></i>Photograph recon marks <b>(0/${w.waypoints})</b></li>`);
  if (w.seconds) primary.push(`<li><i class="pip hull"></i>Hold the sector for <b>${w.seconds}s</b></li>`);
  if (w.targets) primary.push('<li><i class="pip hull"></i>Return to base</li>');
  if (!primary.length) primary.push(`<li><i class="pip enemy"></i>${describeWin(mission, progress.difficulty)}</li>`);
  if (!w.kills && mission.fighters) {
    secondary.push(`<li><i class="pip enemy"></i>Intercept enemy aircraft <b>(0/${mission.fighters + (diff.enemyBonus || 0)})</b></li>`);
  }
  acesFor(mission).forEach((id) => {
    const ace = aceById(id);
    if (ace) secondary.unshift(`<li><i class="pip enemy"></i>Ace reported: <b>${ace.name}</b> — ${ace.callsign}</li>`);
  });
  if (usesFuel(mission, mission.onboard ? 'easy' : progress.difficulty)) {
    secondary.push('<li><i class="pip hull"></i>Watch the fuel needle. Follow the compass to the gold strip, then press L or settle onto the grass.</li>');
  }
  secondary.push('<li><i class="pip hull"></i>Minimize damage to your aircraft</li>');
  const primaryEl = $('brief-primary');
  const secondaryEl = $('brief-secondary');
  if (primaryEl) primaryEl.innerHTML = primary.join('');
  if (secondaryEl) secondaryEl.innerHTML = secondary.join('');
  if (ui.objective) ui.objective.textContent = describeWin(mission, mission.onboard ? 'easy' : progress.difficulty);
  const hudMission = $('hud-mission');
  if (hudMission) hudMission.textContent = mission.onboard ? 'FIRST FLIGHT · KENT' : `${mission.skirmish ? (mission.huntPractice ? 'HUNT' : 'QUICK') : `MISSION ${String(mission.id).padStart(2, '0')}`} · ${mission.region.toUpperCase()}`;
  drawBriefPhoto(mission);
}

function resetGame() {
  const weather = world.applyMission(currentMission);
  cloudMat.opacity = weather.clouds;
  if (weather.cloud) cloudMat.color.set(weather.cloud);
  const spec = currentMission.onboard ? { ...DIFFICULTY.easy, enemyHp: 1 } : DIFFICULTY[progress.difficulty];
  const layout = layoutFor(currentMission, currentMission.onboard ? 'easy' : progress.difficulty, currentMission.huntPractice ? { pilotCount: 1 } : {});
  if (homeField?.group) scene.remove(homeField.group);
  homeField = null;
  for (const obj of [
    ...enemies.map((e) => e.model),
    ...targets,
    ...waypoints.map((w) => w.mesh),
    ...bullets.map((b) => b.mesh),
    ...bombs.map((b) => b.mesh),
    ...particles.map((p) => p.mesh),
  ]) scene.remove(obj);
  flashes.forEach((f) => f.mesh.parent?.remove(f.mesh));
  flashes = [];
  enemies = [];
  bullets = [];
  bombs = [];
  particles = [];
  targets = [];
  waypoints = [];
  waypointHits = 0;
  releaseCamera();
  if (player) scene.remove(player);
  const chosen = craftById(progress.craftId);
  playerPlane = isCraftUnlocked(chosen, progress) ? chosen : planeById('spitfire');
  player = makeAircraft({ type: playerPlane.id });
  let sx = 0;
  let sz = 80;
  const focus = layout.targets[0] || layout.waypoints[0];
  if (focus && (currentMission.terrain === 'city' || currentMission.terrain === 'sea')) {
    sx = focus.x * 0.25;
    sz = focus.z + 110;
  }
  const gy0 = world.heightAt(sx, sz);
  fuelJob = usesFuel(currentMission, currentMission.onboard ? 'easy' : progress.difficulty);
  const startOnGrass = Boolean(currentMission.onboard) || fuelJob;
  const startY = startOnGrass ? gy0 + FLIGHT.GROUND_CLEARANCE : Math.max(42, gy0 + 40);
  player.position.set(sx, startY, sz);
  resetFlight();
  flight.grounded = startOnGrass;
  if (fuelJob) homeField = makeHomeField(sx, sz);
  fuel = 1;
  sputtered = false;
  landMeter = 0;
  if (flight.grounded) {
    airspeed = 0;
    flight.pitch = 0;
    flight.roll = 0;
  }
  applyFlightPose();
  scene.add(player);
  setView(viewMode);
  if (viewMode !== 'cockpit') snapChaseCamera();
  layout.targets.forEach((t) => {
    const mesh = makeGroundTarget(t.x, t.z, t.kind);
    mesh.userData.heading = t.heading || 0;
    mesh.userData.speed = t.speed || 0;
    mesh.userData.role = t.role || 'primary';
    mesh.userData.fireTimer = 0.4 + Math.random() * 1.2;
    if (t.heading) mesh.rotation.y = t.heading;
    if (bombingMission(currentMission) || t.kind === 'aa' || t.kind === 'trench' || isConvoy(t.kind)) attachBombBeacon(mesh);
    targets.push(mesh);
  });
  pendingSpawns = [];
  layout.enemies.forEach((spawn) => {
    if ((spawn.wave || 0) > 0 && !currentMission.onboard) pendingSpawns.push(spawn);
    else spawnEnemy(spawn, spec);
  });
  if (currentMission.onboard && enemies[0]) {
    const ez = player.position.z - 88;
    const ey = player.position.y + 8;
    enemies[0].model.position.set(6, ey, ez);
    enemies[0].x = 6;
    enemies[0].y = ey;
    enemies[0].z = ez;
    enemies[0].heading = Math.PI;
  }
  layout.waypoints.forEach((w) => {
    const gy = world.heightAt(w.x, w.z);
    waypoints.push(makeWaypoint(w.x, Math.max(w.y, gy + 18), w.z));
  });
  score = 0;
  kills = 0;
  depots = 0;
  playerMaxHull = spec.hull * (playerPlane.hullMul || 1);
  hull = playerMaxHull;
  lastPropHit = 0;
  elapsed = 0;
  ordersDoneAt = 0;
  victoryAt = 0;
  lastShot = 0;
  lastBomb = 0;
  bombsLeft = bombingMission(currentMission) ? (playerPlane.bombLoad || COMBAT.BOMB_LOAD) : 0;
  airspeed = flight.grounded ? 0 : playerPlane.handling?.baseSpeed || FLIGHT.BASE_SPEED;
  bombImpact = null;
  if (ui.bombs) ui.bombs.textContent = String(bombsLeft);
  $('bombs-stat')?.classList.toggle('hidden', !bombingMission(currentMission));
  $('bomb-btn')?.classList.toggle('hidden', !bombingMission(currentMission));
  $('fuel-stat')?.classList.toggle('hidden', !fuelJob);
  ui.landBtn?.classList.toggle('hidden', true);
  ui.takeoffBtn?.classList.toggle('hidden', !fuelJob);
  hideHomeAids();
  ui.bombsight?.classList.add('hidden');
  if (bombSightRig) bombSightRig.visible = false;
  ui.score.textContent = '000000';
  ui.hull.style.width = '100%';
  ui.hull.style.background = '#d9ae61';
  fillBriefing(currentMission);
  ui.status.textContent = statusLine(currentMission, { kills: 0, targets: 0, waypoints: 0, elapsed: 0 }, progress.difficulty);
  ui.target.textContent = '';
  ui.targetMark?.classList.add('hidden');
  const hint = document.querySelector('.control-hint');
  if (hint) {
    const ground = currentMission.targetKind;
    hint.textContent = fuelJob
      ? 'FIRE TAXI · T TAKE OFF · FOLLOW COMPASS HOME · L LAND ON THE GOLD STRIP'
      : ground === 'trench' || ground === 'troops' || ground === 'truck' || ground === 'aa'
        ? '↓ DIVE · SPACE STRAFE · B BOMB · C COCKPIT'
        : bombingMission(currentMission)
          ? '↓ / S DIVE · B BOMB ON THE DIAMOND · SPACE FIRE · C COCKPIT'
          : '↓ / S DIVE · SPACE FIRE · C COCKPIT';
  }
  drawBriefingMap();
}

function setMode(next) {
  mode = next;
  ui.menu.classList.toggle('hidden', next !== 'menu');
  ui.campaign.classList.toggle('hidden', next !== 'campaign');
  ui.briefing.classList.toggle('hidden', next !== 'briefing');
  ui.hud.classList.toggle('hidden', next !== 'playing' && next !== 'paused' && next !== 'mp' && next !== 'forfeit');
  ui.pause.classList.toggle('hidden', next !== 'paused');
  ui.result.classList.toggle('hidden', next !== 'result');
  ui.help.classList.toggle('hidden', next !== 'help');
  ui.auth?.classList.toggle('hidden', next !== 'auth');
  ui.callsign?.classList.toggle('hidden', next !== 'callsign');
  ui.mess?.classList.toggle('hidden', next !== 'mess');
  ui.lobby?.classList.toggle('hidden', next !== 'lobby');
  ui.legal?.classList.toggle('hidden', next !== 'legal');
  ui.age?.classList.toggle('hidden', next !== 'age');
  ui.forfeit?.classList.toggle('hidden', next !== 'forfeit');
  ui.hangar?.classList.toggle('hidden', next !== 'hangar');
  $('pause-btn')?.classList.toggle('hidden', next === 'mp');
  $('kill-feed')?.classList.toggle('hidden', next !== 'mp');
  $('mp-living')?.classList.toggle('hidden', next !== 'mp');
  if (next === 'playing' || next === 'mp') $('game-shell').focus();
  if (next !== 'playing' && next !== 'mp') {
    ui.targetMark?.classList.add('hidden');
    ui.bombsight?.classList.add('hidden');
    hideHomeAids();
    if (bombSightRig) bombSightRig.visible = false;
  }
  if (soundLive()) startEngine();
  else stopEngine();
  if (next === 'menu') track('menu');
  if (next === 'briefing') track('briefing_open', { mission_id: currentMission?.id, kind: sortieKindName });
  if (next === 'hangar') track('hangar');
  if (next === 'mess') track('mess_open');
}

function notify(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastTimer = 1.5;
}

function maybeSecondWave() {
  if (mode !== 'playing' || !pendingSpawns.length || currentMission?.onboard) return;
  const firstWave = enemies.filter((e) => (e.wave || 0) === 0);
  const firstDead = firstWave.filter((e) => !e.alive).length;
  if (firstDead < 2 && elapsed < 42) return;
  const spec = currentMission.onboard ? { ...DIFFICULTY.easy, enemyHp: 1 } : DIFFICULTY[progress.difficulty];
  const incoming = pendingSpawns.splice(0);
  incoming.forEach((spawn) => spawnEnemy(spawn, spec, true));
  notify('HERE THEY COME');
}

function beginVictory() {
  if (victoryAt || mode !== 'playing') return;
  victoryAt = elapsed + (fuelJob ? 16 : 4.8);
  notify(fuelJob ? 'JOB DONE · HEAD HOME' : 'JOB DONE');
}

function maybeWin() {
  if (mode !== 'playing') return;
  if (victoryAt) {
    if (fuelJob && flight.grounded) finish(true);
    else if (elapsed >= victoryAt) finish(true);
    return;
  }
  maybeSecondWave();
  if (pendingSpawns.length) return;
  const diff = currentMission.onboard ? 'easy' : progress.difficulty;
  const quota = checkWin(currentMission, { kills, targets: depots, waypoints: waypointHits, elapsed }, diff);
  if (!quota && !ordersDoneAt) return;
  const living = enemies.filter((e) => e.alive);
  if (!living.length) {
    beginVictory();
    return;
  }
  if (currentMission.huntPractice) return;
  if (!ordersDoneAt) {
    living.forEach((e) => {
      e.fleeing = true;
    });
    ordersDoneAt = elapsed + 4.2;
    notify("THEY'RE BREAKING OFF");
  }
  if (elapsed >= ordersDoneAt) beginVictory();
}

function currentKind() {
  if (currentMission?.onboard) return 'onboard';
  if (currentMission?.huntPractice) return 'hunt_practice';
  if (currentMission?.skirmish) return 'quick';
  if (mode === 'mp') return 'hunt';
  return 'campaign';
}

function applyMenuChrome() {
  const open = Boolean(progress.onboarded);
  $('play-btn')?.classList.toggle('hidden', open);
  $('campaign-btn')?.classList.toggle('hidden', !open);
  $('mess-btn')?.classList.toggle('hidden', !open);
  $('hangar-btn')?.classList.toggle('hidden', !open);
  $('start-btn')?.classList.toggle('hidden', !open);
  const unlock = $('unlock-all-btn');
  if (unlock) unlock.classList.toggle('hidden', location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');
}

function syncProgressCloud() {
  const me = getSession();
  if (!me) return;
  authApi('/api/progress', { method: 'POST', body: JSON.stringify({ progress }) });
}

function soloRibbons(win) {
  const out = [];
  if (win && currentMission?.onboard) out.push('first_flight');
  if (win && kills >= 5) out.push('ace');
  if (win && depots >= 3) out.push('convoy_killer');
  if (win && currentMission?.targetKind === 'trench') out.push('trench');
  if (win && (currentMission?.aces || []).includes('hartmann')) out.push('hartmann');
  if (win && progress.completed.length >= 10) out.push('campaign_10');
  if (win && progress.completed.length >= 25) out.push('campaign_25');
  if (win && progress.completed.length >= 50) out.push('campaign_50');
  if (win && progress.completed.length >= 100) out.push('campaign_100');
  return out;
}

function finish(win) {
  const kind = currentKind();
  const spec = DIFFICULTY[currentMission.onboard ? 'easy' : progress.difficulty] || DIFFICULTY.normal;
  const hullPct = hull / (playerMaxHull || spec.hull || 100);
  const stars = starRating({ win, hullPct, elapsed, par: 80 });
  track('sortie_end', { kind, mission_id: currentMission.id, difficulty: progress.difficulty, win: win ? 1 : 0, kills, hull_pct: hullPct, elapsed_s: Math.round(elapsed), crash: win ? 0 : 1 });
  flush();
  setMode('result');
  const best = Math.max(Number(localStorage.getItem('wings-honor-best-score') || 0), score);
  localStorage.setItem('wings-honor-best-score', String(best));
  $('result-title').textContent = win ? (currentMission.onboard ? "YOU'RE A PILOT" : 'NICE FLYING') : 'OH NO — TRY AGAIN';
  $('result-stars').textContent = win && isCampaignMission(currentMission) ? `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}` : '';
  $('report-btn')?.classList.add('hidden');
  $('result-unlock').textContent = '';
  if (win) {
    if (currentMission.onboard) {
      progress.onboarded = true;
      saveProgress(progress);
      applyMenuChrome();
      $('result-copy').textContent = 'The Spitfire is yours. Mission 01 is next — have fun.';
      $('next-btn').classList.remove('hidden');
      $('next-btn').innerHTML = 'MISSION 01 <span>↗</span>';
    } else if (isCampaignMission(currentMission)) {
      if (!progress.completed.includes(currentMission.id)) progress.completed.push(currentMission.id);
      progress.scores[currentMission.id] = Math.max(progress.scores[currentMission.id] || 0, score);
      progress.stars = progress.stars || {};
      progress.stars[currentMission.id] = Math.max(progress.stars[currentMission.id] || 0, stars);
      if (currentMission.id >= progress.unlocked && progress.unlocked < MISSIONS.length) progress.unlocked = currentMission.id + 1;
      saveProgress(progress);
      const more = currentMission.id < MISSIONS.length;
      const craftUnlock = CRAFTS.find((c) => c.unlock === progress.unlocked);
      const nextCraft = nextCraftUnlock(progress.unlocked - (craftUnlock ? 0 : 0), CRAFTS);
      const tease = nextCraftUnlock(progress.unlocked, CRAFTS);
      const aceSoon = nextAceMission(currentMission.id, MISSIONS);
      $('result-copy').textContent = more
        ? `${currentMission.name} is done. Mission ${String(currentMission.id + 1).padStart(2, '0')} is unlocked.${craftUnlock ? ` Hangar: ${craftUnlock.name} is yours.` : ''}`
        : 'The campaign is complete. The sky is yours.';
      const bits = [];
      if (tease) bits.push(`${tease.name} unlocks at mission ${String(tease.unlock).padStart(2, '0')}.`);
      if (aceSoon && aceSoon.id <= currentMission.id + 3) bits.push(`Ace reported: ${aceSoon.name}.`);
      $('result-unlock').textContent = bits.join(' ');
      $('next-btn').classList.toggle('hidden', !more);
      $('next-btn').innerHTML = 'NEXT MISSION <span>↗</span>';
    } else {
      $('result-copy').textContent = currentMission.huntPractice
        ? 'Nice practice. Open a room when you want a friend on the next flight.'
        : 'Another sky is waiting. Quick Mission picks a new one every time.';
      $('next-btn').classList.remove('hidden');
      $('next-btn').innerHTML = currentMission.huntPractice ? 'PRACTICE AGAIN <span>↗</span>' : 'NEW SCENARIO <span>↗</span>';
    }
  } else {
    $('result-copy').textContent = 'That was a bump. Hop in and try again.';
    $('next-btn').classList.toggle('hidden', !currentMission?.skirmish);
    if (currentMission?.skirmish) $('next-btn').innerHTML = 'NEW SCENARIO <span>↗</span>';
  }
  $('final-score').textContent = String(score).padStart(6, '0');
  const ribs = soloRibbons(win);
  if (ribs.length) progress.ribbons = [...new Set([...(progress.ribbons || []), ...ribs])];
  saveProgress(progress);
  submitScore(score, { kind, missionId: currentMission.id, win, kills, ground: depots, recon: waypointHits, ribbons: ribs });
  syncProgressCloud();
  renderMissionList();
}

function bombOrigin() {
  const src = mode === 'mp' && mpCraft ? mpCraft : flight;
  return {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    heading: src.heading,
    pitch: src.pitch,
    speed: airspeed || FLIGHT.BASE_SPEED,
  };
}

function ensureBombSight() {
  if (bombSightRig) return;
  const g = new THREE.Group();
  const matRing = new THREE.MeshBasicMaterial({
    color: 0xe9d7a0,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(5.2, 6.6, 32), matRing);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  const innerMat = matRing.clone();
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), innerMat);
  inner.rotation.x = -Math.PI / 2;
  g.add(inner);
  g.userData.mat = matRing;
  g.userData.inner = innerMat;
  g.visible = false;
  scene.add(g);
  bombSightRig = g;
}

function groundLockTarget(impact) {
  if (!impact) return null;
  let best = null;
  let bestD = COMBAT.BOMB_RADIUS;
  for (const t of targets) {
    if (t.userData.health <= 0) continue;
    const d = Math.hypot(t.position.x - impact.x, t.position.z - impact.z);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function targetAimPoint(t, out) {
  const lift = groundSpec(t.userData.kind).lift;
  out.set(t.position.x, t.position.y + lift, t.position.z);
  return out;
}

function nearestAheadGround(maxDist = 2400) {
  const fwd = forwardFromEuler(flight.heading, 0);
  let best = null;
  let bestScore = -Infinity;
  let nearest = null;
  let nearestD = Infinity;
  for (const t of targets) {
    if (t.userData.health <= 0) continue;
    const dx = t.position.x - player.position.x;
    const dz = t.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > maxDist) continue;
    if (dist < nearestD) {
      nearestD = dist;
      nearest = t;
    }
    const ahead = dist < 1 ? 1 : (fwd.x * dx + fwd.z * dz) / dist;
    const score = ahead * 220 - dist * 0.08;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  if (best && bestScore > -80) return best;
  return nearest;
}

function projectHud(worldPos, clampEdge = false) {
  _ndc.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
  const ahead = _ndc.z < -0.6;
  _ndc.copy(worldPos).project(camera);
  let x = _ndc.x;
  let y = _ndc.y;
  if (!ahead) {
    x = x === 0 ? 0 : Math.sign(x) * 1.6;
    y = 0.08;
  }
  const onScreen = ahead && x > -1.02 && x < 1.02 && y > -1.12 && y < 1.08;
  if (clampEdge && !onScreen) {
    const limX = 0.58;
    const limY = 0.46;
    const m = Math.max(Math.abs(x) / limX, Math.abs(y) / limY, 1);
    x /= m;
    y /= m;
  }
  return {
    left: `${(x * 0.5 + 0.5) * 100}%`,
    top: `${(-y * 0.5 + 0.5) * 100}%`,
    onScreen,
    ahead,
    clamped: clampEdge && !onScreen,
  };
}

function heightSample(x, z) {
  return world.heightAt(x, z);
}

function canBomb() {
  if (bombs.length) return true;
  if (mode === 'mp') return targets.some((t) => t.userData.health > 0);
  return bombingMission(currentMission);
}

function updateBombSight() {
  ensureBombSight();
  const live = (mode === 'playing' || mode === 'mp') && player && canBomb() && (bombsLeft > 0 || bombs.length);
  if (!live) {
    bombImpact = null;
    bombSightRig.visible = false;
    ui.bombsight?.classList.add('hidden');
    return;
  }
  camera.updateMatrixWorld();
  const falling = bombs[bombs.length - 1];
  if (falling) {
    bombImpact = predictLanding(falling.state, heightSample) || falling.impact;
  } else {
    bombImpact = predictBombImpact(bombOrigin(), heightSample);
  }
  if (!bombImpact) {
    bombSightRig.visible = false;
    ui.bombsight?.classList.add('hidden');
    return;
  }
  const lock = groundLockTarget(bombImpact);
  bombSightRig.visible = true;
  if (lock) bombSightRig.position.set(lock.position.x, lock.position.y + 0.25, lock.position.z);
  else bombSightRig.position.set(bombImpact.x, bombImpact.y + 0.15, bombImpact.z);
  const pulse = lock ? 1.1 + Math.sin(elapsed * 10) * 0.12 : 1;
  bombSightRig.scale.setScalar(pulse);
  const col = lock ? 0xf0c45a : 0xe9d7a0;
  bombSightRig.userData.mat.color.setHex(col);
  bombSightRig.userData.inner.color.setHex(col);
  const pipPos = lock ? targetAimPoint(lock, _to) : _to.set(bombImpact.x, bombImpact.y + 0.6, bombImpact.z);
  const hud = projectHud(pipPos, true);
  const el = ui.bombsight;
  if (el) {
    el.classList.remove('hidden');
    el.classList.toggle('locked', Boolean(lock));
    el.style.left = hud.left;
    el.style.top = hud.top;
  }
  if (ui.bombsightLabel) {
    ui.bombsightLabel.textContent = falling ? (lock ? 'HIT' : 'FALLING') : lock ? 'ON TARGET · B' : 'DROP';
  }
}

function createBomb() {
  if (mode === 'mp' || mode === 'forfeit') {
    held.add('bomb');
    setTimeout(() => held.delete('bomb'), 120);
    return;
  }
  if (mode !== 'playing' || !canBomb() || performance.now() - lastBomb < COMBAT.BOMB_S * 1000) return;
  if (bombsLeft <= 0) {
    notify('NO BOMBS');
    return;
  }
  bombsLeft -= 1;
  if (ui.bombs) ui.bombs.textContent = String(bombsLeft);
  lastBomb = performance.now();
  tone(140, 0.12, 'triangle', 0.08, -45);
  const origin = bombOrigin();
  const state = spawnBomb(origin, 'player');
  const impact = predictLanding(state, heightSample);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.44, 1.55, 8),
    new THREE.MeshBasicMaterial({ color: 0x2b2d28 }),
  );
  mesh.position.set(state.x, state.y, state.z);
  scene.add(mesh);
  bombs.push({ mesh, state, impact, trailAt: 0 });
}

function shoot() {
  if (flight.grounded) return;
  const now = performance.now();
  const gap = (playerPlane.shotS || 0.095) * 1000;
  if (now - lastShot < gap) return;
  if (!firstShotTracked) {
    firstShotTracked = true;
    track('first_shot', { kind: currentKind(), mission_id: currentMission?.id });
  }
  lastShot = now;
  tone(280, 0.055, 'square', 0.055, -90);
  const fwd = forwardFromEuler(flight.heading, flight.pitch);
  const dir = v3(fwd.x, fwd.y, fwd.z);
  const muzzle = viewMode === 'cockpit' ? 2.6 : 3.2;
  const lift = viewMode === 'cockpit' ? 0.22 : 0.18;
  const guns = playerPlane.guns || 2;
  const sides = guns === 1 ? [0] : [-0.14, 0.14];
  for (const side of sides) {
    const start = player.position.clone().addScaledVector(dir, muzzle);
    start.y += lift;
    _right.set(Math.cos(flight.heading), 0, -Math.sin(flight.heading)).multiplyScalar(side);
    start.add(_right);
    addBullet(start, dir, 'player');
  }
  muzzleFlash();
}

function damagePlayer(amount) {
  const spec = DIFFICULTY[progress.difficulty];
  hull = Math.max(0, hull - amount * spec.damageMul);
  ui.hull.style.width = `${(hull / (playerMaxHull || spec.hull)) * 100}%`;
  if (hull < (playerMaxHull || spec.hull) * 0.35) ui.hull.style.background = '#b94738';
  if (hull <= 0) {
    spawnExplosion(player.position, true);
    finish(Boolean(victoryAt));
  }
}

function removeEnemy(enemy) {
  if (!enemy.alive) return;
  enemy.alive = false;
  spawnExplosion(enemy.model.position, true);
  scene.remove(enemy.model);
  kills++;
  const ace = enemy.ace ? aceById(enemy.ace) : null;
  score += killScore(ace);
  ui.score.textContent = String(score).padStart(6, '0');
      notify(ace ? `${ace.tag} DOWN · +${killScore(ace)}` : 'GOT ONE');
  if (!firstKillTracked) {
    firstKillTracked = true;
    track('first_kill', { kind: currentKind(), mission_id: currentMission.id });
  }
  maybeWin();
}

function destroyTarget(target) {
  if (target.userData.dead) return;
  target.userData.dead = true;
  target.userData.health = 0;
  spawnExplosion(target.position.clone().add(v3(0, 2, 0)), true);
  scene.remove(target);
  const threat = target.userData.role === 'threat';
  if (!threat) depots++;
  score += threat ? 200 : 350;
  ui.score.textContent = String(score).padStart(6, '0');
  const sunk = target.userData.kind;
  notify(
    sunk === 'ship' || sunk === 'gunboat' ? 'SHIP SUNK'
      : sunk === 'wireless' ? 'MAST DOWN'
        : sunk === 'camp' ? 'CAMP BURNED'
          : sunk === 'truck' ? 'LORRY BURNED'
            : sunk === 'troops' ? 'COLUMN BROKEN'
              : sunk === 'trench' ? 'TRENCH CRATERED'
                : sunk === 'aa' ? 'FLAK SILENCED'
                  : 'GROUND TARGET DESTROYED',
  );
  maybeWin();
}

function hurtTarget(target, amount = 1) {
  if (!target || target.userData.dead || target.userData.health <= 0) return false;
  target.userData.health -= amount;
  spawnExplosion(target.position.clone().add(v3(0, 1.4, 0)));
  if (target.userData.health <= 0) {
    destroyTarget(target);
    return true;
  }
  notify(target.userData.kind === 'aa' ? 'GUN HIT' : 'STRAFE');
  return true;
}

function semanticKeys(e) {
  const names = [];
  const c = e.code;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
  if (c === 'KeyW' || c === 'ArrowUp' || k === 'w' || k === 'arrowup') names.push('pitchUp');
  if (c === 'KeyS' || c === 'ArrowDown' || k === 's' || k === 'arrowdown') names.push('pitchDown');
  if (c === 'KeyA' || c === 'ArrowLeft' || k === 'a' || k === 'arrowleft') names.push('left');
  if (c === 'KeyD' || c === 'ArrowRight' || k === 'd' || k === 'arrowright') names.push('right');
  if (c === 'Space' || k === ' ') names.push('fire');
  if (c === 'KeyB' || k === 'b') names.push('bomb');
  return names;
}

function updateInput(dt = 0.016) {
  let pitch = 0;
  let turn = 0;
  if (held.has('pitchUp')) pitch += 1;
  if (held.has('pitchDown')) pitch -= 1;
  if (held.has('left')) turn -= 1;
  if (held.has('right')) turn += 1;
  pitch += clamp(-touchState.y, -1, 1);
  turn += clamp(touchState.x, -1, 1);
  const targetPitch = clamp(pitch, -1, 1);
  const targetTurn = clamp(turn, -1, 1);
  const pitchOn = Math.abs(targetPitch) > Math.abs(controls.pitch);
  const turnOn = Math.abs(targetTurn) > Math.abs(controls.turn);
  controls.pitch = damp(controls.pitch, targetPitch, pitchOn ? 3.5 : 5.2, dt);
  controls.turn = damp(controls.turn, targetTurn, turnOn ? 3.5 : 5.2, dt);
  controls.fire = held.has('fire') || touchState.fire;
  if (!firstInputTracked && (controls.pitch || controls.turn || controls.fire)) {
    firstInputTracked = true;
    track('first_input', { kind: currentKind() });
  }
}

function setupStick() {
  const zone = $('stick-zone');
  const base = zone?.querySelector('.stick-base');
  const knob = $('stick-knob');
  const fireBtn = $('fire-btn');
  if (!zone || !base || !knob) return;
  let active = false;
  let id = null;
  let originX = 0;
  let originY = 0;

  function restStick() {
    active = false;
    id = null;
    touchState.x = 0;
    touchState.y = 0;
    knob.style.transform = 'translate(0,0)';
    base.classList.remove('floating');
    base.style.left = '';
    base.style.top = '';
    base.style.bottom = '';
  }

  function placeBase(clientX, clientY) {
    const zr = zone.getBoundingClientRect();
    const half = base.offsetWidth / 2;
    const x = clamp(clientX - zr.left, half, zr.width - half);
    const y = clamp(clientY - zr.top, half, zr.height - half);
    base.classList.add('floating');
    base.style.left = `${x}px`;
    base.style.top = `${y}px`;
    originX = zr.left + x;
    originY = zr.top + y;
  }

  function setFromEvent(e) {
    const r = base.getBoundingClientRect();
    const rangePx = Math.min(r.width, r.height) * 0.42;
    const axes = analogStick(e.clientX - originX, e.clientY - originY, rangePx);
    touchState.x = axes.x;
    touchState.y = axes.y;
    const travel = Math.min(r.width, r.height) * 0.28;
    knob.style.transform = `translate(${axes.x * travel}px, ${axes.y * travel}px)`;
  }

  function onStickDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    active = true;
    id = e.pointerId;
    zone.setPointerCapture(id);
    placeBase(e.clientX, e.clientY);
    setFromEvent(e);
  }

  function onStickMove(e) {
    if (!active || e.pointerId !== id) return;
    e.preventDefault();
    setFromEvent(e);
  }

  function onStickUp(e) {
    if (e.pointerId !== id) return;
    e.preventDefault();
    restStick();
  }

  zone.addEventListener('pointerdown', onStickDown);
  zone.addEventListener('pointermove', onStickMove);
  zone.addEventListener('pointerup', onStickUp);
  zone.addEventListener('pointercancel', onStickUp);
  zone.addEventListener('lostpointercapture', () => restStick());

  let fireId = null;
  function onFireDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    fireId = e.pointerId;
    try {
      fireBtn.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort on some webviews */
    }
    touchState.fire = true;
  }

  function onFireUp(e) {
    if (fireId == null || e.pointerId !== fireId) return;
    fireId = null;
    touchState.fire = false;
  }

  fireBtn.addEventListener('pointerdown', onFireDown);
  fireBtn.addEventListener('pointerup', onFireUp);
  fireBtn.addEventListener('pointercancel', onFireUp);
  fireBtn.addEventListener('lostpointercapture', onFireUp);
  window.addEventListener('pointerup', onFireUp);
  window.addEventListener('pointercancel', onFireUp);
  $('bomb-btn').addEventListener('click', (e) => {
    e.preventDefault();
    createBomb();
  });
  ui.landBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    tryLand({ forced: true });
  });
  ui.takeoffBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    tryTakeoff();
  });

  const hud = $('hud');
  const blockSelect = (e) => {
    if (mode === 'playing' || mode === 'mp' || mode === 'paused' || mode === 'forfeit') e.preventDefault();
  };
  hud?.addEventListener('selectstart', blockSelect);
  hud?.addEventListener('contextmenu', blockSelect);
  canvas.addEventListener('selectstart', blockSelect);
  canvas.addEventListener('contextmenu', blockSelect);
  [zone, fireBtn, $('bomb-btn'), ui.landBtn, ui.takeoffBtn].forEach((el) => {
    el?.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
setupStick();

window.addEventListener('keydown', (e) => {
  const names = semanticKeys(e);
  if (names.length) {
    names.forEach((n) => held.add(n));
    e.preventDefault();
  }
  if ((e.code === 'KeyB' || e.key.toLowerCase() === 'b') && mode === 'playing') createBomb();
  if ((e.code === 'KeyL' || e.key.toLowerCase() === 'l') && mode === 'playing') tryLand({ forced: true });
  if ((e.code === 'KeyT' || e.key.toLowerCase() === 't') && mode === 'playing') tryTakeoff();
  if ((e.code === 'KeyC' || e.key.toLowerCase() === 'c') && (mode === 'playing' || mode === 'mp')) setView();
  if (e.code === 'Escape' || e.key === 'Escape') {
    if (mode === 'mp') setMode('forfeit');
    else if (mode === 'forfeit') setMode('mp');
    else if (mode === 'playing') setMode('paused');
    else if (mode === 'paused') setMode('playing');
  }
  if ((e.code === 'Enter' || e.key === 'Enter') && mode === 'briefing') launchSortie();
  if (e.code === 'F9') {
    e.preventDefault();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `wings-honor-${Date.now()}.png`;
      a.click();
    });
  }
});
window.addEventListener('keyup', (e) => {
  semanticKeys(e).forEach((n) => held.delete(n));
});
window.addEventListener('blur', () => held.clear());

function setDifficulty(id) {
  if (!DIFFICULTY[id]) return;
  progress.difficulty = id;
  saveProgress(progress);
  document.querySelectorAll('.diff-row button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.diff === id);
  });
}

function renderMissionList() {
  const list = $('mission-list');
  if (!list) return;
  const jump = $('theater-jump');
  if (jump) {
    jump.innerHTML = THEATERS.map((t) => `<button type="button" data-theater="${t.id}">${t.name}</button>`).join('');
    jump.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const head = list.querySelector(`[data-theater-head="${btn.dataset.theater}"]`);
        head?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      });
    });
  }
  const rows = [];
  let lastTheater = '';
  MISSIONS.forEach((m) => {
    if (m.theater !== lastTheater) {
      lastTheater = m.theater;
      const t = THEATERS.find((th) => th.id === m.theater);
      rows.push(`<li class="theater-head" data-theater-head="${m.theater}"><span></span><span><b>${t?.name || m.theater}</b><small>${t?.blurb || ''}</small></span><span></span></li>`);
    }
    const locked = m.id > progress.unlocked;
    const done = progress.completed.includes(m.id);
    const st = progress.stars?.[m.id] || 0;
    const ace = m.aces?.length ? ' · ACE' : '';
    rows.push(`<li class="${locked ? 'locked' : ''} ${done ? 'done' : ''}" data-id="${m.id}">
      <span class="num">${String(m.id).padStart(2, '0')}</span>
      <span><b>${m.name}</b><small>${m.region} · ${terrainLabel(m.terrain)}${ace}${st ? ` · ${'★'.repeat(st)}` : ''}</small></span>
      <span class="tag">${locked ? 'TEST' : done ? 'DONE' : 'OPEN'}</span>
    </li>`);
  });
  list.innerHTML = rows.join('');
  list.querySelectorAll('li[data-id]').forEach((li) => {
    li.addEventListener('click', () => {
      const id = Number(li.dataset.id);
      if (!id) return;
      beginBriefing(missionById(id));
    });
  });
  const unlockBtn = $('unlock-all-btn');
  if (unlockBtn) unlockBtn.textContent = progress.unlocked >= MISSIONS.length ? 'ALL SORTIES OPEN' : 'OPEN ALL SORTIES';
}

function beginBriefing(mission = currentMission) {
  currentMission = mission;
  resetGame();
  setMode('briefing');
  if (mission.onboard) {
    setTimeout(() => {
      if (mode === 'briefing' && currentMission?.onboard) launchSortie();
    }, 3800);
  }
}

function launchSortie() {
  firstInputTracked = false;
  firstKillTracked = false;
  firstShotTracked = false;
  sortieKindName = currentKind();
  setMode('playing');
  setView('chase');
  snapChaseCamera();
  track('sortie_start', { kind: sortieKindName, mission_id: currentMission.id, difficulty: currentMission.onboard ? 'easy' : progress.difficulty });
  notify(currentMission.onboard ? 'OFF WE GO' : fuelJob ? 'HOLD FIRE TO TAXI · T TO LIFT' : currentMission.id === MISSIONS.length ? 'IRON SKIES' : 'HAVE FUN UP THERE');
}

$('campaign-btn').addEventListener('click', () => {
  renderMissionList();
  setMode('campaign');
});
$('campaign-back').addEventListener('click', () => setMode('menu'));
$('unlock-all-btn').addEventListener('click', () => {
  progress.unlocked = MISSIONS.length;
  saveProgress(progress);
  renderMissionList();
});
$('start-btn').addEventListener('click', () => beginBriefing(makeQuickSortie(progress)));
$('play-btn')?.addEventListener('click', () => startPlay());
$('age-yes')?.addEventListener('click', () => {
  acceptAge(true);
  bootTelemetry();
  trackBoot({ quality, webgl: webglOk });
  if (!webglOk) track('webgl_fail', { iframe: window.top !== window.self });
  const me = getSession();
  if (me?.id) bindUser(me.id);
  if (webglOk) startPlay();
});
$('age-no')?.addEventListener('click', () => {
  acceptAge(false);
  startPlay();
});

function startPlay() {
  if (localStorage.getItem('wings-honor-age-ok') == null) {
    setMode('age');
    return;
  }
  initAudio();
  beginBriefing(makePrologue());
}

function startPracticeHunt() {
  const seed = Number($('mess-mission')?.value || 3);
  const base = missionById(Math.min(100, Math.max(1, seed)));
  currentMission = { ...base, skirmish: true, huntPractice: true, name: 'Practice Hunt', brief: 'Clear the pack. Just you and computer planes. Invite a friend for the next flight — they join after this one.' };
  track('hunt_practice', { mission_id: base.id });
  beginBriefing(currentMission);
}
$('launch-btn').addEventListener('click', launchSortie);
$('brief-back').addEventListener('click', () => {
  renderMissionList();
  setMode('campaign');
});
$('pause-btn').addEventListener('click', () => {
  if (mode === 'mp') setMode('forfeit');
  else setMode('paused');
});
$('resume-btn').addEventListener('click', () => {
  setMode('playing');
});
$('restart-btn').addEventListener('click', () => beginBriefing(currentMission));
$('menu-btn').addEventListener('click', () => setMode('menu'));
$('again-btn').addEventListener('click', () => beginBriefing(currentMission));
$('next-btn').addEventListener('click', () => {
  if (currentMission?.onboard) beginBriefing(missionById(1));
  else if (currentMission?.huntPractice) startPracticeHunt();
  else if (currentMission?.skirmish) beginBriefing(makeQuickSortie(progress));
  else beginBriefing(missionById(Math.min(MISSIONS.length, currentMission.id + 1)));
});
$('result-menu-btn').addEventListener('click', () => setMode('menu'));
document.querySelectorAll('.diff-row button').forEach((btn) => {
  btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
});
setDifficulty(progress.difficulty);
$('how-btn').addEventListener('click', () => setMode('help'));
$('help-close').addEventListener('click', () => setMode('menu'));
$('quality-btn').addEventListener('click', () => {
  quality = quality === 'HIGH' ? 'MED' : 'HIGH';
  $('quality-btn').textContent = quality === 'HIGH' ? 'LOOKS: HIGH' : 'LOOKS: FAST';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'HIGH' ? 1.65 : 1.0));
  renderer.shadowMap.enabled = quality === 'HIGH';
  world.setQuality(quality);
});

const hangarStudio = {
  scene: null,
  cam: null,
  rt: null,
  model: null,
};

function ensureHangarStudio() {
  if (hangarStudio.scene) return;
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(0x243040);
  const cam = new THREE.PerspectiveCamera(36, 2, 0.1, 80);
  cam.position.set(4.6, 4.8, -5.4);
  cam.lookAt(0, 0.05, 0.25);
  sc.add(new THREE.HemisphereLight(0xf2f6fa, 0x6a6458, 2.4));
  const key = new THREE.DirectionalLight(0xfff4e6, 5.2);
  key.position.set(8, 10, -7);
  sc.add(key);
  const fillL = new THREE.DirectionalLight(0xc5d8ec, 1.8);
  fillL.position.set(-7, 5, 4);
  sc.add(fillL);
  const rim = new THREE.DirectionalLight(0xe8f2ff, 1.2);
  rim.position.set(-3, 5, -8);
  sc.add(rim);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 28),
    new THREE.MeshBasicMaterial({ color: 0x162028 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.18;
  sc.add(floor);
  hangarStudio.scene = sc;
  hangarStudio.cam = cam;
  hangarStudio.rt = new THREE.WebGLRenderTarget(880, 440);
}

function paintHangarThumb(cv, craft) {
  ensureHangarStudio();
  if (hangarStudio.model) {
    hangarStudio.scene.remove(hangarStudio.model);
    hangarStudio.model = null;
  }
  const model = makeAircraft({ type: craft.id, gear: true });
  model.rotation.set(0.1, 0.46, 0.22);
  hangarStudio.scene.environment = scene.environment;
  hangarStudio.scene.environmentIntensity = 0.85;
  hangarStudio.scene.add(model);
  hangarStudio.model = model;
  const prev = renderer.getRenderTarget();
  const prevClear = new THREE.Color();
  renderer.getClearColor(prevClear);
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(hangarStudio.rt);
  renderer.setClearColor(0x101920, 1);
  renderer.clear();
  renderer.render(hangarStudio.scene, hangarStudio.cam);
  const w = hangarStudio.rt.width;
  const h = hangarStudio.rt.height;
  const buf = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(hangarStudio.rt, 0, 0, w, h, buf);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(prevClear, prevAlpha);
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  }
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').putImageData(img, 0, 0);
}

function renderHangar() {
  const grid = $('hangar-grid');
  if (!grid) return;
  grid.innerHTML = CRAFTS.map((c) => {
    const open = isCraftUnlocked(c, progress);
    const selected = (progress.craftId || 'spitfire') === c.id;
    const ratings = planeRatings(c.id);
    const stats = ratings.map((r) => `<div class="hangar-stat"><em>${r.label}</em><span class="hangar-pips" aria-label="${r.label} ${r.pips} of 5">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= r.pips ? 'on' : ''}"></i>`).join('')}</span></div>`).join('');
    return `<button class="hangar-card ${open ? '' : 'locked'} ${selected ? 'selected' : ''}" data-craft="${c.id}">
      <canvas class="hangar-thumb" data-thumb="${c.id}" width="220" height="110"></canvas>
      <b>${c.name}</b>
      <small>${c.blurb}</small>
      <div class="hangar-stats">${stats}</div>
      <span>${open ? (selected ? 'SELECTED' : 'SELECT') : `UNLOCKS AT MISSION ${String(c.unlock).padStart(2, '0')}`}</span>
    </button>`;
  }).join('');
  grid.querySelectorAll('canvas[data-thumb]').forEach((cv) => paintHangarThumb(cv, craftById(cv.dataset.thumb)));
  grid.querySelectorAll('button[data-craft]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const craft = craftById(btn.dataset.craft);
      if (!isCraftUnlocked(craft, progress)) {
        notify(`UNLOCKS AFTER MISSION ${String(craft.unlock).padStart(2, '0')}`);
        return;
      }
      progress.craftId = craft.id;
      saveProgress(progress);
      renderHangar();
      notify(craft.blurb ? craft.blurb.toUpperCase() : `${craft.name.toUpperCase()} READY`);
    });
  });
}

function openHangar() {
  try {
    renderHangar();
  } catch (err) {
    console.error(err);
    window.__hangarError = String(err?.stack || err);
  }
  setMode('hangar');
}
$('hangar-btn')?.addEventListener('click', openHangar);
$('hangar-back')?.addEventListener('click', () => setMode('menu'));
$('view-btn')?.addEventListener('click', () => {
  if (mode === 'playing' || mode === 'mp' || mode === 'paused') setView();
});

function drawRadarBlip(ctx, px, py, kind, size) {
  ctx.beginPath();
  if (kind === 'enemy') {
    ctx.fillStyle = '#c45a48';
    ctx.arc(px, py, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'ground') {
    ctx.fillStyle = '#d6b36e';
    ctx.fillRect(px - size, py - size, size * 2, size * 2);
  } else if (kind === 'mark') {
    ctx.fillStyle = '#7ec8e3';
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-size, -size, size * 2, size * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#e9e2d1';
    ctx.moveTo(px, py - size - 1);
    ctx.lineTo(px + size, py + size);
    ctx.lineTo(px - size, py + size);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRadar() {
  const ctx = radarCtx;
  const w = radarCanvas.width;
  const h = radarCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = w / 2 - 8;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(10, 18, 22, 0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d6b36e99';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth = 1;
  [0.33, 0.66, 1].forEach((t) => {
    ctx.beginPath();
    ctx.arc(cx, cy, radius * t, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.lineTo(cx, cy + radius);
  ctx.moveTo(cx - radius, cy);
  ctx.lineTo(cx + radius, cy);
  ctx.stroke();
  ctx.fillStyle = '#d6b36e';
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius + 2);
  ctx.lineTo(cx - 5, cy - radius + 12);
  ctx.lineTo(cx + 5, cy - radius + 12);
  ctx.closePath();
  ctx.fill();

  const plot = (x, z, kind, ace = false) => {
    const rel = worldToRadar(x - player.position.x, z - player.position.z, flight.heading);
    let rx = rel.x;
    let ry = rel.y;
    const dist = Math.hypot(rx, ry);
    const clamped = dist > RADAR_RANGE;
    if (clamped) {
      rx *= RADAR_RANGE / dist;
      ry *= RADAR_RANGE / dist;
    }
    const px = cx + (rx / RADAR_RANGE) * radius;
    const py = cy - (ry / RADAR_RANGE) * radius;
    const focus = kind === 'ground' && radarFocus && Math.hypot(x - radarFocus.position.x, z - radarFocus.position.z) < 1;
    drawRadarBlip(ctx, px, py, kind, ace ? 6.5 : focus ? 6 : clamped ? 3.5 : kind === 'ground' ? 5 : 4);
    if (focus || ace) {
      ctx.strokeStyle = ace ? '#c45a48' : '#f0c45a';
      ctx.lineWidth = ace ? 2 : 1.6;
      ctx.beginPath();
      ctx.arc(px, py, ace ? 10 : 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  for (const t of targets) {
    if (t.userData.health > 0) plot(t.position.x, t.position.z, 'ground');
  }
  for (const e of enemies) {
    if (e.alive) plot(e.model.position.x, e.model.position.z, 'enemy', Boolean(e.ace));
  }
  for (const wp of waypoints) {
    if (!wp.hit) plot(wp.x, wp.z, 'mark');
  }
  drawRadarHome(ctx, cx, cy, radius);
  drawRadarBlip(ctx, cx, cy, 'you', 5);
}

function radarPoint(x, z, radius, cx, cy) {
  const rel = worldToRadar(x - player.position.x, z - player.position.z, flight.heading);
  let rx = rel.x;
  let ry = rel.y;
  const dist = Math.hypot(rx, ry);
  const clamped = dist > RADAR_RANGE;
  if (clamped) {
    rx *= RADAR_RANGE / dist;
    ry *= RADAR_RANGE / dist;
  }
  return {
    px: cx + (rx / RADAR_RANGE) * radius,
    py: cy - (ry / RADAR_RANGE) * radius,
    clamped,
  };
}

function drawRadarHome(ctx, cx, cy, radius) {
  if (!homeField || !player) return;
  const s = homeStripCenter(homeField);
  const hw = s.halfW;
  const hl = s.halfL;
  const sh = Math.sin(s.heading);
  const ch = Math.cos(s.heading);
  const corner = (side, along) => {
    const x = s.x + side * ch + along * -sh;
    const z = s.z + side * -sh + along * -ch;
    return radarPoint(x, z, radius, cx, cy);
  };
  const pts = [corner(-hw, -hl), corner(hw, -hl), corner(hw, hl), corner(-hw, hl)];
  const home = radarPoint(s.x, s.z, radius, cx, cy);
  const hot = fuel <= FUEL.LOW || Boolean(victoryAt);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = hot ? '#f0c45a' : '#f0c45acc';
  ctx.lineWidth = hot ? 2.2 : 1.6;
  ctx.setLineDash(hot ? [4, 3] : []);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(home.px, home.py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pts[0].px, pts[0].py);
  pts.slice(1).forEach((p) => ctx.lineTo(p.px, p.py));
  ctx.closePath();
  ctx.fillStyle = hot ? 'rgba(240,196,90,0.42)' : 'rgba(240,196,90,0.28)';
  ctx.fill();
  ctx.strokeStyle = '#f8e7a8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.translate(home.px, home.py);
  ctx.rotate(-flight.heading + s.heading);
  ctx.fillStyle = '#111810';
  ctx.fillRect(-1.1, -7, 2.2, 14);
  ctx.restore();
  ctx.fillStyle = '#f0c45a';
  ctx.font = '700 11px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', home.px, home.py);
  ctx.restore();
}

function drawBriefPhoto(mission) {
  if (!briefPhoto || !briefPhotoCtx) return;
  drawBriefingPhoto(briefPhotoCtx, briefPhoto.width, briefPhoto.height, mission);
}

function drawBriefingMap() {
  drawVintageStaffMap(briefCtx, briefMap.width, briefMap.height, {
    seed: currentMission.seed || currentMission.id,
    terrain: currentMission.terrain,
    region: currentMission.region,
    player,
    enemies,
    targets,
    waypoints,
    homeField,
  });
}

function updateEnemy(e, dt) {
  const p = e.model.position;
  e.x = p.x;
  e.y = p.y;
  e.z = p.z;
  e.heading = e.model.rotation.y;
  e.pitch = e.model.rotation.x;
  e.roll = e.model.rotation.z;
  const playerCraft = { x: player.position.x, y: player.position.y, z: player.position.z, heading: flight.heading, pitch: flight.pitch, roll: flight.roll };
  const result = updateAi(e, playerCraft, dt, (x, z) => world.heightAt(x, z));
  p.set(e.x, e.y, e.z);
  e.model.rotation.order = 'YXZ';
  e.model.rotation.set(e.pitch, e.heading, -e.roll);
  e.model.userData.prop.rotation.z += dt * 45;
  if (result.fire) {
    const dir = v3(result.forward.x, result.forward.y, result.forward.z);
    addBullet(p.clone().addScaledVector(dir, 2.2), dir, 'enemy');
  }
  if (result.ram) {
    damagePlayer(COMBAT.RAM_DAMAGE);
    spawnExplosion(p);
    p.addScaledVector(_right.set(Math.sign(p.x) || 1, 0.6, 0.4), 18);
  }
}

function isOnScreen(worldPos) {
  _ndc.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
  if (_ndc.z > -1) return false;
  _ndc.copy(worldPos).project(camera);
  return _ndc.x > -1.2 && _ndc.x < 1.2 && _ndc.y > -1.35 && _ndc.y < 1.2;
}

function placeMark(worldPos, text, clampEdge = false) {
  if (!worldPos || !text || !ui.targetMark) {
    ui.targetMark?.classList.add('hidden');
    ui.targetMark?.classList.remove('edge');
    if (ui.target) ui.target.textContent = '';
    return false;
  }
  const hud = projectHud(worldPos, clampEdge);
  if (!clampEdge && !hud.onScreen) {
    ui.targetMark.classList.add('hidden');
    ui.targetMark.classList.remove('edge');
    if (ui.target) ui.target.textContent = '';
    return false;
  }
  ui.targetMark.classList.remove('hidden');
  ui.targetMark.classList.toggle('edge', Boolean(hud.clamped));
  ui.targetMark.style.left = hud.left;
  ui.targetMark.style.top = hud.top;
  ui.target.textContent = text;
  return true;
}

function groundKindLabel(kind) {
  const k = kind || currentMission?.targetKind;
  if (k === 'ship' || k === 'gunboat') return 'SHIP';
  if (k === 'wireless') return 'MAST';
  if (k === 'camp') return 'CAMP';
  if (k === 'hangar') return 'HANGAR';
  if (k === 'aa') return 'FLAK';
  if (k === 'truck') return 'LORRY';
  if (k === 'troops') return 'COLUMN';
  if (k === 'trench') return 'TRENCH';
  return 'TARGET';
}

function updateTargetMark() {
  radarFocus = null;
  if (canBomb()) {
    const lock = groundLockTarget(bombImpact);
    const focus = lock || nearestAheadGround();
    radarFocus = focus;
    if (focus) {
      const d = Math.round(focus.position.distanceTo(player.position));
      const label = lock ? `BOMB LOCK · ${d} M` : `${groundKindLabel(focus.userData.kind)} · ${d} M`;
      if (placeMark(targetAimPoint(focus, _to), label, true)) return;
    }
  }
  let best = null;
  let bestScore = -Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!isOnScreen(e.model.position)) continue;
    const d = e.model.position.distanceTo(player.position);
    if (d > 240) continue;
    _aim.copy(e.model.position).sub(player.position).normalize();
    const score = _pf.dot(_aim) * 90 - d * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = { pos: e.model.position, text: `${e.aceTag || 'ENEMY'} · ${Math.round(d)} M` };
    }
  }
  if (best && placeMark(best.pos, best.text)) return;
  const pendingWp = waypoints.find((w) => !w.hit);
  if (pendingWp && placeMark(pendingWp.mesh.position, `RECON RING · ${Math.round(player.position.distanceTo(pendingWp.mesh.position))} M`, true)) return;
  let ground = null;
  let gDist = Infinity;
  for (const t of targets) {
    if (t.userData.health <= 0) continue;
    const d = t.position.distanceTo(player.position);
    if (d < gDist) {
      gDist = d;
      ground = t;
    }
  }
  if (ground && gDist < 2400) {
    placeMark(targetAimPoint(ground, _to), `${groundKindLabel(ground.userData.kind)} · ${Math.round(gDist)} M`, true);
    return;
  }
  placeMark(null, '');
}

function update(dt) {
  if (mode === 'mp' || mode === 'forfeit') {
    updateMp(dt);
    return;
  }
  if (mode === 'playing') {
    elapsed += dt;
    updateInput(dt);

        const craft = {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
          heading: flight.heading,
          pitch: flight.pitch,
          roll: flight.roll,
          grounded: flight.grounded,
          speed: airspeed,
          planeId: playerPlane.id,
          handling: playerPlane.handling,
          engineOut: fuelJob && fuel <= 0 && !flight.grounded,
        };
        const flown = integrateFlight(craft, controls, dt, (x, z) => world.heightAt(x, z), world.getWind(), elapsed);
        player.position.set(craft.x, craft.y, craft.z);
        flight.heading = craft.heading;
        flight.pitch = craft.pitch;
        flight.roll = craft.roll;
        flight.grounded = craft.grounded;
        applyFlightPose();
        const speed = flown.speed;
        airspeed = speed;
        const stripNow = fuelJob ? overStrip() : null;
        const caught = fuelJob && !flight.grounded && shouldAutoLand(stripNow, landMeter) && tryLand({ auto: true });
        if (flown.groundHit === 'crash' && !caught) {
          notify('WENT INTO THE GROUND');
          damagePlayer(flown.groundDamage);
        } else if (flown.groundDamage && !caught) damagePlayer(flown.groundDamage);
        if (!flight.grounded && !caught) {
          const smash = world.hitObstacle?.(player.position.x, player.position.y, player.position.z);
          if (smash && elapsed - lastPropHit > 0.4) {
            lastPropHit = elapsed;
            const tree = smash.kind === 'tree';
            notify(tree ? 'CLIPPED A TREE' : 'HIT A BUILDING');
            damagePlayer(tree ? 24 : 42);
            flight.pitch = Math.max(flight.pitch, 0.16);
          }
        }
        updateCockpit(speed);
        if (fuelJob && !flight.grounded) {
          fuel = Math.max(0, fuel - FUEL.BURN_PER_S * dt);
          if (!sputtered && fuel <= FUEL.SPUTTER) {
            sputtered = true;
            notify('ENGINE COUGHING · FOLLOW THE COMPASS HOME');
          }
        }
        updateHomePrompt(dt);

    player.userData.prop.rotation.z += dt * 55;
    if (engineOsc && audioCtx && audioCtx.state === 'running') {
      const dead = fuelJob && fuel <= 0 && !flight.grounded;
      const cough = fuelJob && fuel <= FUEL.SPUTTER && !flight.grounded;
      const hz = dead ? 16 : cough ? 36 + Math.sin(elapsed * 26) * 14 : 58 + speed * 0.18 + Math.abs(controls.pitch) * 10;
      engineOsc.frequency.setTargetAtTime(hz, audioCtx.currentTime, 0.08);
    }
    if (controls.fire) shoot();
    applyCamera(dt);
    updateBombSight();

    _pf.set(0, 0, -1).applyQuaternion(player.quaternion);
    for (const e of enemies) {
      if (!e.alive) continue;
      updateEnemy(e, dt);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      _bprev.copy(b.mesh.position);
      b.mesh.position.addScaledVector(b.vel, dt);
      b.life -= dt;
      let hit = false;
      if (b.owner === 'player') {
        for (const e of enemies) {
          if (!e.alive) continue;
          const pos = e.model.position;
          if (segmentHitsSphere(_bprev.x, _bprev.y, _bprev.z, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, pos.x, pos.y, pos.z, e.hitRadius || COMBAT.HIT_RADIUS_AI)) {
            e.health -= 1;
            e.wasHit = true;
            hit = true;
            spawnExplosion(b.mesh.position);
            if (e.health <= 0) removeEnemy(e);
            else notify(e.aceTag ? `${e.aceTag} HIT` : 'HIT');
            break;
          }
        }
        if (!hit) {
          for (const t of targets) {
            if (t.userData.dead || t.userData.health <= 0) continue;
            if (!isStrafeable(t.userData.kind)) continue;
            const spec = groundSpec(t.userData.kind);
            if (segmentHitsSphere(_bprev.x, _bprev.y, _bprev.z, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, t.position.x, t.position.y + spec.lift * 0.45, t.position.z, spec.hitR)) {
              hit = true;
              hurtTarget(t, COMBAT.GROUND_STRAFE);
              break;
            }
          }
        }
      } else if (segmentHitsSphere(_bprev.x, _bprev.y, _bprev.z, b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, player.position.x, player.position.y, player.position.z, COMBAT.HIT_RADIUS_PLAYER)) {
        hit = true;
        damagePlayer(b.damage || COMBAT.BULLET_DAMAGE);
        spawnExplosion(b.mesh.position);
      }
      if (hit || b.life <= 0 || b.mesh.position.distanceTo(player.position) > 360) {
        scene.remove(b.mesh);
        b.mesh.material?.dispose?.();
        bullets.splice(i, 1);
      }
    }

    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.life -= dt;
      const k = Math.max(0, f.life / (f.max || 0.12));
      f.mesh.material.opacity = k;
      const s = (f.scale || 1.2) * (1.05 + (1 - k) * 0.8);
      f.mesh.scale.set(s, s, 1);
      if (f.life <= 0) {
        f.mesh.parent?.remove(f.mesh);
        f.mesh.material?.dispose?.();
        flashes.splice(i, 1);
      }
    }
    drawTracerHud();

    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      stepBomb(b.state, dt);
      b.mesh.position.set(b.state.x, b.state.y, b.state.z);
      const vlen = Math.hypot(b.state.vx, b.state.vy, b.state.vz) || 1;
      _aim.set(b.state.vx / vlen, b.state.vy / vlen, b.state.vz / vlen);
      b.mesh.quaternion.setFromUnitVectors(_up, _aim);
      b.impact = predictLanding(b.state, heightSample) || b.impact;
      if (elapsed - (b.trailAt || 0) > 0.04) {
        b.trailAt = elapsed;
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.42, 5, 4),
          new THREE.MeshBasicMaterial({ color: 0xb8b0a0, transparent: true, opacity: 0.5 }),
        );
        puff.position.set(b.state.x, b.state.y, b.state.z);
        scene.add(puff);
        particles.push({ mesh: puff, vel: v3(0, 0.5, 0), life: 0.4, max: 0.4 });
      }
      const impactY = world.heightAt(b.state.x, b.state.z);
      if (b.state.y < impactY + 2 || b.state.life <= 0) {
        const hx = b.impact ? b.impact.x : b.state.x;
        const hz = b.impact ? b.impact.z : b.state.z;
        const hy = b.impact ? b.impact.y : impactY;
        let nearest = null;
        let dist = Infinity;
        for (const t of targets) {
          if (t.userData.health > 0) {
            const d = Math.hypot(hx - t.position.x, hz - t.position.z);
            if (d < dist) {
              dist = d;
              nearest = t;
            }
          }
        }
        if (nearest && bombHitsTarget(hx, hz, nearest.position.x, nearest.position.z, groundSpec(nearest.userData.kind).bombR)) destroyTarget(nearest);
        else spawnExplosion(v3(hx, hy + 1.2, hz), true);
        scene.remove(b.mesh);
        bombs.splice(i, 1);
      }
    }
    updateBombSight();

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 8 * dt;
      p.mesh.scale.multiplyScalar(Math.max(0.9, 1 - dt * 0.8));
      p.mesh.material.opacity = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        particles.splice(i, 1);
      }
    }

    clouds.forEach((c) => {
      c.position.x += dt * (1.8 + world.getWind() * 0.15);
      if (c.position.x > 520) c.position.x = -520;
    });
    world.update(dt, player);

    for (const wp of waypoints) {
      if (wp.hit) continue;
      if (player.position.distanceTo(wp.mesh.position) < 8.5) {
        wp.hit = true;
        wp.mesh.visible = false;
        waypointHits++;
        score += 250;
        ui.score.textContent = String(score).padStart(6, '0');
        notify('MARK PHOTOGRAPHED');
        maybeWin();
      } else {
        wp.mesh.rotation.y += dt * 0.8;
      }
    }

    ui.status.textContent = victoryAt
      ? (fuelJob ? 'Job done · home strip' : 'Job done')
      : statusLine(currentMission, { kills, targets: depots, waypoints: waypointHits, elapsed }, progress.difficulty);
    if (ui.alt) ui.alt.textContent = String(Math.max(0, Math.round(player.position.y - world.heightAt(player.position.x, player.position.z)))).padStart(3, '0');
    if (victoryAt || currentMission.win.type === 'survive' || ordersDoneAt || pendingSpawns.length) maybeWin();
    updateTargetMark();
    const spec = DIFFICULTY[progress.difficulty] || DIFFICULTY.normal;
    for (const t of targets) {
      if (t.userData.dead || t.userData.health <= 0) continue;
      if (t.userData.speed) {
        if (t.userData.x == null) {
          t.userData.x = t.position.x;
          t.userData.z = t.position.z;
        }
        stepConvoy(t.userData, dt);
        t.position.x = t.userData.x;
        t.position.z = t.userData.z;
        t.position.y = world.heightAt(t.position.x, t.position.z);
        t.rotation.y = t.userData.heading || 0;
      }
      if (t.userData.kind === 'aa' && player && !ordersDoneAt) {
        t.userData.fireTimer = (t.userData.fireTimer || 0) - dt;
        const aim = aaFireDir(
          { x: t.position.x, y: t.position.y + 2.2, z: t.position.z },
          { x: player.position.x, y: player.position.y, z: player.position.z },
          spec.aaSpread || 0.18,
        );
        if (t.userData.barrel) {
          t.userData.barrel.rotation.y = Math.atan2(-(player.position.x - t.position.x), -(player.position.z - t.position.z));
          t.userData.barrel.rotation.x = -Math.atan2(player.position.y - t.position.y - 2, Math.hypot(player.position.x - t.position.x, player.position.z - t.position.z)) * 0.85;
        }
        if (t.userData.fireTimer <= 0 && aim.dist < (spec.aaRange || 200) && aim.dist > 18) {
          t.userData.fireTimer = (spec.aaFireInterval || 0.95) * (0.88 + Math.random() * 0.18);
          const n = spec.id === 'easy' ? 1 : 2;
          for (let i = 0; i < n; i++) {
            const burst = aaFireDir(
              { x: t.position.x, y: t.position.y + 2.2, z: t.position.z },
              { x: player.position.x, y: player.position.y, z: player.position.z },
              spec.aaSpread || 0.18,
            );
            const origin = v3(t.position.x, t.position.y + 2.4, t.position.z);
            const dir = v3(burst.x, burst.y, burst.z);
            addBullet(origin.addScaledVector(dir, 2), dir, 'aa', { damage: spec.aaDamage || 8 });
          }
        }
      }
      const b = t.userData.beacon;
      if (!b) continue;
      const hot = t === radarFocus;
      b.material.opacity = hot ? 0.72 + Math.sin(elapsed * 8) * 0.26 : 0.48;
      b.scale.setScalar(hot ? 1.14 + Math.sin(elapsed * 6) * 0.08 : 1);
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) ui.toast.classList.remove('show');
    }
    drawRadar();
  } else if (player) {
    player.userData.prop.rotation.z += dt * 18;
  }
}

let prev = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - prev) / 1000, 0.04);
  prev = now;
  update(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'HIGH' ? 1.65 : 1));
});

resetGame();
player.position.set(0, Math.max(26, world.heightAt(0, 80) + 28), 80);
camera.position.set(0, player.position.y + 12, 120);
camera.lookAt(0, player.position.y - 4, 40);
renderMissionList();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'playing') setMode('paused');
    else stopEngine();
    return;
  }
  if (soundLive()) startEngine();
  else stopEngine();
});

async function api(path, options) {
  try {
    const res = await fetch(apiPath(path), options);
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return null;
  }
}

function localScores() {
  try {
    return JSON.parse(localStorage.getItem('wings-honor-scores') || '[]');
  } catch {
    return [];
  }
}

function rememberLocalScore(name, score) {
  const rows = localScores();
  const i = rows.findIndex((r) => r.name === name);
  if (i >= 0) rows[i] = { name, score: Number(rows[i].score) + Number(score), at: Date.now() };
  else rows.push({ name, score: Number(score), at: Date.now() });
  rows.sort((a, b) => b.score - a.score);
  const top = rows.slice(0, 20);
  localStorage.setItem('wings-honor-scores', JSON.stringify(top));
  return top.slice(0, 10);
}

function renderLeaderboard(scores) {
  const board = $('leaderboard');
  const list = $('leaderboard-list');
  if (!board || !list) return;
  const rows = scores?.length ? scores : localScores();
  if (!rows?.length) {
    board.classList.add('hidden');
    return;
  }
  list.innerHTML = rows
    .slice(0, 5)
    .map((entry) => `<li><b>${String(entry.name).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</b><span>${String(entry.score).padStart(6, '0')}</span></li>`)
    .join('');
  board.classList.remove('hidden');
}

async function checkApi() {
  const health = await api('/api/health');
  const status = $('api-status');
  if (status) status.textContent = health?.ok ? (health.mp ? 'online' : 'online · friends later') : 'playing here';
  if (health?.support && $('support-mail')) $('support-mail').textContent = health.support;
  if (health?.ok) {
    const data = await api('/api/scores');
    renderLeaderboard(data?.scores?.length ? data.scores : localScores());
  } else {
    renderLeaderboard(localScores());
  }
}

async function submitScore(value, extra = {}) {
  const me = getSession();
  const callsign = me?.username || localStorage.getItem('wings-honor-pilot') || 'ACE';
  const payload = {
    callsign,
    aid: getAid(),
    kind: extra.kind || 'campaign',
    missionId: extra.missionId || currentMission.id,
    ribbons: extra.ribbons || [],
    score: value,
    kills: extra.kills ?? kills,
    deaths: extra.deaths ?? (hull <= 0 ? 1 : 0),
    ground: extra.ground ?? depots,
    recon: extra.recon ?? waypointHits,
    win: extra.win ? 1 : 0,
  };
  const data = await authApi('/api/sorties', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data?.scores?.length) renderLeaderboard(data.scores);
  else renderLeaderboard(rememberLocalScore(callsign, value));
}

let mpSession = null;
let mpCraft = null;
let mpRemotes = new Map();
let mpAiMeshes = [];
let mpTracers = [];
let mpWorldSeed = 0;
let mpInputAt = 0;
let mpSnap = null;

function clearMpMeshes() {
  for (const mesh of mpRemotes.values()) scene.remove(mesh);
  mpRemotes.clear();
  mpAiMeshes.forEach((m) => scene.remove(m));
  mpAiMeshes = [];
  mpTracers.forEach((m) => scene.remove(m));
  mpTracers = [];
}

async function joinMatch(matchId) {
  const ticketData = await authApi(`/api/matches/${matchId}/ticket`, { method: 'POST', body: '{}' });
  if (ticketData.error) {
    notify(ticketData.error);
    return;
  }
  mpSession?.leave();
  clearMpMeshes();
  mpWorldSeed = 0;
  mpSession = new MpSession({
    matchId,
    ticket: ticketData.ticket,
    userId: getSession()?.id,
    planeId: progress.craftId || 'spitfire',
    onLobby: (room) => {
      if (mode !== 'mp' && mode !== 'forfeit') setMode('lobby');
      fillLobby(room, getSession()?.id);
      $('lobby-title').textContent = room.mode === 'duel' ? 'Duel' : 'Hunt';
    },
    onSnapshot: applyMpSnapshot,
    onResult: finishMp,
    onEvent: (text) => notify(String(text || '').toUpperCase()),
    onClose: () => track('ws_drop', { match: matchId }),
  });
  mpSession.connect();
  setMode('lobby');
}

function applyMpSnapshot(snap) {
  mpSnap = snap;
  if ((snap.status === 'countdown' || snap.status === 'live') && snap.missionId && snap.seed !== mpWorldSeed) {
    currentMission = missionById(snap.missionId);
    const weather = world.applyMission(currentMission);
    cloudMat.opacity = weather.clouds;
    if (weather.cloud) cloudMat.color.set(weather.cloud);
    mpWorldSeed = snap.seed;
    mpSession?.worldReady();
  }
  if (snap.status === 'live' && mode !== 'mp' && mode !== 'forfeit') beginMp(snap);
  if (mode === 'lobby' && snap.status === 'countdown') fillLobby({ ...snap, pilots: snap.pilots, mode: snap.mode, difficulty: snap.difficulty, missionId: snap.missionId, ranked: false, hostId: '', status: snap.status }, getSession()?.id);
  syncMpActors(snap);
  renderMpHud(snap);
}

function beginMp(snap) {
  if (homeField?.group) scene.remove(homeField.group);
  homeField = null;
  fuelJob = false;
  $('fuel-stat')?.classList.add('hidden');
  ui.landBtn?.classList.add('hidden');
  ui.takeoffBtn?.classList.add('hidden');
  hideHomeAids();
  for (const obj of [...enemies.map((e) => e.model), ...targets, ...waypoints.map((w) => w.mesh), ...bullets.map((b) => b.mesh), ...bombs.map((b) => b.mesh)]) {
    scene.remove(obj);
  }
  flashes.forEach((f) => f.mesh.parent?.remove(f.mesh));
  flashes = [];
  enemies = [];
  pendingSpawns = [];
  targets = [];
  waypoints = [];
  bullets = [];
  bombs = [];
  releaseCamera();
  if (player) scene.remove(player);
  const me = snap.pilots.find((p) => p.id === getSession()?.id);
  playerPlane = planeById(me?.planeId || progress.craftId);
  player = makeAircraft({ team: me?.team ?? 0, type: playerPlane.id });
  scene.add(player);
  setView(viewMode);
  const c = me?.craft;
  mpCraft = createCraft({ ...(c || { x: 0, y: 42, z: 80 }), planeId: playerPlane.id });
  player.position.set(mpCraft.x, mpCraft.y, mpCraft.z);
  flight.heading = mpCraft.heading;
  flight.pitch = mpCraft.pitch;
  flight.roll = mpCraft.roll;
  applyFlightPose();
  if (viewMode !== 'cockpit') snapChaseCamera();
  playerMaxHull = me?.maxHull || mpCraft.maxHull || 100;
  hull = me?.hull ?? playerMaxHull;
  elapsed = snap.t || 0;
  bombsLeft = COMBAT.BOMB_LOAD;
  airspeed = mpCraft.speed || FLIGHT.BASE_SPEED;
  if (ui.bombs) ui.bombs.textContent = String(bombsLeft);
  (snap.targets || []).forEach((t) => {
    const mesh = makeGroundTarget(t.x, t.z, t.kind);
    mesh.userData.mpId = t.id;
    if (snap.mode !== 'duel') attachBombBeacon(mesh);
    targets.push(mesh);
  });
  (snap.waypoints || []).forEach((w) => waypoints.push(makeWaypoint(w.x, w.y, w.z)));
  $('bomb-btn')?.classList.toggle('hidden', snap.mode === 'duel');
  $('bombs-stat')?.classList.toggle('hidden', snap.mode === 'duel');
  setMode('mp');
  notify(snap.mode === 'duel' ? 'LAST PLANE FLYING' : 'FLY WITH FRIENDS');
}

function syncMpActors(snap) {
  if (!player || (mode !== 'mp' && mode !== 'forfeit')) return;
  const myId = getSession()?.id;
  const seen = new Set();
  for (const p of snap.pilots || []) {
    if (p.id === myId || !p.craft) continue;
    seen.add(p.id);
    let mesh = mpRemotes.get(p.id);
    if (!mesh) {
      mesh = makeAircraft({ team: p.team, scale: 0.92, type: p.planeId || 'spitfire' });
      scene.add(mesh);
      mpRemotes.set(p.id, mesh);
    }
    mesh.visible = p.alive !== false;
    mesh.position.lerp(v3(p.craft.x, p.craft.y, p.craft.z), 0.35);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.set(p.craft.pitch, p.craft.heading, -p.craft.roll);
    mesh.userData.prop.rotation.z += 0.4;
  }
  for (const [id, mesh] of mpRemotes) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      mpRemotes.delete(id);
    }
  }
  while (mpAiMeshes.length < (snap.ai || []).length) {
    const a = snap.ai[mpAiMeshes.length];
    const ace = a?.ace ? aceById(a.ace) : null;
    const m = makeAircraft({
      enemy: true,
      scale: ace ? 0.9 : 0.82,
      type: ace?.craft || enemyCraftFor(currentMission, mpAiMeshes.length),
      paint: ace ? { color: ace.color, wing: ace.wing } : null,
    });
    m.userData.aceId = ace?.id || null;
    scene.add(m);
    mpAiMeshes.push(m);
  }
  mpAiMeshes.forEach((m, i) => {
    const a = snap.ai[i];
    if (!a) {
      m.visible = false;
      return;
    }
    if ((a.ace || null) !== (m.userData.aceId || null)) {
      scene.remove(m);
      const ace = a.ace ? aceById(a.ace) : null;
      const neu = makeAircraft({
        enemy: true,
        scale: ace ? 0.9 : 0.82,
        type: ace?.craft || enemyCraftFor(currentMission, i),
        paint: ace ? { color: ace.color, wing: ace.wing } : null,
      });
      neu.userData.aceId = ace?.id || null;
      scene.add(neu);
      mpAiMeshes[i] = neu;
      m = neu;
    }
    m.visible = true;
    m.position.set(a.x, a.y, a.z);
    m.rotation.order = 'YXZ';
    m.rotation.set(a.pitch, a.heading, -a.roll);
    m.userData.prop.rotation.z += 0.4;
  });
  const liveT = new Set((snap.targets || []).map((t) => t.id));
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (t.userData.mpId != null && !liveT.has(t.userData.mpId)) {
      scene.remove(t);
      targets.splice(i, 1);
    }
  }
  const liveW = snap.waypoints || [];
  waypoints.forEach((w, i) => {
    const still = liveW[i];
    if (!still && w.mesh) {
      w.hit = true;
      w.mesh.visible = false;
    }
  });
  const blips = snap.bullets || [];
  while (mpTracers.length < blips.length) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    scene.add(m);
    mpTracers.push(m);
  }
  mpTracers.forEach((m, i) => {
    const b = blips[i];
    m.visible = Boolean(b);
    if (b) m.position.set(b.x, b.y, b.z);
  });
}

function renderMpHud(snap) {
  const me = (snap.pilots || []).find((p) => p.id === getSession()?.id);
  if (me) {
    hull = me.hull;
    const max = me.maxHull || 100;
    ui.hull.style.width = `${(hull / max) * 100}%`;
    ui.hull.style.background = hull < max * 0.35 ? '#b94738' : '#d9ae61';
    ui.score.textContent = String(me.kills * 500 + me.ground * 350 + me.recon * 250 + (me.aceBonus || 0)).padStart(6, '0');
  }
  const living = (snap.pilots || []).filter((p) => p.alive);
  const feed = $('kill-feed');
  if (feed) feed.innerHTML = (snap.events || []).map((e) => `<div>${String(e.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('');
  const live = $('mp-living');
  if (live) {
    live.classList.toggle('hidden', snap.mode !== 'duel');
    if (snap.mode === 'duel') {
      const a = living.filter((p) => p.team === 0).length;
      const b = living.filter((p) => p.team === 1).length;
      live.textContent = `LIVE ${a} V ${b}`;
    }
  }
  if (ui.objective) ui.objective.textContent = snap.mode === 'duel' ? 'Last man standing' : describeWin(currentMission, progress.difficulty);
  if (ui.status) {
    const kills = (snap.pilots || []).reduce((s, p) => s + p.kills, 0);
    ui.status.textContent = snap.mode === 'duel'
      ? `${living.map((p) => p.username).join(' · ') || 'None aloft'}`
      : `Kills ${kills} · Ground ${(snap.pilots || []).reduce((s, p) => s + p.ground, 0)}`;
  }
  if (me?.craft && ui.alt) ui.alt.textContent = String(Math.max(0, Math.round(me.craft.y - world.heightAt(me.craft.x, me.craft.z)))).padStart(3, '0');
}

function updateMp(dt) {
  if (!player || !mpSession) return;
  elapsed += dt;
  updateInput(dt);
  const t = performance.now();
  if (t - mpInputAt > 50) {
    mpInputAt = t;
    mpSession.sendInput({ pitch: controls.pitch, turn: controls.turn, fire: controls.fire, bomb: held.has('bomb') });
  }
  if (!mpCraft) mpCraft = createCraft({ x: player.position.x, y: player.position.y, z: player.position.z, heading: flight.heading, pitch: flight.pitch, roll: flight.roll, planeId: playerPlane.id });
  mpSession.predict(mpCraft, controls, dt, (x, z) => world.heightAt(x, z), world.getWind(), elapsed);
  player.position.set(mpCraft.x, mpCraft.y, mpCraft.z);
  flight.heading = mpCraft.heading;
  flight.pitch = mpCraft.pitch;
  flight.roll = mpCraft.roll;
  applyFlightPose();
  airspeed = mpCraft.speed || FLIGHT.BASE_SPEED;
  updateCockpit(mpCraft.speed || 62);
  player.userData.prop.rotation.z += dt * 55;
  applyCamera(dt);
  updateBombSight();
  _pf.set(0, 0, -1).applyQuaternion(player.quaternion);
  updateTargetMark();
  world.update(dt, player);
  drawTracerHud();
  if (mpSnap) {
    enemies = (mpSnap.ai || []).map((a, i) => ({
      alive: true,
      ace: a.ace || null,
      aceTag: a.aceTag || null,
      aceName: a.aceName || null,
      model: mpAiMeshes[i] || { position: v3(a.x, a.y, a.z) },
    }));
    targets = (mpSnap.targets || []).map((t) => ({
      position: v3(t.x, world.heightAt(t.x, t.z), t.z),
      userData: { health: 1 },
    }));
    waypoints = (mpSnap.waypoints || []).map((w) => ({ x: w.x, y: w.y, z: w.z, hit: false, mesh: { position: v3(w.x, w.y, w.z) } }));
    drawRadar();
  }
}

function finishMp(snap) {
  mpSnap = snap;
  setMode('result');
  const me = (snap.pilots || []).find((p) => p.id === getSession()?.id);
  const win = snap.mode === 'duel' ? snap.winnerTeam === me?.team && snap.result !== 'draw' : snap.result === 'win';
  $('result-title').textContent = snap.result === 'draw' ? "IT'S A DRAW" : win ? 'NICE FLYING' : 'OH NO — TRY AGAIN';
  const lines = (snap.pilots || []).map((p) => `${p.username}  K ${p.kills}  D ${p.deaths}  G ${p.ground}`).join(' · ');
  $('result-copy').textContent = lines || 'The room is closed.';
  $('final-score').textContent = String((me?.kills || 0) * 500 + (me?.ground || 0) * 350 + (me?.recon || 0) * 250 + (me?.aceBonus || 0)).padStart(6, '0');
  $('next-btn').classList.add('hidden');
  $('report-btn')?.classList.toggle('hidden', !(snap.pilots || []).some((p) => p.id !== me?.id));
  mpSession = null;
  clearMpMeshes();
  checkApi();
}

$('report-btn')?.addEventListener('click', async () => {
  const others = (mpSnap?.pilots || []).filter((p) => p.id !== getSession()?.id);
  const about = others[0];
  if (!about) return;
  const note = prompt(`Report ${about.username}? Optional note`) || '';
  await authApi('/api/reports', { method: 'POST', body: JSON.stringify({ aboutUser: about.id, matchId: mpSnap?.id || '', note }) });
  notify("THANKS — WE'LL LOOK");
});

$('lobby-ready')?.addEventListener('click', () => {
  const btn = $('lobby-ready');
  const on = btn.dataset.on !== '1';
  btn.dataset.on = on ? '1' : '0';
  btn.textContent = on ? 'UNREADY' : 'READY';
  mpSession?.setReady(on);
});
$('lobby-host')?.addEventListener('click', () => mpSession?.start());
$('lobby-leave')?.addEventListener('click', () => {
  mpSession?.leave();
  mpSession = null;
  setMode('mess');
});
$('lobby-invite')?.addEventListener('click', async () => {
  const who = prompt('Callsign or email to invite');
  if (!who || !mpSession) return;
  const duel = $('lobby-title')?.textContent === 'Duel';
  const side = duel ? Number(prompt('Team 1 (host) or 2', '2')) : 1;
  const body = who.includes('@') ? { email: who } : { username: who };
  body.team = side === 2 ? 1 : 0;
  const data = await authApi(`/api/matches/${mpSession.matchId}/invite`, { method: 'POST', body: JSON.stringify(body) });
  if (!data.error) track('invite_sent', { kind: duel ? 'duel' : 'hunt' });
  notify(data.error || (data.devToken ? `INVITE READY ${data.devToken}` : 'INVITE SENT'));
});
$('forfeit-yes')?.addEventListener('click', () => {
  mpSession?.leave();
  mpSession = null;
  clearMpMeshes();
  setMode('mess');
});
$('forfeit-no')?.addEventListener('click', () => setMode('mp'));

bootAuth().then(async () => {
  bootSocial({ setMode, notify, joinMatch, startPracticeHunt });
  const me = getSession();
  if (me) {
    const cloud = await authApi('/api/progress', { method: 'POST', body: JSON.stringify({ progress }) });
    if (cloud?.progress) {
      Object.assign(progress, cloud.progress, { difficulty: progress.difficulty, scores: { ...progress.scores, ...(cloud.progress.scores || {}) } });
      saveProgress(progress);
    }
  }
  applyMenuChrome();
  if (ageAccepted()) {
    bootTelemetry();
    trackBoot({ quality, webgl: webglOk });
    if (!webglOk) track('webgl_fail', { iframe: window.top !== window.self });
    if (me?.id) bindUser(me.id);
  } else if (localStorage.getItem('wings-honor-age-ok') == null && !progress.onboarded) {
    setMode('age');
  }
});

if ($('quality-btn')) $('quality-btn').textContent = quality === 'HIGH' ? 'LOOKS: HIGH' : 'LOOKS: FAST';
if (quality !== 'HIGH') {
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = false;
  world.setQuality?.(quality);
}

applyMenuChrome();
checkApi();
if (import.meta.env.DEV) {
  window.__openHangar = openHangar;
  window.__hangarStudio = hangarStudio;
  window.__quick = () => {
    beginBriefing(makeQuickSortie(progress));
    launchSortie();
  };
}
