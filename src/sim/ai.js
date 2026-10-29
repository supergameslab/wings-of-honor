import { clamp, angleDiff } from './math.js';
import { FLIGHT } from './constants.js';
import { COMBAT } from './constants.js';
import { forwardFromEuler, rightFromHeading, integrateFlight } from './flight.js';
import { aceById, applyAceSpec } from './aces.js';

export function createAiCraft(spawn, spec) {
  const ace = spawn.ace ? aceById(spawn.ace) : null;
  const tuned = applyAceSpec(spec, ace);
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    heading: spawn.heading ?? Math.PI,
    pitch: 0,
    roll: 0,
    health: spawn.health ?? tuned.enemyHp,
    maxHealth: spawn.health ?? tuned.enemyHp,
    phase: spawn.phase || 0,
    fireTimer: spawn.fireTimer ?? 0.8,
    fireInterval: tuned.fireInterval,
    speed: 64 * tuned.enemySpeed,
    turn: 0.86 * tuned.enemySpeed * (ace ? 1.34 : 1),
    hitRadius: spawn.hitRadius ?? (ace ? (tuned.hitRadius || 3.2) : COMBAT.HIT_RADIUS_AI),
    alive: true,
    state: 'convert',
    breakTimer: 0,
    breakSign: 1,
    breakPitch: 0.4,
    lastHitBy: null,
    wasHit: false,
    ace: ace?.id || null,
    aceName: ace?.name || null,
    aceTag: ace?.tag || null,
    aceCallsign: ace?.callsign || null,
    aceScore: ace?.score || 0,
    wave: spawn.wave || 0,
  };
}

export function updateAi(e, player, dt, sampleHeight, rng = Math.random) {
  e.phase += dt;
  e.breakTimer = Math.max(0, e.breakTimer - dt);
  const ace = Boolean(e.ace);
  if (e.fleeing) {
    const awayX = e.x - player.x;
    const awayZ = e.z - player.z;
    const aim = { x: e.x + awayX * 2, y: e.y + 22, z: e.z + awayZ * 2 };
    const toAim = { x: aim.x - e.x, y: aim.y - e.y, z: aim.z - e.z };
    const targetYaw = Math.atan2(-toAim.x, -toAim.z);
    const yawDiff = angleDiff(e.heading, targetYaw);
    const turn = clamp(yawDiff / 0.95, -1, 1) * 0.85;
    const pitchStick = clamp(toAim.y * 0.04, -0.2, 1);
    const flown = integrateFlight(e, { pitch: pitchStick, turn }, dt, sampleHeight, 0, e.phase, FLIGHT.ENEMY_CLEARANCE);
    const fly = flown.forward || forwardFromEuler(e.heading, e.pitch);
    const pDist = Math.hypot(player.x - e.x, player.y - e.y, player.z - e.z);
    return { fire: false, forward: fly, dist: pDist, ram: false };
  }
  if (e.wasHit) {
    e.wasHit = false;
    e.state = 'break';
    e.breakTimer = (ace ? 3.1 : 1.7) + rng() * 0.9;
    e.breakSign = Math.sign(rng() - 0.5) || 1;
    e.breakPitch = rng() > 0.38 ? -0.62 : 0.42;
  }
  const fwd = forwardFromEuler(e.heading, e.pitch);
  const toPlayer = { x: player.x - e.x, y: player.y - e.y, z: player.z - e.z };
  const dist = Math.max(0.001, Math.hypot(toPlayer.x, toPlayer.y, toPlayer.z));
  toPlayer.x /= dist;
  toPlayer.y /= dist;
  toPlayer.z /= dist;
  const facingPlayer = fwd.x * toPlayer.x + fwd.y * toPlayer.y + fwd.z * toPlayer.z;
  const pFwd = forwardFromEuler(player.heading, player.pitch);
  const aimX = e.x - player.x;
  const aimY = e.y - player.y;
  const aimZ = e.z - player.z;
  const aimLen = Math.max(0.001, Math.hypot(aimX, aimY, aimZ));
  const enemyFromPlayer = (pFwd.x * aimX + pFwd.y * aimY + pFwd.z * aimZ) / aimLen;
  const onPlayersSix = enemyFromPlayer < -0.22 && dist < 95;
  const playerOnTail = facingPlayer < (ace ? 0.08 : -0.18) && dist < (ace ? 98 : 72);

  if (playerOnTail && e.breakTimer <= 0) {
    e.state = 'break';
    e.breakTimer = (ace ? 2.8 : 2.2) + rng() * 1.1;
    e.breakSign = Math.sign(rng() - 0.5) || 1;
    e.breakPitch = rng() > 0.32 ? (ace ? -0.58 : -0.35) : 0.18;
  }

  let aim = { x: player.x, y: player.y, z: player.z };
  const eright = rightFromHeading(e.heading);
  const pright = rightFromHeading(player.heading);
  if (e.state === 'break' && e.breakTimer > 0.25) {
    aim = {
      x: e.x + fwd.x * 40 + eright.x * e.breakSign * 90,
      y: player.y + e.breakPitch * 14,
      z: e.z + fwd.z * 40 + eright.z * e.breakSign * 90,
    };
  } else if (onPlayersSix || (facingPlayer > 0.62 && dist < 78)) {
    e.state = 'attack';
    const lead = Math.min(28, dist * 0.22);
    aim = { x: player.x + pFwd.x * lead, y: player.y + pFwd.y * lead, z: player.z + pFwd.z * lead };
  } else {
    e.state = 'convert';
    const sway = Math.sin(e.phase * 0.45 + e.turn) * (ace ? 38 : 22);
    aim = {
      x: player.x + pFwd.x * -36 + pright.x * sway,
      y: player.y - 2 + Math.sin(e.phase * 0.55) * 3,
      z: player.z + pFwd.z * -36 + pright.z * sway,
    };
  }

  const toAim = { x: aim.x - e.x, y: aim.y - e.y, z: aim.z - e.z };
  const targetYaw = Math.atan2(-toAim.x, -toAim.z);
  let yawDiff = angleDiff(e.heading, targetYaw);
  if (Math.abs(yawDiff) > 1.85 && e.breakTimer <= 0) {
    e.state = 'break';
    e.breakTimer = 2.6 + rng() * 0.8;
    e.breakSign = Math.sign(yawDiff) || 1;
    yawDiff = e.breakSign * 0.9;
  }

  const turnCap = Math.min(ace ? 1 : 0.9, (ace ? 0.92 : 0.72) * (e.turn || 0.86) / 0.86);
  const turn = clamp(yawDiff / 0.95, -1, 1) * turnCap;
  let pitchStick = clamp(toAim.y * 0.04, -1, 1);
  if (e.y > player.y + FLIGHT.ENEMY_MAX_ABOVE) pitchStick = Math.min(pitchStick, -0.42);

  const flown = integrateFlight(e, { pitch: pitchStick, turn }, dt, sampleHeight, 0, e.phase, FLIGHT.ENEMY_CLEARANCE);
  const minY = sampleHeight(e.x, e.z) + FLIGHT.ENEMY_CLEARANCE;
  const enemyCeil = Math.min(minY + FLIGHT.MAX_AGL - 36, player.y + FLIGHT.ENEMY_MAX_ABOVE);
  e.y = Math.min(e.y, enemyCeil);

  const fly = flown.forward || forwardFromEuler(e.heading, e.pitch);
  e.fireTimer -= dt;
  let fire = false;
  const toP = { x: player.x - e.x, y: player.y - e.y, z: player.z - e.z };
  const pDist = Math.max(0.001, Math.hypot(toP.x, toP.y, toP.z));
  const cone = (fly.x * toP.x + fly.y * toP.y + fly.z * toP.z) / pDist;
  if (e.fireTimer <= 0 && pDist < COMBAT.FIRE_RANGE && cone > COMBAT.FIRE_CONE) {
    fire = true;
    e.fireTimer = (e.fireInterval || 2.1) + rng() * 0.7;
  }
  return { fire, forward: fly, dist: pDist, ram: pDist < 5 };
}
