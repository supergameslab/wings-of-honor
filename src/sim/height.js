import { saturate, smoothstep, lerp } from './math.js';

function n(x, z, a, b, s) {
  return Math.sin(x * a + z * b) * s;
}

function kopje(x, z, cx, cz, r, h) {
  const d = Math.hypot(x - cx, z - cz);
  const t = saturate(1 - d / r);
  return t * t * h;
}

export function makeParams(seed) {
  const s = Math.max(1, seed | 0);
  const rot = (s % 4) * Math.PI * 0.5 + (s % 3) * 0.27;
  const k = (i, span, off = 0) => ((s * (3 + i * 2) + off) % (span * 2 + 1)) - span;
  return {
    seed: s,
    rot,
    cos: Math.cos(rot),
    sin: Math.sin(rot),
    fx: 0.006 + (s % 7) * 0.0011,
    fz: 0.0048 + (s % 5) * 0.0014,
    phase: (s % 17) * 0.37,
    amp: 0.75 + (s % 6) * 0.1,
    coastOff: ((s % 9) - 4) * 24,
    riverAmp: 52 + (s % 8) * 16,
    riverFreq: 0.0035 + (s % 6) * 0.00085,
    riverOff: ((s % 11) - 5) * 18,
    cityX: k(1, 7) * 16,
    cityZ: k(2, 6) * 15,
    cityRot: (s % 8) * 0.22,
    patchW: 64 + (s % 6) * 14,
    patchH: 50 + (s % 5) * 11,
    kopjes: [
      { x: k(3, 9) * 20, z: k(4, 8) * 22, r: 42 + (s % 6) * 7, h: 11 + (s % 5) * 4 },
      { x: k(5, 8) * 22, z: k(6, 9) * 18, r: 36 + (s % 5) * 8, h: 9 + (s % 4) * 5 },
      { x: k(7, 7) * 24, z: k(8, 6) * 21, r: 40 + (s % 4) * 6, h: 10 + (s % 6) * 3 },
    ],
    islands: [
      { x: k(2, 10) * 28, z: k(3, 9) * 26, r: 70 + (s % 5) * 18, h: 14 + (s % 4) * 6 },
      { x: k(6, 11) * 24, z: k(1, 10) * 30, r: 48 + (s % 6) * 14, h: 9 + (s % 5) * 5 },
      { x: k(4, 8) * 32, z: k(7, 8) * 22, r: 36 + (s % 4) * 10, h: 7 + (s % 3) * 4 },
    ],
    hasRiver: s % 2 === 0,
  };
}

let params = makeParams(1);

export function setHeightParams(next) {
  params = next;
  return params;
}

export function getHeightParams() {
  return params;
}

function worldXZ(x, z, p) {
  return {
    x: x * p.cos - z * p.sin,
    z: x * p.sin + z * p.cos,
  };
}

export function riverCenterZ(rx, p = params) {
  return (
    p.riverOff +
    Math.sin(rx * p.riverFreq + p.phase) * p.riverAmp +
    Math.sin(rx * p.riverFreq * 2.28 + p.phase * 1.7) * p.riverAmp * 0.34 +
    Math.sin(rx * p.riverFreq * 0.41 + p.phase * 0.55) * (p.riverAmp * 0.58 + 48)
  );
}

export function riverWorldPoint(rx, p = params) {
  const rz = riverCenterZ(rx, p);
  return {
    x: rx * p.cos + rz * p.sin,
    z: -rx * p.sin + rz * p.cos,
  };
}

export function riverDistance(x, z, p = params) {
  const w = worldXZ(x, z, p);
  return Math.abs(w.z - riverCenterZ(w.x, p));
}

export function riverGrade(rx, p = params, terrain = 'fields') {
  const t = saturate((rx + 7200) / 14400);
  if (terrain === 'hills') return -27 - t * 19;
  if (terrain === 'jungle') return -31 - t * 15;
  if (terrain === 'savanna') return -36 - t * 10;
  if (terrain === 'coast') return -40 - t * 6;
  if (terrain === 'city') return -43 - t * 4;
  return -43.15 - t * 3.1;
}

export function canalDistance(x, z, p = params) {
  const w = worldXZ(x, z, p);
  return Math.abs(w.z + p.riverOff - Math.sin(w.x * 0.018) * 10);
}

export function roadDistance(x, z, p = params) {
  const w = worldXZ(x, z, p);
  const a = Math.abs(w.z - Math.sin(w.x * 0.0075 + p.phase) * 90);
  const b = Math.abs(w.x - Math.cos(w.z * 0.006 + p.phase) * 70);
  return Math.min(a, b);
}

export function siteBlocked(x, z, terrain = 'fields', p = params) {
  if (terrain === 'sea' || terrain === 'island' || terrain === 'desert' || terrain === 'mountains' || terrain === 'lake') return false;
  if (roadDistance(x, z, p) < 16) return true;
  if (riverDistance(x, z, p) < 28) return true;
  if (terrain === 'fields' || terrain === 'hills' || terrain === 'town' || terrain === 'coast' || terrain === 'savanna') {
    if (canalDistance(x, z, p) < 18) return true;
  }
  return false;
}

function hasRiver(terrain, p) {
  if (terrain === 'sea' || terrain === 'island' || terrain === 'desert' || terrain === 'mountains' || terrain === 'lake') return false;
  if (terrain === 'city') return Boolean(p.hasRiver);
  return true;
}

function carveRiver(land, x, z, terrain, p) {
  if (!hasRiver(terrain, p)) return land;
  const w = worldXZ(x, z, p);
  const rd = Math.abs(w.z - riverCenterZ(w.x, p));
  const grade = riverGrade(w.x, p, terrain);
  const valleyW = terrain === 'hills' ? 240 : terrain === 'jungle' ? 190 : 150;
  const inValley = 1 - smoothstep(22, valleyW, rd);
  const inChannel = 1 - smoothstep(6, 15, rd);
  const flood = grade + 2.2;
  let h = lerp(land, Math.min(land, flood), inValley * inValley);
  const bed = grade - (terrain === 'hills' ? 7 : 5.4);
  h = lerp(h, bed, inChannel * inChannel);
  if (terrain === 'fields' || terrain === 'hills' || terrain === 'town' || terrain === 'coast' || terrain === 'savanna') {
    const cd = canalDistance(x, z, p);
    const canal = 1 - smoothstep(3, 10, cd);
    h = lerp(h, Math.min(h, land - 3.5), canal * canal);
  }
  return h;
}

export function heightAt(x, z, terrain = 'fields', p = params) {
  const w = worldXZ(x, z, p);
  const xr = w.x;
  const zr = w.z;
  if (terrain === 'sea' || terrain === 'island') {
    let h = -46;
    p.islands.forEach((is) => {
      h += kopje(x, z, is.x, is.z, is.r * (terrain === 'island' ? 1.45 : 1), is.h * (terrain === 'island' ? 1.35 : 1));
    });
    return h;
  }
  if (terrain === 'fields' || terrain === 'town') {
    const land = -42 + n(xr, zr, p.fx, p.fz, 2.4 * p.amp) + n(xr, zr, p.fx * 2.4, p.fz * 2.6, 0.9);
    return carveRiver(Math.max(land, -44.2), x, z, terrain, p);
  }
  if (terrain === 'city') {
    const land = -42 + n(xr, zr, p.fx, p.fz, 1.6) + n(xr, zr, 0.02, 0.018, 0.5);
    return carveRiver(land, x, z, terrain, p);
  }
  if (terrain === 'hills') {
    const land = -34 + n(xr, zr, p.fx * 1.4, p.fz, 16 * p.amp) + n(xr, zr, p.fx * 2.6, p.fz * 2.2, 9) + n(xr, zr, p.fx * 0.7, p.fz * 1.8, 7);
    return carveRiver(land, x, z, terrain, p);
  }
  if (terrain === 'mountains') {
    const ridge = Math.abs(Math.sin(xr * (0.0055 + (p.seed % 4) * 0.0006) + zr * 0.0032 + p.phase));
    return -22 + ridge * (54 + (p.seed % 5) * 4) + n(xr, zr, 0.018, 0.015, 12) + n(xr, zr, 0.038, 0.03, 5);
  }
  if (terrain === 'coast') {
    const water = smoothstep(-40 + p.coastOff, 150 + p.coastOff, xr);
    const land = -36 + n(xr, zr, p.fx * 1.5, p.fz, 11) + n(xr, zr, p.fx * 3, p.fz * 2.4, 4);
    return carveRiver(land, x, z, terrain, p) * (1 - water) + -46 * water;
  }
  if (terrain === 'desert') {
    const dunes = Math.abs(Math.sin(xr * (0.007 + (p.seed % 5) * 0.0008) + zr * 0.003 + p.phase)) * 11 + n(xr, zr, 0.014, 0.02, 5);
    let rock = 0;
    p.kopjes.forEach((k) => {
      rock += kopje(x, z, k.x, k.z, k.r, k.h);
    });
    return -36 + dunes + rock;
  }
  if (terrain === 'savanna') {
    const rise = n(xr, zr, p.fx, p.fz, 7) + n(xr, zr, p.fx * 2.2, p.fz * 2, 3);
    let rock = 0;
    p.kopjes.slice(0, 2).forEach((k) => {
      rock += kopje(x, z, k.x, k.z, k.r * 0.9, k.h * 0.7);
    });
    return carveRiver(-39 + rise + rock, x, z, terrain, p);
  }
  if (terrain === 'jungle') {
    const land = -35 + n(xr, zr, p.fx * 1.6, p.fz, 8) + n(xr, zr, 0.03, 0.022, 3);
    return carveRiver(land, x, z, terrain, p);
  }
  if (terrain === 'lake') {
    const water = smoothstep(-30 + p.coastOff, 190 + p.coastOff, zr);
    let land = -37 + n(xr, zr, p.fx, p.fz, 8);
    land += kopje(x, z, p.kopjes[0].x, p.kopjes[0].z, p.kopjes[0].r, p.kopjes[0].h);
    return land * (1 - water) + -46 * water;
  }
  return -42;
}

export function paramsForMission(mission) {
  const id = mission.seed || mission.id || 1;
  const p = makeParams(id * 31 + (mission.region || '').length * 17 + String(mission.theater || 'x').charCodeAt(0));
  if (mission.terrain === 'city') p.hasRiver = true;
  return p;
}
