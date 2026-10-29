import { COMBAT, FLIGHT } from './constants.js';
import { forwardFromEuler } from './flight.js';

export function dist3(ax, ay, az, bx, by, bz) {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  return Math.hypot(dx, dy, dz);
}

export function dist2(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

export function bulletHits(bx, by, bz, cx, cy, cz, radius) {
  return dist3(bx, by, bz, cx, cy, cz) <= radius;
}

export function segmentHitsSphere(ax, ay, az, bx, by, bz, cx, cy, cz, radius) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const abLen2 = abx * abx + aby * aby + abz * abz;
  let t = abLen2 > 1e-8 ? (acx * abx + acy * aby + acz * abz) / abLen2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = ax + abx * t - cx;
  const dy = ay + aby * t - cy;
  const dz = az + abz * t - cz;
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function bombHitsTarget(bx, bz, tx, tz, radius = COMBAT.BOMB_RADIUS) {
  return dist2(bx, bz, tx, tz) < radius;
}

export function inGunCone(forward, toTarget, range = COMBAT.FIRE_RANGE, cone = COMBAT.FIRE_CONE) {
  const dist = Math.hypot(toTarget.x, toTarget.y, toTarget.z);
  if (dist > range || dist < 0.001) return false;
  const dot = (forward.x * toTarget.x + forward.y * toTarget.y + forward.z * toTarget.z) / dist;
  return dot > cone;
}

export function spawnBullet(origin, forward, owner, team, playerShot) {
  const speed = playerShot ? COMBAT.BULLET_SPEED_PLAYER : COMBAT.BULLET_SPEED_AI;
  return {
    x: origin.x + forward.x * (playerShot ? 3 : 2.2),
    y: origin.y + (playerShot ? 0.25 : 0),
    z: origin.z + forward.z * (playerShot ? 3 : 2.2),
    vx: forward.x * speed,
    vy: forward.y * speed,
    vz: forward.z * speed,
    life: playerShot ? COMBAT.BULLET_LIFE_PLAYER : COMBAT.BULLET_LIFE_AI,
    owner,
    team,
    playerShot: Boolean(playerShot),
  };
}

export function stepBullet(b, dt) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.life -= dt;
}

export function spawnBomb(origin, owner) {
  const fwd = forwardFromEuler(origin.heading || 0, origin.pitch || 0);
  const speed = origin.speed || FLIGHT.BASE_SPEED;
  const inherit = COMBAT.BOMB_INHERIT;
  return {
    x: origin.x + fwd.x * 1.6,
    y: origin.y - 1.5,
    z: origin.z + fwd.z * 1.6,
    vx: fwd.x * speed * inherit,
    vy: fwd.y * speed * inherit - 12,
    vz: fwd.z * speed * inherit,
    life: COMBAT.BOMB_LIFE,
    owner,
  };
}

export function stepBomb(b, dt) {
  b.vy -= COMBAT.BOMB_GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  b.life -= dt;
}

export function predictLanding(bomb, sampleHeight, maxT = 8) {
  const b = { x: bomb.x, y: bomb.y, z: bomb.z, vx: bomb.vx, vy: bomb.vy, vz: bomb.vz, life: bomb.life };
  const dt = 1 / 60;
  for (let t = 0; t < maxT; t += dt) {
    stepBomb(b, dt);
    const gy = sampleHeight(b.x, b.z);
    if (b.y <= gy + 2 || b.life <= 0) return { x: b.x, y: gy, z: b.z, t };
  }
  return null;
}

export function predictBombImpact(origin, sampleHeight, maxT = 8) {
  return predictLanding(spawnBomb(origin, 'pred'), sampleHeight, maxT);
}

export function creditKill(lastHitBy, fallbackId) {
  return lastHitBy || fallbackId || null;
}

export const GROUND = {
  truck: { health: 2, hitR: 5.6, bombR: 40, lift: 2.2, speed: 11 },
  troops: { health: 2, hitR: 7.2, bombR: 44, lift: 1.6, speed: 5.1 },
  trench: { health: 3, hitR: 11, bombR: 54, lift: 1.15, speed: 0 },
  aa: { health: 3, hitR: 5.4, bombR: 40, lift: 3.1, speed: 0 },
  camp: { health: 2, hitR: 7, bombR: 44, lift: 2.2, speed: 0 },
  depot: { health: 1, hitR: 4.2, bombR: 48, lift: 3.5, speed: 0 },
  hangar: { health: 1, hitR: 6, bombR: 50, lift: 4.4, speed: 0 },
  wireless: { health: 1, hitR: 4, bombR: 42, lift: 11, speed: 0 },
  ship: { health: 1, hitR: 7, bombR: 48, lift: 5.2, speed: 0 },
  gunboat: { health: 1, hitR: 8, bombR: 50, lift: 5.2, speed: 0 },
  boat: { health: 1, hitR: 5, bombR: 38, lift: 2.4, speed: 0 },
};

export function groundSpec(kind) {
  return GROUND[kind] || GROUND.depot;
}

export function isStrafeable(kind) {
  return kind === 'truck' || kind === 'troops' || kind === 'trench' || kind === 'aa' || kind === 'camp';
}

export function isConvoy(kind) {
  return kind === 'truck' || kind === 'troops';
}

export function stepConvoy(state, dt, bounds = 520) {
  const speed = state.speed || 0;
  if (speed <= 0) return state;
  let heading = state.heading || 0;
  state.x += -Math.sin(heading) * speed * dt;
  state.z += -Math.cos(heading) * speed * dt;
  if (Math.hypot(state.x, state.z) > bounds) {
    heading += Math.PI;
    state.heading = heading;
  }
  return state;
}

export function aaFireDir(from, to, spread = 0.18) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const x = dx / len + (Math.random() - 0.5) * spread;
  const y = dy / len + (Math.random() - 0.5) * spread * 0.45;
  const z = dz / len + (Math.random() - 0.5) * spread;
  const n = Math.hypot(x, y, z) || 1;
  return { x: x / n, y: y / n, z: z / n, dist: len };
}
