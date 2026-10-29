import * as THREE from 'three';
import { makeParams, heightAt as terrainHeightAt, setHeightParams, paramsForMission, riverCenterZ, riverDistance, canalDistance, roadDistance, siteBlocked } from './sim/height.js';

const SIZE = 2400;
const HORIZON = 14000;
const SEG = 192;
const SKY_R = 8200;

function saturate(v) {
  return Math.min(1, Math.max(0, v));
}

function posmod(v, m) {
  return ((v % m) + m) % m;
}

function smoothstep(e0, e1, x) {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function hash2(ix, iz) {
  const s = Math.sin(ix * 127.1 + iz * 311.7 + params.seed * 19.17) * 43758.5453123;
  return s - Math.floor(s);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(ix, iz), hash2(ix + 1, iz), u), lerp(hash2(ix, iz + 1), hash2(ix + 1, iz + 1), u), v);
}

function fbm(x, z) {
  return noise2(x, z) * 0.5 + noise2(x * 2.03, z * 1.97) * 0.25 + noise2(x * 4.11, z * 3.93) * 0.125 + noise2(x * 8.07, z * 7.89) * 0.0625;
}

function mix3(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

let params = makeParams(1);
setHeightParams(params);

function worldXZ(x, z) {
  return {
    x: x * params.cos - z * params.sin,
    z: x * params.sin + z * params.cos,
  };
}

function fromRotated(rx, rz) {
  return {
    x: rx * params.cos + rz * params.sin,
    z: -rx * params.sin + rz * params.cos,
  };
}

function strokeWorldCurve(ctx, W, sampleOther, alongX, width, color, alpha, worldSpan = SIZE) {
  ctx.beginPath();
  let started = false;
  const span = worldSpan * 0.98;
  const step = 18;
  if (alongX) {
    for (let rx = -span; rx <= span; rx += step) {
      const wpos = fromRotated(rx, sampleOther(rx));
      const u = (wpos.x / worldSpan + 0.5) * W;
      const v = (wpos.z / worldSpan + 0.5) * W;
      if (!started) {
        ctx.moveTo(u, v);
        started = true;
      } else ctx.lineTo(u, v);
    }
  } else {
    for (let rz = -span; rz <= span; rz += step) {
      const wpos = fromRotated(sampleOther(rz), rz);
      const u = (wpos.x / worldSpan + 0.5) * W;
      const v = (wpos.z / worldSpan + 0.5) * W;
      if (!started) {
        ctx.moveTo(u, v);
        started = true;
      } else ctx.lineTo(u, v);
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.stroke();
}

export function heightAt(x, z, terrain = 'fields') {
  return terrainHeightAt(x, z, terrain, params);
}

function slopeAt(x, z, terrain) {
  const h = heightAt(x, z, terrain);
  return Math.abs(heightAt(x + 10, z, terrain) - h) + Math.abs(heightAt(x, z + 10, terrain) - h);
}

function landTexture(terrain, worldSpan = SIZE, resolution) {
  const W = resolution || (terrain === 'mountains' || terrain === 'city' || terrain === 'town' || terrain === 'sea' || terrain === 'island' ? 1024 : 2048);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, W);
  const d = img.data;
  const fieldA = [78, 112, 42];
  const fieldB = [58, 94, 36];
  const wheat = [196, 158, 58];
  const hedge = [36, 58, 28];
  const dirt = [138, 104, 62];
  const trench = [78, 68, 52];
  const grassHill = [80, 104, 54];
  const rock = [118, 112, 100];
  const rockDark = [78, 74, 68];
  const snow = [226, 230, 228];
  const sand = [194, 176, 128];
  const shallows = [70, 118, 120];
  const savA = [142, 126, 60];
  const savB = [108, 118, 50];
  const savC = [168, 134, 70];
  const jungA = [32, 72, 34];
  const jungB = [48, 90, 42];
  const jungC = [26, 54, 30];
  const roofTerra = [148, 82, 54];
  const roofSlate = [86, 90, 96];
  const roofSoot = [92, 88, 82];
  const plaza = [164, 152, 126];
  const park = [72, 98, 50];
  const street = [86, 82, 76];

  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const wx = (px / W - 0.5) * worldSpan;
      const wz = (py / W - 0.5) * worldSpan;
      const needH = terrain !== 'fields';
      const h = needH ? heightAt(wx, wz, terrain) : -42;
      const needSlope = terrain !== 'fields' && terrain !== 'sea' && terrain !== 'town' && terrain !== 'city';
      const sl = needSlope ? slopeAt(wx, wz, terrain) : 0;
      const wr = worldXZ(wx, wz);
      const rx = wr.x;
      const rz = wr.z;
      const grain = fbm(wx * 0.045, wz * 0.045);
      const speck = hash2(px, py);
      const fx = Math.floor((rx + 1800) / params.patchW);
      const fz = Math.floor((rz + 1800) / params.patchH);
      const fieldPick = hash2(fx, fz);
      let col;
      if (terrain === 'mountains') {
        const snowAmt = smoothstep(16, 38, h);
        const cliff = saturate(sl / 22);
        col = mix3(mix3(grassHill, rock, saturate(sl / 10)), rockDark, cliff);
        col = mix3(col, snow, snowAmt * (1 - cliff * 0.45));
        col = mix3(col, rock, grain * 0.18);
      } else if (terrain === 'coast') {
        const wet = smoothstep(-44, -38, h);
        const beach = 1 - smoothstep(-38, -28, h);
        let land = mix3(fieldA, fieldB, fieldPick * 0.7 + grain * 0.3);
        if (fieldPick > 0.72) land = mix3(land, wheat, 0.8);
        if (fieldPick > 0.55 && fieldPick < 0.72) land = mix3(land, jungB, 0.35);
        col = mix3(land, sand, beach);
        col = mix3(col, shallows, 1 - wet);
        if (sl > 8) col = mix3(col, rock, saturate((sl - 8) / 14));
      } else if (terrain === 'hills') {
        col = mix3([68, 96, 46], [128, 138, 68], hash2(fx * 3, fz) * 0.65 + grain * 0.35);
        if (hash2(fx + 2, fz + 5) > 0.7) col = mix3(col, wheat, 0.7);
        col = mix3(col, dirt, saturate(sl / 14) * 0.8);
        col = mix3(col, rock, saturate((sl - 9) / 14));
        if (h < -32) col = mix3(col, [58, 86, 42], 0.5);
        const hedgeH = Math.min(posmod(rx + 1800, 118), 118 - posmod(rx + 1800, 118));
        col = mix3(col, hedge, (1 - smoothstep(2.4, 7.8, hedgeH)) * (sl < 10 ? 0.92 : 0.22));
      } else if (terrain === 'sea' || terrain === 'island') {
        col = h > -40 ? mix3([86, 112, 58], sand, grain * 0.45) : mix3(shallows, [24, 56, 68], grain);
        if (h > -36) col = mix3(col, rock, 0.32);
        if (h < -44) col = mix3(col, [18, 48, 60], 0.4);
        if (terrain === 'island' && h > -38) col = mix3(col, jungB, 0.45 + grain * 0.2);
      } else if (terrain === 'desert') {
        const dune = fbm(rx * 0.007, rz * 0.009);
        const rip = 0.5 + 0.5 * Math.sin(rx * 0.09 + rz * 0.34 + dune * 5.2);
        const rip2 = 0.5 + 0.5 * Math.sin(rx * 0.31 - rz * 0.08 + params.phase);
        const band = 0.5 + 0.5 * Math.sin(rz * 0.018 + rx * 0.006 + params.phase);
        col = mix3([168, 124, 72], [226, 186, 118], 0.18 + 0.7 * rip);
        col = mix3(col, [240, 214, 154], rip2 * 0.4);
        col = mix3(col, [148, 108, 64], band * 0.34);
        col = mix3(col, [186, 142, 86], noise2(px * 0.42, py * 0.4) * 0.24);
        const grainRip = 0.5 + 0.5 * Math.sin(py * 1.15 + px * 0.12 + rip * 4);
        col = mix3(col, [col[0] * 0.68, col[1] * 0.7, col[2] * 0.6], grainRip * 0.22);
        if (sl > 6) col = mix3(col, rockDark, saturate((sl - 6) / 14) * 0.72);
        const rail = Math.abs(rz - Math.sin(rx * 0.004 + params.phase) * 20);
        col = mix3(col, [72, 64, 54], 1 - smoothstep(1.2, 4.2, rail));
      } else if (terrain === 'savanna') {
        col = mix3(savA, savB, fieldPick * 0.6 + grain * 0.4);
        if (fieldPick > 0.78) col = mix3(col, savC, 0.7);
        col = mix3(col, [90, 78, 48], saturate(sl / 18) * 0.6);
        if (h > -28) col = mix3(col, rock, 0.45);
        const track = Math.abs(rx - Math.cos(rz * 0.007) * 40);
        col = mix3(col, dirt, 1 - smoothstep(1.1, 3.8, track));
      } else if (terrain === 'jungle') {
        col = mix3(jungA, jungB, fieldPick * 0.5 + grain * 0.5);
        if (speck > 0.7) col = mix3(col, jungC, 0.55);
      } else if (terrain === 'lake') {
        const wet = smoothstep(-44, -38, h);
        col = mix3(savB, savA, fieldPick * 0.55 + grain * 0.45);
        col = mix3(col, sand, 1 - smoothstep(-38, -30, h));
        col = mix3(col, shallows, 1 - wet);
      } else if (terrain === 'town') {
        const dist = Math.hypot(rx - params.cityX, rz - params.cityZ);
        col = mix3(fieldA, plaza, 0.18 + grain * 0.12);
        const blockX = Math.abs(((rx - params.cityX + 40) % 36) - 18);
        const blockZ = Math.abs(((rz - params.cityZ + 20) % 32) - 16);
        const inTown = 1 - smoothstep(140, 230, dist);
        const roofPick = fieldPick > 0.55 ? roofSlate : roofTerra;
        col = mix3(col, roofPick, (1 - smoothstep(8, 12, Math.max(blockX, blockZ))) * inTown * 0.85);
        col = mix3(col, dirt, Math.max(1 - smoothstep(0.8, 3.2, blockX), 1 - smoothstep(0.8, 3.2, blockZ)) * inTown);
        col = mix3(col, plaza, (1 - smoothstep(18, 34, dist)) * 0.7);
      } else if (terrain === 'city') {
        const dx = wx - params.cityX;
        const dz = wz - params.cityZ;
        const cr = Math.cos(-params.cityRot);
        const sr = Math.sin(-params.cityRot);
        const lx = dx * cr - dz * sr;
        const lz = dx * sr + dz * cr;
        const dist = Math.hypot(dx, dz);
        const cityAmt = 1 - smoothstep(220, 460, dist);
        const stride = 22 + (params.seed % 5);
        const bx = Math.abs(((lx + 800) % stride) - stride / 2);
        const bz = Math.abs(((lz + 800) % (stride + 4)) - (stride + 4) / 2);
        const blockX = Math.floor((lx + 800) / stride);
        const blockZ = Math.floor((lz + 800) / (stride + 4));
        const blockPick = hash2(blockX, blockZ);
        let roofCol = blockPick < 0.34 ? roofTerra : blockPick < 0.62 ? roofSlate : blockPick < 0.82 ? roofSoot : plaza;
        if (blockPick > 0.9) roofCol = park;
        const streetAmt = Math.max(1 - smoothstep(2.4, 5.4, bx), 1 - smoothstep(2.4, 5.4, bz));
        const court = (1 - smoothstep(2, 6, Math.hypot(bx - stride * 0.18, bz - 3))) * (blockPick > 0.74 ? 0.55 : 0);
        const country = mix3(mix3(fieldA, fieldB, grain), wheat, fieldPick * 0.25);
        col = mix3(country, roofCol, cityAmt * (1 - streetAmt) * 0.94);
        col = mix3(col, street, streetAmt * cityAmt);
        col = mix3(col, plaza, court * cityAmt);
        col = mix3(col, plaza, (1 - smoothstep(12, 28, dist)) * 0.55);
        if (h < -43.5) col = mix3(col, shallows, saturate((-43.5 - h) / 1.6));
        if (h < -44.8) col = mix3([22, 54, 66], shallows, grain);
      } else {
        const warp = fbm(rx * 0.0024, rz * 0.0024) * 9;
        const warp2 = fbm(rx * 0.0048 + 9, rz * 0.0046) * 7;
        const cellW = params.patchW * 1.92;
        const cellH = params.patchH * 1.86;
        const fx2 = Math.floor((rx + 1800 + warp) / cellW);
        const fz2 = Math.floor((rz + 1800 + warp2) / cellH);
        const pick2 = hash2(fx2, fz2);
        const meadow = [52, 118, 40];
        const lush = [118, 168, 52];
        const darkGreen = [36, 82, 32];
        const gold = [214, 168, 52];
        const brown = [156, 108, 52];
        const pale = [198, 178, 88];
        const clay = [176, 120, 58];
        col =
          pick2 < 0.12
            ? meadow
            : pick2 < 0.28
              ? lush
              : pick2 < 0.42
                ? darkGreen
                : pick2 < 0.62
                  ? gold
                  : pick2 < 0.76
                    ? brown
                    : pick2 < 0.88
                      ? pale
                      : clay;
        const localX = posmod(rx + 1800 + warp, cellW);
        const localZ = posmod(rz + 1800 + warp2, cellH);
        const furrowDir = pick2 > 0.5 ? localZ : localX;
        const furrow = 0.5 + 0.5 * Math.sin(furrowDir * (pick2 > 0.7 ? 0.52 : 0.78));
        if (pick2 >= 0.42) col = mix3(col, [col[0] * 0.62, col[1] * 0.64, col[2] * 0.55], furrow * 0.38);
        else col = mix3(col, [col[0] * 0.82, col[1] * 0.88, col[2] * 0.74], (1 - furrow) * 0.2);
        const borderX = Math.min(localX, cellW - localX);
        const borderZ = Math.min(localZ, cellH - localZ);
        const hedgeAmt = Math.max(1 - smoothstep(2.4, 7.2, borderX), 1 - smoothstep(2.2, 6.6, borderZ));
        col = mix3(col, hedge, hedgeAmt * 0.94);
        const road = roadDistance(wx, wz);
        col = mix3(col, dirt, (1 - smoothstep(2.4, 9.5, road)) * 0.94);
        const ditch = canalDistance(wx, wz);
        col = mix3(col, trench, 1 - smoothstep(2.2, 8.5, ditch));
        if (ditch < 5) col = mix3(col, [48, 92, 96], saturate(1 - ditch / 5) * 0.85);
        const river = riverDistance(wx, wz);
        const ham = Math.hypot(((rx + 400) % 150) - 75, ((rz + 280) % 128) - 64);
        if (ham < 22 && pick2 > 0.28 && road > 16 && river > 28) col = mix3(col, roofTerra, (1 - ham / 22) * 0.82);
      }
      col = mix3(col, [col[0] * 0.78, col[1] * 0.82, col[2] * 0.72], noise2(px * 0.7, py * 0.66) * 0.12 + speck * 0.07);
      const i = (py * W + px) * 4;
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  paintAerialParcels(ctx, W, terrain, worldSpan);
  stampWaterways(ctx, W, terrain, worldSpan);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function metresPx(metres, W, worldSpan) {
  return (metres / worldSpan) * W;
}

function paintAerialParcels(ctx, W, terrain, worldSpan = SIZE) {
  if (terrain === 'desert') {
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x = hash2(i, params.seed + 3) * W;
      ctx.beginPath();
      ctx.moveTo(x, -8);
      ctx.bezierCurveTo(
        x + (hash2(i, 4) - 0.5) * 80,
        W * 0.28,
        x + (hash2(i, 5) - 0.5) * 110,
        W * 0.62,
        x + (hash2(i, 6) - 0.5) * 70,
        W + 8,
      );
      ctx.strokeStyle = i % 3 === 0 ? '#c9a56a' : i % 3 === 1 ? '#8a6840' : '#e2c48a';
      ctx.globalAlpha = 0.18 + hash2(i, 7) * 0.16;
      ctx.lineWidth = 6 + hash2(i, 8) * 22;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = hash2(i, params.seed + 8) > 0.5 ? '#f0d9a8' : '#7a5a32';
      ctx.fillRect(hash2(i, 30) * W, hash2(i, 31) * W, 1, 1);
    }
    ctx.globalAlpha = 1;
    return;
  }
  if (terrain !== 'fields' && terrain !== 'hills' && terrain !== 'coast') return;
  const palette =
    terrain === 'hills'
      ? ['#4a6c28', '#8a9a44', '#c4a85a', '#5e7c34', '#b08a44', '#3e5c24', '#9a8c50', '#6e8840']
      : terrain === 'coast'
        ? ['#5a8234', '#c2ae6a', '#7a9844', '#b89a58', '#3f6624', '#d0c08a', '#6e7c40', '#a07840']
        : ['#3a6c1c', '#8fb544', '#d4b246', '#2c5416', '#c49234', '#6aa030', '#e2c460', '#254818', '#a07430', '#7cac3c', '#c8bc78', '#4e7828'];
  const cellW = 150;
  const cellH = 171;
  const half = worldSpan * 0.52;
  const i0 = Math.floor(-half / cellW) - 1;
  const i1 = Math.ceil(half / cellW) + 1;
  const j0 = Math.floor(-half / cellH) - 1;
  const j1 = Math.ceil(half / cellH) + 1;
  const hedgePx = Math.max(1.1, metresPx(4.2, W, worldSpan));
  ctx.globalAlpha = 1;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const wx = i * cellW;
      const wz = j * cellH;
      const u = (wx / worldSpan + 0.5) * W;
      const v = (wz / worldSpan + 0.5) * W;
      const rw = metresPx(cellW, W, worldSpan) * (0.98 + hash2(i, j + 11) * 0.16);
      const rh = metresPx(cellH, W, worldSpan) * (0.96 + hash2(i + 2, j) * 0.18);
      const ox = (hash2(i + 40, j + params.seed) - 0.5) * rw * 0.16;
      const oz = (hash2(i + 9, j + 4) - 0.5) * rh * 0.14;
      ctx.save();
      ctx.translate(u + ox, v + oz);
      ctx.rotate((hash2(i, j + 6) - 0.5) * 0.05);
      ctx.fillStyle = palette[Math.abs((i * 13 + j * 7 + (params.seed | 0)) % palette.length)];
      ctx.fillRect(-rw / 2, -rh / 2, rw, rh);
      ctx.strokeStyle = '#1a2812';
      ctx.lineWidth = hedgePx;
      ctx.strokeRect(-rw / 2, -rh / 2, rw, rh);
      if (rw > 22) {
        ctx.beginPath();
        ctx.rect(-rw / 2, -rh / 2, rw, rh);
        ctx.clip();
        const ploughed = hash2(i, j + 14) > 0.38;
        ctx.strokeStyle = ploughed ? 'rgba(92,68,28,0.38)' : 'rgba(28,48,18,0.3)';
        ctx.lineWidth = 1.2;
        const gap = 3.6 + hash2(i, j + 18) * 2.4;
        if (hash2(i, j + 3) > 0.5) {
          for (let yy = -rh / 2; yy < rh / 2; yy += gap) {
            ctx.beginPath();
            ctx.moveTo(-rw / 2, yy);
            ctx.lineTo(rw / 2, yy);
            ctx.stroke();
          }
        } else {
          for (let xx = -rw / 2; xx < rw / 2; xx += gap) {
            ctx.beginPath();
            ctx.moveTo(xx, -rh / 2);
            ctx.lineTo(xx, rh / 2);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
  }
  ctx.globalAlpha = 0.16;
  const speckle = worldSpan > SIZE * 1.5 ? 4000 : 9000;
  for (let i = 0; i < speckle; i++) {
    ctx.fillStyle = hash2(i, params.seed + 8) > 0.5 ? '#efe3b4' : '#1c3224';
    ctx.fillRect(hash2(i, 30) * W, hash2(i, 31) * W, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function strokePolyline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

function riverStrokePoints(W, worldSpan) {
  const span = worldSpan * 0.5;
  const pts = [];
  for (let rx = -span; rx <= span; rx += 14) {
    const wpos = fromRotated(rx, riverCenterZ(rx));
    pts.push([(wpos.x / worldSpan + 0.5) * W, (wpos.z / worldSpan + 0.5) * W]);
  }
  return pts;
}

function stampRiverPath(ctx, W, worldSpan) {
  const pts = riverStrokePoints(W, worldSpan);
  const m = (metres, minPx) => Math.max(minPx, metresPx(metres, W, worldSpan));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#4e6434';
  ctx.lineWidth = m(42, 2);
  strokePolyline(ctx, pts);
  ctx.strokeStyle = '#8a7348';
  ctx.lineWidth = m(24, 2.2);
  strokePolyline(ctx, pts);
  ctx.strokeStyle = '#1c6284';
  ctx.lineWidth = m(15, 2.8);
  strokePolyline(ctx, pts);
  ctx.strokeStyle = '#164e68';
  ctx.lineWidth = m(7, 1.5);
  strokePolyline(ctx, pts);
  ctx.restore();
}

function stampWaterways(ctx, W, terrain, worldSpan = SIZE) {
  if (terrain === 'sea' || terrain === 'island' || terrain === 'desert' || terrain === 'mountains' || terrain === 'lake') return;
  const img = ctx.getImageData(0, 0, W, W);
  const d = img.data;
  const hasCanal = terrain === 'fields' || terrain === 'hills' || terrain === 'town' || terrain === 'coast' || terrain === 'savanna';
  const dirt = [138, 104, 62];
  const trench = [78, 68, 52];
  if (terrain !== 'city') {
    for (let py = 0; py < W; py++) {
      for (let px = 0; px < W; px++) {
        const wx = (px / W - 0.5) * worldSpan;
        const wz = (py / W - 0.5) * worldSpan;
        const i = (py * W + px) * 4;
        let col = [d[i], d[i + 1], d[i + 2]];
        const road = roadDistance(wx, wz);
        col = mix3(col, dirt, (1 - smoothstep(2.4, 10, road)) * 0.94);
        if (hasCanal) {
          const ditch = canalDistance(wx, wz);
          col = mix3(col, trench, 1 - smoothstep(2.4, 11, ditch));
          if (ditch < 6) col = mix3(col, [48, 92, 96], saturate(1 - ditch / 6) * 0.88);
        }
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  stampRiverPath(ctx, W, worldSpan);
}

function bumpTexture(kind = 'fields') {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, W);
  for (let i = 0; i < W * W; i++) {
    const px = i % W;
    const py = (i / W) | 0;
    let v;
    if (kind === 'desert') {
      v = 128 + Math.sin(py * 0.95 + Math.sin(px * 0.08) * 4.2) * 72 + fbm(px * 0.14, py * 0.12) * 36;
    } else if (kind === 'fields' || kind === 'hills' || kind === 'coast') {
      v = 128 + Math.sin(py * 1.55) * 64 + noise2(px * 0.4, py * 0.4) * 26;
    } else {
      v = fbm(px * 0.12, py * 0.12) * 210 + noise2(px * 0.4, py * 0.4) * 40;
    }
    const o = i * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.max(0, Math.min(255, v)) | 0;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const tiles = kind === 'desert' ? 56 : kind === 'fields' || kind === 'hills' || kind === 'coast' ? 42 : 24;
  t.repeat.set(tiles, tiles);
  t.anisotropy = 8;
  return t;
}

function groundDetailTexture(kind = 'fields') {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, W);
  const d = img.data;
  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const n = noise2(px * 0.37, py * 0.35);
      const n2 = noise2(px * 0.9 + 4, py * 0.86);
      if (kind === 'desert') {
        const rip = 0.5 + 0.5 * Math.sin(py * 0.88 + Math.sin(px * 0.09) * 3.1);
        const g = 0.62 + n * 0.22 + rip * 0.22 + n2 * 0.08;
        d[i] = Math.min(255, g * 1.12 * 255);
        d[i + 1] = Math.min(255, g * 0.9 * 255);
        d[i + 2] = Math.min(255, g * 0.62 * 255);
      } else if (kind === 'jungle') {
        const g = 0.72 + n * 0.2 + n2 * 0.1;
        d[i] = g * 0.55 * 255;
        d[i + 1] = g * 255;
        d[i + 2] = g * 0.48 * 255;
      } else {
        const streak = 0.5 + 0.5 * Math.sin(py * 2.15 + n * 3);
        const g = 0.7 + n * 0.18 + streak * 0.16 + n2 * 0.08;
        d[i] = Math.min(255, g * 0.9 * 255);
        d[i + 1] = Math.min(255, g * 255);
        d[i + 2] = Math.min(255, g * 0.55 * 255);
      }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function attachGroundDetail(mat, repeat) {
  const u = {
    detailMap: { value: groundDetailTexture('fields') },
    detailRepeat: { value: repeat },
    detailAmt: { value: 0.5 },
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = u.detailMap;
    shader.uniforms.detailRepeat = u.detailRepeat;
    shader.uniforms.detailAmt = u.detailAmt;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D detailMap;
uniform float detailRepeat;
uniform float detailAmt;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
#ifdef USE_MAP
  vec3 dtl = texture2D(detailMap, vMapUv * detailRepeat).rgb;
  diffuseColor.rgb *= mix(vec3(1.0), dtl * 1.12, detailAmt);
#endif
`,
      );
  };
  mat.customProgramCacheKey = () => 'ground-detail-v1';
  return u;
}

function waterTexture() {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const x = c.getContext('2d');
  x.fillStyle = '#1a4452';
  x.fillRect(0, 0, W, W);
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(${50 + i * 2},${100 + i},${110 + i},0.14)`;
    x.lineWidth = 1 + (i % 3) * 0.4;
    x.beginPath();
    for (let p = 0; p <= W; p += 6) {
      const y = ((i * 17 + p * 0.42 + Math.sin(p * 0.09 + i) * 7) % W);
      if (p === 0) x.moveTo(p, y);
      else x.lineTo(p, y);
    }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  t.anisotropy = 4;
  return t;
}

function waterNormalTexture() {
  const W = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, W);
  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const n1 = noise2(px * 0.08, py * 0.08);
      const n2 = noise2(px * 0.17 + 8, py * 0.15);
      const nx = (n1 - 0.5) * 2;
      const ny = (n2 - 0.5) * 2;
      const i = (py * W + px) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 14);
  return t;
}

function makeDetailTexture(kind) {
  const W = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = W;
  const ctx = c.getContext('2d');
  if (kind === 'plaster') {
    ctx.fillStyle = '#d4c8b0';
    ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(90,80,60,${0.04 + Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * W, Math.random() * W, 1.5, 1.5);
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const x = 10 + col * 30;
        const y = 12 + row * 40;
        ctx.fillStyle = '#1e2c34';
        ctx.fillRect(x, y, 13, 20);
        ctx.fillStyle = 'rgba(180,200,210,0.22)';
        ctx.fillRect(x + 1, y + 1, 6, 8);
        ctx.fillStyle = '#c4b89a';
        ctx.fillRect(x - 1, y + 20, 15, 2);
      }
    }
  } else if (kind === 'brick') {
    ctx.fillStyle = '#5a3832';
    ctx.fillRect(0, 0, W, W);
    for (let row = 0; row < 10; row++) {
      const odd = row % 2;
      for (let col = -1; col < 9; col++) {
        ctx.fillStyle = odd ? '#8a5648' : '#7a4c40';
        if ((col + row) % 5 === 0) ctx.fillStyle = '#6a4038';
        ctx.fillRect(col * 16 + (odd ? 8 : 0) + 1, row * 13 + 1, 14, 11);
      }
    }
  } else if (kind === 'tile') {
    ctx.fillStyle = '#6a3a2e';
    ctx.fillRect(0, 0, W, W);
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 10; col++) {
        ctx.fillStyle = (col + row) % 2 ? '#8a4e38' : '#7a4432';
        const x = col * 14 + (row % 2) * 7;
        const y = row * 11;
        ctx.beginPath();
        ctx.moveTo(x + 7, y);
        ctx.lineTo(x + 14, y + 8);
        ctx.lineTo(x + 7, y + 14);
        ctx.lineTo(x, y + 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (kind === 'foliage') {
    ctx.fillStyle = '#2f5a30';
    ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#4a7a3a' : i % 3 === 1 ? '#2a5230' : '#3a6a34';
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * W, 4 + Math.random() * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'bark') {
    ctx.fillStyle = '#4a3428';
    ctx.fillRect(0, 0, W, W);
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = `rgba(${40 + i * 4},${28 + i},${18},0.45)`;
      ctx.lineWidth = 2 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(i * 8, 0);
      ctx.quadraticCurveTo(i * 8 + 6, 64, i * 8 - 4, 128);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(0, 0, W, W);
    for (let y = 0; y < W; y += 2) {
      ctx.fillStyle = y % 4 === 0 ? 'rgba(90,85,70,0.12)' : 'rgba(255,255,240,0.08)';
      ctx.fillRect(0, y, W, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

function skyEnvTexture(zenithHex, horizonHex) {
  const W = 256;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const zenith = new THREE.Color(zenithHex);
  const horizon = new THREE.Color(horizonHex);
  const ground = horizon.clone().multiplyScalar(0.42);
  const img = ctx.createImageData(W, H);
  for (let py = 0; py < H; py++) {
    const v = py / (H - 1);
    let r;
    let g;
    let b;
    if (v < 0.5) {
      const t = v / 0.5;
      const k = t * t;
      r = lerp(zenith.r, horizon.r, k);
      g = lerp(zenith.g, horizon.g, k);
      b = lerp(zenith.b, horizon.b, k);
    } else {
      const t = (v - 0.5) / 0.5;
      r = lerp(horizon.r, ground.r, t);
      g = lerp(horizon.g, ground.g, t);
      b = lerp(horizon.b, ground.b, t);
    }
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      img.data[i] = r * 255;
      img.data[i + 1] = g * 255;
      img.data[i + 2] = b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.needsUpdate = true;
  return t;
}

const WEATHER = {
  clear: { sky: 0x8eb8cc, zenith: 0x4a86c4, horizon: 0xd6e4ee, fog: 0xc5d4dc, fogD: 0.00034, hemi: 1.65, sun: 2.7, exposure: 1.08, clouds: 0.82, env: 0.62, cloud: 0xeef2f6, lowSun: false },
  haze: { sky: 0xb7c6c0, zenith: 0x8aa49c, horizon: 0xd4dcd0, fog: 0xc5d0c8, fogD: 0.00155, hemi: 1.4, sun: 1.85, exposure: 1.0, clouds: 0.66, env: 0.42, cloud: 0xe8eadf, lowSun: false },
  overcast: { sky: 0x7d8b90, zenith: 0x6a767c, horizon: 0x9aa4a8, fog: 0x8b9698, fogD: 0.0017, hemi: 1.15, sun: 0.85, exposure: 0.9, clouds: 0.9, env: 0.28, cloud: 0xd8dce0, lowSun: false },
  rain: { sky: 0x6a767c, zenith: 0x58646c, horizon: 0x7e8a90, fog: 0x738086, fogD: 0.002, hemi: 1.05, sun: 0.7, exposure: 0.86, clouds: 0.5, env: 0.22, cloud: 0xc8ced2, lowSun: false },
  fog: { sky: 0x9aa7a4, zenith: 0x8a9694, horizon: 0xc4ccc8, fog: 0xb0bbb6, fogD: 0.0038, hemi: 1.2, sun: 0.75, exposure: 0.92, clouds: 0.28, env: 0.18, cloud: 0xd8dcd8, lowSun: false },
  storm: { sky: 0x4e5a62, zenith: 0x36424a, horizon: 0x6a767c, fog: 0x5a666c, fogD: 0.0025, hemi: 0.85, sun: 0.38, exposure: 0.78, clouds: 0.35, env: 0.16, cloud: 0x9aa4aa, lowSun: false },
  dusk: { sky: 0xd07848, zenith: 0x2a3a6a, horizon: 0xffb070, fog: 0xc88858, fogD: 0.0013, hemi: 1.12, sun: 2.2, exposure: 1.08, clouds: 0.74, env: 0.52, cloud: 0xf3d2a8, lowSun: true },
  dawn: { sky: 0xc48a62, zenith: 0x3a5a8a, horizon: 0xf0c48a, fog: 0xd4b090, fogD: 0.00105, hemi: 1.28, sun: 2.45, exposure: 1.1, clouds: 0.78, env: 0.58, cloud: 0xf6e0c0, lowSun: true },
  heat: { sky: 0xc9d6a8, zenith: 0x6aa4c4, horizon: 0xead8a8, fog: 0xd7c89a, fogD: 0.00135, hemi: 1.8, sun: 2.9, exposure: 1.14, clouds: 0.3, env: 0.55, cloud: 0xf0ead8, lowSun: false },
  dust: { sky: 0xc4a878, zenith: 0x8a7a54, horizon: 0xd8bc88, fog: 0xc8ae7a, fogD: 0.0028, hemi: 1.35, sun: 2.0, exposure: 1.02, clouds: 0.18, env: 0.3, cloud: 0xe8d4b0, lowSun: false },
};

const pineTrunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7);
const pineCrownGeo = new THREE.ConeGeometry(1.7, 3.8, 8);
const pineCrownBGeo = new THREE.SphereGeometry(1.45, 8, 6);
const leafCrownGeo = new THREE.SphereGeometry(1.85, 8, 6);
const acaciaTrunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 3.2, 6);
const acaciaCrownGeo = new THREE.SphereGeometry(1.9, 8, 6);
const palmTrunkGeo = new THREE.CylinderGeometry(0.11, 0.2, 5.2, 6);
const palmCrownGeo = new THREE.ConeGeometry(2.05, 1.7, 8);
const baobabTrunkGeo = new THREE.CylinderGeometry(0.9, 1.15, 4.2, 8);
const baobabCrownGeo = new THREE.SphereGeometry(1.7, 8, 6);
const rockGeo = new THREE.IcosahedronGeometry(1.45, 1);

const barkMap = makeDetailTexture('bark');
const foliageMap = makeDetailTexture('foliage');
const plasterMap = makeDetailTexture('plaster');
const brickMap = makeDetailTexture('brick');
const tileMap = makeDetailTexture('tile');
plasterMap.repeat.set(2, 2);
brickMap.repeat.set(2, 2);
tileMap.repeat.set(3, 3);
foliageMap.repeat.set(2, 2);

const pineTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6a5340, map: barkMap, roughness: 0.95 });
const pineCrownMat = new THREE.MeshStandardMaterial({ color: 0x5c8a3e, map: foliageMap, roughness: 0.86 });
const pineCrownMat2 = new THREE.MeshStandardMaterial({ color: 0x6a9a46, map: foliageMap, roughness: 0.84 });
const leafCrownMat = new THREE.MeshStandardMaterial({ color: 0x5c9a40, map: foliageMap, roughness: 0.84 });
const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x4a7034, map: foliageMap, roughness: 0.9 });
const earthMat = new THREE.MeshStandardMaterial({ color: 0x514d3b, roughness: 1 });
const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x9a8d6e, roughness: 0.95 });
const stripMat = new THREE.MeshStandardMaterial({ color: 0x877c62, roughness: 1 });
const smokeMat = new THREE.MeshLambertMaterial({ color: 0x3a3834, transparent: true, opacity: 0.38, depthWrite: false });
const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6a28, transparent: true, opacity: 0.72, depthWrite: false });
const hedgeGeo = new THREE.BoxGeometry(2.6, 2.3, 18);
const smokePuffGeo = new THREE.SphereGeometry(2.6, 8, 6);
const acaciaTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6a5640, map: barkMap, roughness: 0.96 });
const acaciaCrownMat = new THREE.MeshStandardMaterial({ color: 0x7a9a42, map: foliageMap, roughness: 0.84 });
const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x7a6450, map: barkMap, roughness: 0.92 });
const palmCrownMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3c, map: foliageMap, roughness: 0.82 });
const baobabTrunkMat = new THREE.MeshStandardMaterial({ color: 0x8a7a62, map: barkMap, roughness: 0.96 });
const baobabCrownMat = new THREE.MeshStandardMaterial({ color: 0x6a8438, map: foliageMap, roughness: 0.88 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7468, roughness: 0.92, envMapIntensity: 0.2 });
const desertRockMat = new THREE.MeshStandardMaterial({ color: 0x8a7358, roughness: 0.94, envMapIntensity: 0.15 });
const barnMat = new THREE.MeshStandardMaterial({ color: 0x9a6a4a, map: brickMap, roughness: 0.88 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x6a4a38, map: tileMap, roughness: 0.86 });
const tileRoofMat = new THREE.MeshStandardMaterial({ color: 0xb06a4a, map: tileMap, roughness: 0.78, envMapIntensity: 0.25 });
const plasterMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc6, map: plasterMap, roughness: 0.86, envMapIntensity: 0.18 });
const tinMat = new THREE.MeshStandardMaterial({ color: 0x8a9090, roughness: 0.38, metalness: 0.55, envMapIntensity: 0.7 });
const hutMat = new THREE.MeshStandardMaterial({ color: 0xb08958, roughness: 0.94 });
const thatchMat = new THREE.MeshStandardMaterial({ color: 0x9a7a3a, roughness: 1 });
const brickMat = new THREE.MeshStandardMaterial({ color: 0xb07a62, map: brickMap, roughness: 0.9 });
const sootMat = new THREE.MeshStandardMaterial({ color: 0x6a6864, roughness: 0.82, metalness: 0.12, envMapIntensity: 0.3 });
const slateMat = new THREE.MeshStandardMaterial({ color: 0x5a6570, map: tileMap, roughness: 0.72, envMapIntensity: 0.3 });
const dummy = new THREE.Object3D();

function makeHouse(w, d, h, wall, roof, pitched = true) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
  body.position.y = h / 2;
  g.add(body);
  if (pitched) {
    const top = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.62, 4), roof);
    top.rotation.y = Math.PI / 4;
    top.position.y = h + h * 0.22;
    g.add(top);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, h * 0.45, 0.7), sootMat);
    chimney.position.set(w * 0.22, h + h * 0.42, d * 0.12);
    g.add(chimney);
  } else {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.38, d + 0.8), roof);
    top.position.y = h + 0.22;
    g.add(top);
  }
  return g;
}

function makeChurch() {
  const g = makeHouse(6.2, 9.4, 5.2, plasterMat, slateMat, true);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(2.6, 9.5, 2.6), plasterMat);
  tower.position.set(0, 4.8, -4.2);
  g.add(tower);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.7, 5.2, 4), slateMat);
  spire.position.set(0, 12.2, -4.2);
  g.add(spire);
  return g;
}

export function createWorld(scene, { sun, hemi, renderer, fill, rim }) {
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const bump = bumpTexture('fields');
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    bumpMap: bump,
    bumpScale: 1.25,
    envMapIntensity: 0.16,
  });
  const terrainDetail = attachGroundDetail(terrainMat, 84);
  const terrain = new THREE.Mesh(geo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  const horizonGeo = new THREE.PlaneGeometry(HORIZON, HORIZON, 96, 96);
  horizonGeo.rotateX(-Math.PI / 2);
  const horizonMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.93,
    metalness: 0,
    bumpMap: bump,
    bumpScale: 0.9,
    envMapIntensity: 0.14,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const horizonDetail = attachGroundDetail(horizonMat, 84 * (HORIZON / SIZE));
  const horizon = new THREE.Mesh(horizonGeo, horizonMat);
  horizon.receiveShadow = true;
  scene.add(horizon);

  const skyGeo = new THREE.SphereGeometry(SKY_R, 40, 24);
  skyGeo.scale(-1, 1, 1);
  const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, side: THREE.FrontSide }),
  );
  sky.renderOrder = -10;
  scene.add(sky);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(38, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffc078, fog: false, depthWrite: false, transparent: true, opacity: 0.96 }),
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(92, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9a48, fog: false, depthWrite: false, transparent: true, opacity: 0.18 }),
  );
  sunHalo.renderOrder = -8;
  scene.add(sunHalo);
  sunDisc.renderOrder = -9;
  scene.add(sunDisc);

  const waterGeo = new THREE.PlaneGeometry(HORIZON, HORIZON, 48, 48);
  waterGeo.rotateX(-Math.PI / 2);
  const waterNrm = waterNormalTexture();
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: 0x2e6a78,
      map: waterTexture(),
      normalMap: waterNrm,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.14,
      metalness: 0.62,
      envMapIntensity: 1.15,
      transparent: true,
      opacity: 0.9,
    }),
  );
  water.position.y = -45.2;
  water.visible = false;
  if (water.material.map) water.material.map.repeat.set(48, 48);
  if (water.material.normalMap) water.material.normalMap.repeat.set(48, 48);
  scene.add(water);

  const props = new THREE.Group();
  scene.add(props);
  const colliders = [];

  function addCollider(x, y, z, r, h, kind) {
    colliders.push({ x, y, z, r, h, kind });
  }

  function hitObstacle(x, y, z, planeR = 2.8) {
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const lim = c.r + planeR;
      if (dx * dx + dz * dz > lim * lim) continue;
      if (y < c.y - 1) continue;
      if (y > c.y + c.h) continue;
      return c;
    }
    return null;
  }

  const rainGeo = new THREE.BufferGeometry();
  const rainCount = 420;
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 90;
    rainPos[i * 3 + 1] = Math.random() * 50;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0xb7c4cc, size: 0.18, transparent: true, opacity: 0.55 }),
  );
  rain.visible = false;
  scene.add(rain);

  let terrainType = 'fields';
  let weatherId = 'clear';
  let wind = 0;
  let gfx = 'HIGH';
  const smokes = [];

  if (sun) {
    scene.add(sun.target);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -240;
    sun.shadow.camera.right = 240;
    sun.shadow.camera.top = 240;
    sun.shadow.camera.bottom = -240;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 720;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 2.2;
  }

  function clearProps() {
    smokes.length = 0;
    colliders.length = 0;
    while (props.children.length) {
      const child = props.children[0];
      props.remove(child);
    }
  }

  function placeTreeGrid(kind, treeN, style, maxSlope, dense) {
    const trunkGeo = style === 'acacia' ? acaciaTrunkGeo : style === 'palm' ? palmTrunkGeo : pineTrunkGeo;
    const crownGeo = style === 'acacia' ? acaciaCrownGeo : style === 'palm' ? palmCrownGeo : style === 'leaf' ? leafCrownGeo : pineCrownGeo;
    const trunkMat = style === 'acacia' ? acaciaTrunkMat : style === 'palm' ? palmTrunkMat : pineTrunkMat;
    const crownMat = style === 'acacia' ? acaciaCrownMat : style === 'palm' ? palmCrownMat : style === 'leaf' ? leafCrownMat : pineCrownMat;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeN);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeN);
    let extra = null;
    if (style === 'pine') extra = new THREE.InstancedMesh(pineCrownBGeo, pineCrownMat2, treeN);
    trunks.castShadow = crowns.castShadow = dense;
    trunks.frustumCulled = crowns.frustumCulled = false;
    if (extra) {
      extra.castShadow = dense;
      extra.frustumCulled = false;
    }
    let placed = 0;
    const cells = Math.ceil(Math.sqrt(treeN * 1.8));
    const skip = style === 'palm' ? 0.38 : style === 'acacia' ? 0.72 : kind === 'fields' ? 0.78 : 0.62;
    for (let iz = 0; iz < cells && placed < treeN; iz++) {
      for (let ix = 0; ix < cells && placed < treeN; ix++) {
        const x = (ix / cells - 0.5) * 980 + (hash2(ix, iz) - 0.5) * 28;
        const z = (iz / cells - 0.5) * 980 + (hash2(iz, ix + 3) - 0.5) * 28;
        const y = heightAt(x, z, kind);
        if (y < -44.5) continue;
        if (kind === 'mountains' && y > 18) continue;
        if ((kind === 'coast' || kind === 'lake') && y < -40) continue;
        if (siteBlocked(x, z, kind)) continue;
        if (slopeAt(x, z, kind) > maxSlope) continue;
        if (hash2(ix + 11, iz + 19) > skip) continue;
        const s = style === 'palm'
          ? 2.2 + hash2(placed, 21) * 3.4
          : style === 'acacia'
            ? 2.0 + hash2(placed, 21) * 3.8
            : 2.4 + hash2(placed, 21) * 4.6;
        dummy.position.set(x, y + (style === 'palm' ? 2.4 : 1.1) * s, z);
        dummy.rotation.set((hash2(placed, 4) - 0.5) * 0.18, hash2(placed, 7) * 6, (hash2(placed, 5) - 0.5) * 0.12);
        dummy.scale.set(s * (0.92 + hash2(placed, 11) * 0.18), s, s * (0.92 + hash2(placed, 13) * 0.18));
        dummy.updateMatrix();
        trunks.setMatrixAt(placed, dummy.matrix);
        if (style === 'acacia') {
          dummy.position.y = y + 3.4 * s;
          dummy.scale.set(s * 1.7, s * 0.42, s * 1.7);
        } else if (style === 'palm') {
          dummy.position.y = y + 5.1 * s;
          dummy.scale.set(s * 1.3, s * 0.7, s * 1.3);
          dummy.rotation.x = 0.15;
        } else if (style === 'leaf') {
          dummy.position.y = y + 2.4 * s;
          dummy.scale.set(s * 1.45, s * (0.85 + hash2(placed, 3) * 0.45), s * 1.45);
        } else {
          dummy.position.y = y + 2.8 * s;
          dummy.scale.set(s * 1.15, s * (1.05 + hash2(placed, 3) * 0.5), s * 1.15);
        }
        dummy.updateMatrix();
        crowns.setMatrixAt(placed, dummy.matrix);
        if (extra) {
          dummy.position.y = y + 3.8 * s;
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(s * 0.72);
          dummy.updateMatrix();
          extra.setMatrixAt(placed, dummy.matrix);
        }
        addCollider(x, y, z, Math.max(2.6, s * 1.7), s * 6.5, 'tree');
        placed++;
      }
    }
    trunks.count = crowns.count = placed;
    const tint = new THREE.Color();
    const crownCols = new Float32Array(placed * 3);
    for (let i = 0; i < placed; i++) {
      const shade = 0.82 + hash2(i, 29) * 0.28;
      tint.setRGB(shade, shade * (0.95 + hash2(i, 31) * 0.1), shade * 0.88);
      crownCols[i * 3] = tint.r;
      crownCols[i * 3 + 1] = tint.g;
      crownCols[i * 3 + 2] = tint.b;
    }
    crowns.instanceColor = new THREE.InstancedBufferAttribute(crownCols, 3);
    crowns.instanceColor.needsUpdate = true;
    props.add(trunks, crowns);
    if (extra) {
      extra.count = placed;
      extra.instanceColor = new THREE.InstancedBufferAttribute(crownCols, 3);
      props.add(extra);
    }
  }

  function placeRocks(kind, rockN, dense) {
    const mat = kind === 'desert' ? desertRockMat : rockMat;
    const rocks = new THREE.InstancedMesh(rockGeo, mat, rockN);
    rocks.castShadow = dense;
    rocks.frustumCulled = false;
    for (let i = 0; i < rockN; i++) {
      const x = (hash2(i + 40, 18) - 0.5) * 820;
      const z = (hash2(i + 8, 33) - 0.5) * 820;
      const y = heightAt(x, z, kind);
      if (y < -44.5) continue;
      const s = 0.8 + hash2(i, 5) * (kind === 'desert' ? 3.6 : 2.4);
      dummy.position.set(x, y + 0.4 * s, z);
      dummy.rotation.set(hash2(i, 1) * 2, hash2(i, 2) * 6, hash2(i, 3) * 2);
      dummy.scale.set(s, s * (0.5 + hash2(i, 6) * 0.8), s);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    props.add(rocks);
  }

  function placeBaobabs(kind, n, dense) {
    for (let i = 0; i < n; i++) {
      const x = (hash2(i + 200, 4) - 0.5) * 700;
      const z = (hash2(i + 19, 8) - 0.5) * 700;
      const y = heightAt(x, z, kind);
      if (y < -43 || siteBlocked(x, z, kind)) continue;
      const s = 1.6 + hash2(i, 9) * 1.8;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(baobabTrunkGeo, baobabTrunkMat);
      trunk.position.y = 2.1;
      trunk.castShadow = dense;
      const crown = new THREE.Mesh(baobabCrownGeo, baobabCrownMat);
      crown.position.y = 4.6;
      crown.scale.set(1.4, 0.7, 1.4);
      g.add(trunk, crown);
      g.position.set(x, y, z);
      g.scale.setScalar(s);
      g.rotation.y = hash2(i, 3) * 6;
      addCollider(x, y, z, s * 3.2, s * 6, 'tree');
      props.add(g);
    }
  }

  function placeBarns(kind, count, dense) {
    for (let i = 0; i < count; i++) {
      const x = (hash2(i + 90, 2) - 0.5) * 520;
      const z = (hash2(i + 17, 6) - 0.5) * 520;
      const y = heightAt(x, z, kind);
      if (y < -44.5 || siteBlocked(x, z, kind)) continue;
      const house = makeHouse(11, 6.4, 4.4, barnMat, roofMat, false);
      house.children[0].castShadow = dense;
      house.position.set(x, y, z);
      house.rotation.y = hash2(i, 12) * 6;
      addCollider(x, y, z, 7.2, 8.5, 'building');
      props.add(house);
    }
  }

  function placeHamlets(kind, n, dense) {
    for (let i = 0; i < n; i++) {
      let ox = (hash2(i + 50, 1) - 0.5) * 640;
      let oz = (hash2(i + 7, 14) - 0.5) * 640;
      for (let t = 0; t < 8 && siteBlocked(ox, oz, kind); t++) {
        ox += (hash2(i, t + 40) - 0.5) * 70;
        oz += (hash2(t, i + 41) - 0.5) * 70;
      }
      if (siteBlocked(ox, oz, kind)) continue;
      const houses = 6 + ((hash2(i, 3) * 7) | 0);
      const church = makeChurch();
      const cy = heightAt(ox, oz, kind);
      if (cy > -43) {
        church.position.set(ox, cy, oz);
        church.rotation.y = hash2(i, 21) * 6;
        church.traverse((c) => {
          if (c.isMesh) c.castShadow = dense;
        });
        addCollider(ox, cy, oz, 8.5, 16, 'building');
        props.add(church);
      }
      for (let h = 0; h < houses; h++) {
        const x = ox + (hash2(h, i + 2) - 0.5) * 38;
        const z = oz + (hash2(i, h + 4) - 0.5) * 32;
        const y = heightAt(x, z, kind);
        if (y < -43 || siteBlocked(x, z, kind)) continue;
        const roof = hash2(h, 9) > 0.55 ? tileRoofMat : slateMat;
        const house = makeHouse(5.6 + hash2(h, 2) * 4.2, 4.8 + hash2(h, 5) * 3, 3.1 + hash2(h, 8) * 2.4, plasterMat, roof, true);
        house.position.set(x, y, z);
        house.rotation.y = hash2(h, 12) * 6;
        house.traverse((c) => {
          if (c.isMesh) c.castShadow = dense;
        });
        addCollider(x, y, z, 5.2, 8, 'building');
        props.add(house);
      }
    }
  }

  function placeHedges(kind, n, dense) {
    const mesh = new THREE.InstancedMesh(hedgeGeo, hedgeMat, n);
    mesh.castShadow = dense;
    mesh.frustumCulled = false;
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i++) {
      const x = (hash2(i + 3, 8) - 0.5) * 720;
      const z = (hash2(i + 11, 2) - 0.5) * 720;
      const y = heightAt(x, z, kind);
      if (y < -43 || siteBlocked(x, z, kind)) continue;
      dummy.position.set(x, y + 1.05, z);
      dummy.rotation.set(0, hash2(i, 9) > 0.5 ? 0 : Math.PI / 2, 0);
      dummy.scale.set(1, 0.75 + hash2(i, 4) * 0.55, 0.7 + hash2(i, 6) * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    props.add(mesh);
  }

  function placeTrenches(kind, n) {
    for (let t = 0; t < n; t++) {
      const x = (hash2(t + 19, 2) - 0.5) * 520;
      const z = (hash2(t + 4, 8) - 0.5) * 520;
      const y = heightAt(x, z, kind);
      if (y < -42.5) continue;
      const group = new THREE.Group();
      const length = 70 + hash2(t, 1) * 70;
      for (let i = 0; i < 8; i++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(length / 8, 1.2, 3.4), earthMat);
        seg.position.set((i - 3.5) * (length / 8), -0.1, i % 2 ? 2.1 : -2.1);
        seg.rotation.y = i % 2 ? -0.08 : 0.08;
        group.add(seg);
        const bags = new THREE.Mesh(new THREE.BoxGeometry(length / 8 - 0.6, 0.45, 1.15), sandbagMat);
        bags.position.set((i - 3.5) * (length / 8), 0.55, i % 2 ? 2.1 : -2.1);
        group.add(bags);
      }
      group.position.set(x, y + 0.25, z);
      group.rotation.y = hash2(t, 5) * Math.PI * 2;
      props.add(group);
    }
  }

  function placeAirfield(kind) {
    const x = -220;
    const z = 48;
    const y = heightAt(x, z, kind);
    if (y < -43) return;
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(22, 110), stripMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, y + 0.16, z);
    strip.receiveShadow = true;
    props.add(strip);
    for (const hz of [-28, 18]) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(28, 10, 18), barnMat);
      body.position.y = 5;
      g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 20), sootMat);
      roof.position.y = 10.4;
      g.add(roof);
      const opening = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshStandardMaterial({ color: 0x282b29 }));
      opening.position.set(0, 4, 9.1);
      g.add(opening);
      g.position.set(x - 32, y, z + hz);
      g.rotation.y = Math.PI / 2;
      addCollider(x - 32, y, z + hz, 16, 12, 'building');
      props.add(g);
    }
  }

  function placeSmoke(kind, n) {
    for (let i = 0; i < n; i++) {
      const x = (hash2(i + 120, 6) - 0.5) * 680;
      const z = (hash2(i + 33, 9) - 0.5) * 680;
      const y = heightAt(x, z, kind);
      if (y < -44) continue;
      const g = new THREE.Group();
      g.userData.phase = hash2(i, 41) * 6;
      const fire = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), fireMat);
      fire.position.y = 1.1;
      g.add(fire);
      for (let k = 0; k < 9; k++) {
        const puff = new THREE.Mesh(smokePuffGeo, smokeMat);
        puff.position.y = 2.6 + k * 4.2;
        puff.scale.set(1.1 + k * 0.28, 0.7, 1.1 + k * 0.28);
        g.add(puff);
      }
      g.position.set(x, y, z);
      g.scale.setScalar(1.25 + hash2(i, 7) * 1.6);
      props.add(g);
      smokes.push(g);
    }
  }

  function placeTown(kind, dense) {
    const ox = params.cityX * 0.35 + 18;
    const oz = params.cityZ * 0.35 - 12;
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        if (row === 2 && col > 1 && col < 4) continue;
        const x = ox + (col - 2.5) * 22 + (hash2(col, row) - 0.5) * 3;
        const z = oz + (row - 2) * 20 + (hash2(row, col) - 0.5) * 3;
        const y = heightAt(x, z, kind);
        if (y < -43.5 || siteBlocked(x, z, kind)) continue;
        const w = 8 + hash2(col, row + 2) * 5;
        const d = 6 + hash2(row, col + 4) * 3;
        const h = 4 + hash2(col + 1, row) * 3;
        const house = makeHouse(w, d, h, plasterMat, tinMat, false);
        house.position.set(x, y, z);
        house.rotation.y = (hash2(col, row) > 0.5 ? 0 : Math.PI / 2) + (hash2(row, col) - 0.5) * 0.08;
        house.traverse((c) => {
          if (c.isMesh) c.castShadow = dense;
        });
        addCollider(x, y, z, Math.max(w, d) * 0.55, h + 4, 'building');
        props.add(house);
      }
    }
    const church = makeHouse(10, 14, 8, plasterMat, tileRoofMat, true);
    church.position.set(ox, heightAt(ox, oz, kind), oz);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 10, 6), tileRoofMat);
    spire.position.y = 16;
    church.add(spire);
    addCollider(ox, heightAt(ox, oz, kind), oz, 10, 18, 'building');
    props.add(church);
  }

  function placeAfricanStation(kind, dense) {
    const spots = [[40, -30], [-50, 60], [90, 40], [-20, -90]];
    spots.forEach(([sx, sz], i) => {
      const y = heightAt(sx, sz, kind);
      if (y < -44 || siteBlocked(sx, sz, kind)) return;
      const warehouse = makeHouse(14, 8, 4.2, plasterMat, tinMat, false);
      warehouse.position.set(sx, y, sz);
      warehouse.rotation.y = i * 0.4;
      addCollider(sx, y, sz, 9, 9, 'building');
      props.add(warehouse);
      for (let h = 0; h < 3; h++) {
        const hut = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 3.2, 8), hutMat);
        body.position.y = 1.6;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.8, 8), thatchMat);
        roof.position.y = 4.2;
        hut.add(body, roof);
        hut.position.set(sx + 12 + h * 9, y, sz + (h - 1) * 8);
        addCollider(sx + 12 + h * 9, y, sz + (h - 1) * 8, 4.2, 7, 'building');
        props.add(hut);
      }
      if (dense) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 9, 8), tinMat);
        tower.position.set(sx - 10, y + 4.5, sz + 6);
        props.add(tower);
      }
    });
  }

  function placeBomas(kind, n) {
    for (let i = 0; i < n; i++) {
      const x = (hash2(i + 70, 5) - 0.5) * 480;
      const z = (hash2(i + 11, 9) - 0.5) * 480;
      const y = heightAt(x, z, kind);
      if (y < -43 || siteBlocked(x, z, kind)) continue;
      for (let h = 0; h < 4; h++) {
        const ang = (h / 4) * Math.PI * 2;
        const hut = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 2.8, 8), hutMat);
        body.position.y = 1.4;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2.4, 8), thatchMat);
        roof.position.y = 3.6;
        hut.add(body, roof);
        hut.position.set(x + Math.cos(ang) * 7, y, z + Math.sin(ang) * 7);
        addCollider(x + Math.cos(ang) * 7, y, z + Math.sin(ang) * 7, 3.6, 6, 'building');
        props.add(hut);
      }
    }
  }

  function placeCity(kind, dense) {
    const ox = params.cityX;
    const oz = params.cityZ;
    const cr = Math.cos(params.cityRot);
    const sr = Math.sin(params.cityRot);
    const rows = dense ? 9 : 6;
    const cols = dense ? 11 : 7;
    const pitch = 18 + (params.seed % 5);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (row === ((params.seed + 3) % rows) && col > 2 && col < cols - 3) continue;
        const lx = (col - (cols - 1) / 2) * pitch + (hash2(col, row) - 0.5) * 4;
        const lz = (row - (rows - 1) / 2) * (pitch - 2) + (hash2(row, col) - 0.5) * 4;
        const x = ox + lx * cr - lz * sr;
        const z = oz + lx * sr + lz * cr;
        const y = heightAt(x, z, kind);
        if (y < -43.8) continue;
        const industrial = hash2(col + params.seed, row) > 0.62;
        const tall = hash2(row, col + 9) > 0.72;
        const w = 8 + hash2(col, row + 2) * 7;
        const d = 7 + hash2(row, col + 4) * 5;
        const hgt = (tall ? 9 : 4.4) + hash2(col + 1, row) * (industrial ? 8 : 4);
        const wall = industrial ? sootMat : hash2(col, row + 7) > 0.5 ? brickMat : plasterMat;
        const roof = industrial ? tinMat : hash2(row, col) > 0.45 ? tileRoofMat : slateMat;
        const house = makeHouse(w, d, hgt, wall, roof, !industrial && !tall);
        house.position.set(x, y, z);
        house.rotation.y = params.cityRot + (hash2(row, col) > 0.5 ? 0 : Math.PI / 2);
        house.traverse((c) => {
          if (c.isMesh) c.castShadow = dense;
        });
        addCollider(x, y, z, Math.max(w, d) * 0.55, hgt + 4, 'building');
        props.add(house);
        if (industrial && dense) {
          const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 14 + hash2(col, 3) * 10, 8), sootMat);
          stack.position.set(x + 4, y + 10, z + 3);
          stack.castShadow = dense;
          props.add(stack);
        }
      }
    }
    const church = makeHouse(12, 18, 10, plasterMat, tileRoofMat, true);
    church.position.set(ox, heightAt(ox, oz, kind), oz);
    church.rotation.y = params.cityRot;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 6), tileRoofMat);
    spire.position.y = 22;
    church.add(spire);
    addCollider(ox, heightAt(ox, oz, kind), oz, 12, 24, 'building');
    props.add(church);
  }

  function placeBoats(kind, n) {
    for (let i = 0; i < n; i++) {
      const x = (hash2(i + 310, 4) - 0.5) * 700;
      const z = (hash2(i + 18, 11) - 0.5) * 700;
      const y = heightAt(x, z, kind);
      if (y > -44.2 && kind !== 'sea') continue;
      const barge = hash2(i, 2) > 0.55;
      const g = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(barge ? 11 : 7.5, barge ? 1.6 : 1.2, barge ? 3.6 : 2.6),
        sootMat,
      );
      hull.position.y = barge ? 0.9 : 0.7;
      g.add(hull);
      if (!barge) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5.5, 6), pineTrunkMat);
        mast.position.y = 3.4;
        g.add(mast);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), plasterMat);
        sail.position.set(0.2, 3.2, 0);
        g.add(sail);
      } else {
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 2.4), tinMat);
        cabin.position.set(-1.5, 1.8, 0);
        g.add(cabin);
      }
      g.position.set(x, -45.05, z);
      g.rotation.y = hash2(i, 8) * 6;
      props.add(g);
    }
  }

  function placeHarbour(kind, dense) {
    const ox = params.cityX * 0.4 + params.coastOff;
    const oz = params.cityZ * 0.3;
    for (let i = 0; i < (dense ? 5 : 3); i++) {
      const x = ox + i * 16;
      const z = oz + (hash2(i, 4) - 0.5) * 10;
      const y = heightAt(x, z, kind);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 3.2), sootMat);
      pier.position.set(x, Math.max(y, -44.8) + 0.4, z);
      pier.rotation.y = params.rot * 0.15;
      props.add(pier);
    }
  }

  function scatter(kind) {
    clearProps();
    const dense = gfx === 'HIGH';
    if (kind === 'sea' || kind === 'island') {
      placeRocks(kind, dense ? 28 : 10, dense);
      placeTreeGrid(kind, dense ? (kind === 'island' ? 90 : 24) : (kind === 'island' ? 32 : 8), kind === 'island' ? 'palm' : 'pine', 18, dense);
      placeBoats(kind, dense ? 14 : 7);
      return;
    }
    if (kind === 'desert') {
      placeTreeGrid(kind, dense ? 36 : 12, 'acacia', 28, dense);
      placeRocks(kind, dense ? 80 : 28, dense);
      placeAfricanStation(kind, dense);
    } else if (kind === 'savanna') {
      placeTreeGrid(kind, dense ? 110 : 40, 'acacia', 22, dense);
      placeBaobabs(kind, dense ? 9 : 4, dense);
      placeRocks(kind, dense ? 36 : 14, dense);
      placeBomas(kind, dense ? 6 : 3);
      placeAfricanStation(kind, dense);
    } else if (kind === 'jungle') {
      placeTreeGrid(kind, dense ? 260 : 90, 'palm', 20, dense);
      placeRocks(kind, 8, dense);
      placeAfricanStation(kind, dense);
    } else if (kind === 'lake') {
      placeTreeGrid(kind, dense ? 90 : 32, 'acacia', 22, dense);
      placeRocks(kind, dense ? 24 : 10, dense);
      placeAfricanStation(kind, dense);
      placeBoats(kind, dense ? 8 : 4);
    } else if (kind === 'town') {
      placeTreeGrid(kind, dense ? 64 : 18, 'pine', 16, dense);
      placeTown(kind, dense);
      placeBarns(kind, dense ? 4 : 2, dense);
      placeHedges(kind, dense ? 28 : 10, dense);
      placeSmoke(kind, dense ? 3 : 1);
    } else if (kind === 'city') {
      placeCity(kind, dense);
      placeTreeGrid(kind, dense ? 48 : 14, 'pine', 14, dense);
      placeBarns(kind, dense ? 5 : 2, dense);
      placeSmoke(kind, dense ? 5 : 2);
      if (params.hasRiver) placeBoats(kind, dense ? 8 : 4);
    } else {
      const treeN = kind === 'mountains' ? (dense ? 110 : 36) : kind === 'hills' ? (dense ? 140 : 55) : (dense ? 95 : 40);
      const rockN = kind === 'mountains' ? (dense ? 90 : 36) : kind === 'hills' ? (dense ? 40 : 16) : 12;
      const maxSlope = kind === 'hills' ? 26 : kind === 'mountains' ? 18 : 16;
      placeTreeGrid(kind, treeN, kind === 'fields' || kind === 'hills' || kind === 'coast' ? 'leaf' : 'pine', maxSlope, dense);
      placeRocks(kind, rockN, dense);
      if (kind === 'fields' || kind === 'hills' || kind === 'coast') {
        placeBarns(kind, dense ? 16 : 6, dense);
        placeHamlets(kind, dense ? 11 : 5, dense);
        placeHedges(kind, dense ? 90 : 28, dense);
        placeTrenches(kind, dense ? 7 : 3);
        placeAirfield(kind);
        placeSmoke(kind, dense ? 8 : 3);
      }
      if (kind === 'coast') {
        placeHarbour(kind, dense);
        placeBoats(kind, dense ? 10 : 5);
      }
    }
  }

  function paintVertexColors(kind) {
    const pos = terrain.geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const sl = slopeAt(x, z, kind);
      let r = 1;
      let g = 1;
      let b = 1;
      if (kind === 'mountains') {
        const snow = saturate((y - 18) / 22);
        const cliff = saturate(sl / 20);
        r = lerp(0.92, 1.05, snow) * lerp(1, 0.72, cliff);
        g = lerp(0.95, 1.04, snow) * lerp(1, 0.72, cliff);
        b = lerp(0.88, 1.06, snow) * lerp(1, 0.7, cliff);
      } else if ((kind === 'coast' || kind === 'lake' || kind === 'jungle' || kind === 'city') && y < -40) {
        r = 0.55;
        g = 0.78;
        b = 0.82;
      } else if ((kind === 'fields' || kind === 'town' || kind === 'hills' || kind === 'savanna' || kind === 'jungle' || kind === 'city' || kind === 'coast') && riverDistance(x, z) < 16) {
        r = 0.42;
        g = 0.74;
        b = 0.9;
      } else if (kind === 'sea' && y > -40) {
        r = 0.78;
        g = 0.82;
        b = 0.62;
      } else if (kind === 'desert') {
        r = lerp(1.05, 0.78, saturate(sl / 18));
        g = lerp(0.95, 0.7, saturate(sl / 18));
        b = lerp(0.72, 0.55, saturate(sl / 18));
      } else if (sl > 10) {
        const t = saturate((sl - 10) / 16);
        r = lerp(1, 0.78, t);
        g = lerp(1, 0.74, t);
        b = lerp(1, 0.68, t);
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    terrain.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainMat.vertexColors = true;
  }

  function tintBiome(kind) {
    if (kind === 'desert') {
      hemi.color.set(0xffe2b0);
      hemi.groundColor.set(0xb8894a);
    } else if (kind === 'savanna' || kind === 'lake') {
      hemi.color.set(0xfff1c8);
      hemi.groundColor.set(0x8a7a48);
    } else if (kind === 'jungle') {
      hemi.color.set(0xe8f0c8);
      hemi.groundColor.set(0x3d5a32);
    } else if (kind === 'city') {
      hemi.color.set(0xd6e4ee);
      hemi.groundColor.set(0x6a6458);
    } else {
      hemi.color.set(0xd9efff);
      hemi.groundColor.set(0x6c6b4a);
    }
    if (kind === 'lake') water.material.color.set(0x2a6a78);
    else if (kind === 'jungle') water.material.color.set(0x2d5a48);
    else if (kind === 'city') water.material.color.set(0x3a6874);
    else water.material.color.set(0x3a7a86);
    terrainMat.bumpScale = kind === 'desert' ? 3.4 : kind === 'fields' || kind === 'hills' || kind === 'coast' ? 1.85 : kind === 'mountains' ? 1.05 : 0.9;
    horizonMat.bumpScale = terrainMat.bumpScale * 0.75;
  }

  function sculpt(kind) {
    terrainType = kind;
    const pos = terrain.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, heightAt(pos.getX(i), pos.getZ(i), kind));
    }
    pos.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    const hp = horizon.geometry.attributes.position;
    const inner = SIZE * 0.49;
    for (let i = 0; i < hp.count; i++) {
      const x = hp.getX(i);
      const z = hp.getZ(i);
      const hole = Math.abs(x) < inner && Math.abs(z) < inner;
      hp.setY(i, heightAt(x, z, kind) - (hole ? 1.2 : 0));
    }
    hp.needsUpdate = true;
    horizon.geometry.computeVertexNormals();
    paintVertexColors(kind);
    terrainMat.map?.dispose();
    terrainMat.map = landTexture(kind, SIZE);
    const aniso = renderer ? Math.min(16, renderer.capabilities.getMaxAnisotropy()) : 8;
    terrainMat.map.anisotropy = aniso;
    terrainMat.color.set(0xffffff);
    terrainMat.roughness = kind === 'desert' ? 0.96 : 0.92;
    terrainMat.needsUpdate = true;
    const nextBump = bumpTexture(kind);
    nextBump.anisotropy = aniso;
    terrainMat.bumpMap?.dispose();
    terrainMat.bumpMap = nextBump;
    horizonMat.bumpMap = nextBump;
    const nextDetail = groundDetailTexture(kind);
    nextDetail.anisotropy = aniso;
    terrainDetail.detailMap.value?.dispose();
    terrainDetail.detailMap.value = nextDetail;
    terrainDetail.detailRepeat.value = kind === 'desert' ? 64 : 52;
    terrainDetail.detailAmt.value = kind === 'desert' ? 0.84 : 0.5;
    horizonDetail.detailMap.value = nextDetail;
    horizonDetail.detailRepeat.value = terrainDetail.detailRepeat.value * (HORIZON / SIZE);
    horizonDetail.detailAmt.value = terrainDetail.detailAmt.value;
    horizonMat.map?.dispose();
    const hRes = kind === 'fields' || kind === 'hills' || kind === 'coast' ? 2048 : 1024;
    const hmap = landTexture(kind, HORIZON, hRes);
    hmap.wrapS = hmap.wrapT = THREE.ClampToEdgeWrapping;
    hmap.repeat.set(1, 1);
    hmap.anisotropy = aniso;
    hmap.needsUpdate = true;
    horizonMat.map = hmap;
    horizonMat.needsUpdate = true;
    water.visible = kind === 'sea' || kind === 'island' || kind === 'coast' || kind === 'lake';
    terrain.visible = true;
    horizon.visible = true;
    tintBiome(kind);
    scatter(kind);
  }

  function paintSky(w, id = 'clear') {
    const zenith = new THREE.Color(w.zenith);
    const horizon = new THREE.Color(w.horizon);
    const pos = sky.geometry.attributes.position;
    const col = sky.geometry.attributes.color;
    const golden = id === 'dusk' || id === 'dawn';
    for (let i = 0; i < pos.count; i++) {
      const ny = pos.getY(i) / SKY_R;
      const t = saturate(ny * 0.75 + 0.36);
      const k = t * t * (3 - 2 * t);
      let r = lerp(horizon.r, zenith.r, k);
      let g = lerp(horizon.g, zenith.g, k);
      let b = lerp(horizon.b, zenith.b, k);
      if (golden && ny < 0.24) {
        const glow = saturate(1 - Math.abs(ny - 0.05) / 0.2);
        r = lerp(r, 1.08, glow * (id === 'dusk' ? 0.72 : 0.5));
        g = lerp(g, 0.52, glow * 0.4);
        b = lerp(b, 0.2, glow * 0.24);
      }
      if (ny < 0.05) {
        const fade = saturate((0.05 - ny) / 0.16);
        r = lerp(r, horizon.r * 0.55, fade);
        g = lerp(g, horizon.g * 0.52, fade);
        b = lerp(b, horizon.b * 0.48, fade);
      }
      col.setXYZ(i, r, g, b);
    }
    col.needsUpdate = true;
  }

  function applyWeather(id) {
    weatherId = id;
    const w = WEATHER[id] || WEATHER.clear;
    scene.background = null;
    scene.fog = new THREE.FogExp2(w.fog, w.fogD);
    paintSky(w, id);
    if (scene.environment && scene.environment.isTexture) scene.environment.dispose();
    scene.environment = skyEnvTexture(w.zenith, w.horizon);
    scene.environmentIntensity = w.env ?? 0.5;
    hemi.intensity = w.hemi;
    sun.intensity = w.sun;
    renderer.toneMappingExposure = w.exposure;
    rain.visible = id === 'rain' || id === 'storm' || id === 'dust';
    rain.material.color.set(id === 'dust' ? 0xc4a06a : id === 'storm' ? 0x9aa8b0 : 0xb7c4cc);
    rain.material.size = id === 'dust' ? 0.32 : 0.18;
    wind = id === 'storm' ? 9 : id === 'dust' ? 7 : id === 'rain' ? 3.5 : id === 'overcast' ? 1.5 : id === 'heat' ? 2 : 0;
    if (id === 'dusk' || id === 'dawn') {
      sun.color.set(0xff8a48);
      hemi.color.set(0xffd0a0);
      if (fill) {
        fill.color.set(0xffc8a0);
        fill.intensity = 0.72;
      }
      if (rim) {
        rim.color.set(0xffe0b0);
        rim.intensity = 0.32;
      }
    } else if (id === 'heat' || id === 'dust') {
      sun.color.set(0xffd090);
      if (fill) {
        fill.color.set(0xffe0b8);
        fill.intensity = 0.42;
      }
      if (rim) {
        rim.color.set(0xfff0d0);
        rim.intensity = 0.2;
      }
    } else {
      sun.color.set(0xfff0d4);
      if (fill) {
        fill.color.set(0xc8dcec);
        fill.intensity = id === 'storm' || id === 'rain' ? 0.22 : 0.38;
      }
      if (rim) {
        rim.color.set(0xd8e8f4);
        rim.intensity = 0.16;
      }
    }
    sunDisc.material.color.set(id === 'dusk' || id === 'dawn' ? 0xff7a38 : 0xffe8b8);
    sunDisc.material.opacity = id === 'storm' || id === 'rain' || id === 'fog' ? 0.25 : 0.95;
    sunHalo.material.opacity = id === 'storm' || id === 'rain' || id === 'fog' ? 0.05 : id === 'dusk' || id === 'dawn' ? 0.28 : 0.12;
    return w;
  }

  function applyMission(mission) {
    params = paramsForMission(mission);
    setHeightParams(params);
    sculpt(mission.terrain);
    return applyWeather(mission.weather);
  }

  function setQuality(q) {
    gfx = q;
    scatter(terrainType);
  }

  function update(dt, player) {
    if (player) {
      sky.position.x = player.position.x;
      sky.position.z = player.position.z;
    }
    if (water.visible) {
      const t = performance.now() * 0.001;
      water.position.y = -45.2 + Math.sin(t * 1.15) * 0.22;
      const pos = water.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, Math.sin(x * 0.032 + t * 1.05) * 0.26 + Math.sin(z * 0.024 + t * 0.8) * 0.18);
      }
      pos.needsUpdate = true;
      if (water.material.map) water.material.map.offset.x += dt * 0.01;
      if (water.material.normalMap) {
        water.material.normalMap.offset.x += dt * 0.02;
        water.material.normalMap.offset.y += dt * 0.012;
      }
    }
    if (sun && player) {
      const low = weatherId === 'dusk' || weatherId === 'dawn';
      sun.target.position.lerp(player.position, 0.12);
      sun.position.set(player.position.x - (low ? 340 : 160), player.position.y + (low ? 78 : 220), player.position.z + (low ? 190 : 90));
      sunDisc.position.copy(sun.position).sub(player.position).setLength(1100).add(player.position);
      sunHalo.position.copy(sunDisc.position);
    }
    if (smokes.length) {
      const t = performance.now() * 0.001;
      for (const s of smokes) {
        s.rotation.y += dt * 0.08;
        s.children.forEach((c, i) => {
          c.position.x = Math.sin(t * 0.35 + s.userData.phase + i * 0.4) * (0.35 + i * 0.18);
          c.position.z = Math.cos(t * 0.28 + s.userData.phase + i) * (0.25 + i * 0.12);
        });
      }
    }
    if (rain.visible && player) {
      rain.position.copy(player.position);
      const arr = rain.geometry.attributes.position.array;
      const fall = weatherId === 'dust' ? 8 : weatherId === 'storm' ? 42 : 28;
      for (let i = 0; i < rainCount; i++) {
        arr[i * 3 + 1] -= dt * fall;
        arr[i * 3] -= dt * wind * (weatherId === 'dust' ? 1.1 : 0.4);
        if (arr[i * 3 + 1] < -8) {
          arr[i * 3 + 1] = 42;
          arr[i * 3] = (Math.random() - 0.5) * 90;
          arr[i * 3 + 2] = (Math.random() - 0.5) * 90;
        }
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
  }

  sculpt('fields');
  applyWeather('clear');

  return {
    terrain,
    water,
    rain,
    heightAt: (x, z) => heightAt(x, z, terrainType),
    hitObstacle,
    applyMission,
    applyWeather,
    setQuality,
    update,
    getWind: () => wind,
    getTerrain: () => terrainType,
    getWeather: () => weatherId,
  };
}
