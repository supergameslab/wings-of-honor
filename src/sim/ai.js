import { clamp, angleDiff, damp } from './math.js';
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
    state: 'attack',
    breakTimer: 0,
    breakSign: 1,
    breakPitch: 0.4,
    steer: 0,
    turnCommit: 0,
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

function committedYaw(e, targetYaw) {
  let yawDiff = angleDiff(e.heading, targetYaw);
  if (e.turnCommit && Math.abs(yawDiff) > 1.55 && Math.sign(yawDiff) !== Math.sign(e.turnCommit)) {
    yawDiff = Math.abs(yawDiff) * e.turnCommit;
  }
  if (Math.abs(yawDiff) > 0.55) {
    e.turnCommit = Math.sign(yawDiff) || e.turnCommit || 1;
  } else if (Math.abs(yawDiff) < 0.18) {
    e.turnCommit = 0;
  }
  return yawDiff;
}

function flyTo(e, aim, dt, turnCap, sampleHeight, player) {
  const toAim = { x: aim.x - e.x, y: aim.y - e.y, z: aim.z - e.z };
  const targetYaw = Math.atan2(-toAim.x, -toAim.z);
  const yawDiff = committedYaw(e, targetYaw);
  const desiredTurn = clamp(yawDiff / 0.95, -1, 1) * turnCap;
  e.steer = damp(e.steer || 0, desiredTurn, 8.4, dt);
  let pitchStick = clamp(toAim.y * 0.04, -1, 1);
  if (e.y > player.y + FLIGHT.ENEMY_MAX_ABOVE) pitchStick = Math.min(pitchStick, -0.42);
  const flown = integrateFlight(e, { pitch: pitchStick, turn: e.steer }, dt, sampleHeight, 0, e.phase, FLIGHT.ENEMY_CLEARANCE);
  const minY = sampleHeight(e.x, e.z) + FLIGHT.ENEMY_CLEARANCE;
  const enemyCeil = Math.min(minY + FLIGHT.MAX_AGL - 36, player.y + FLIGHT.ENEMY_MAX_ABOVE);
  e.y = Math.min(e.y, enemyCeil);
  return flown.forward || forwardFromEuler(e.heading, e.pitch);
}

export function updateAi(e, player, dt, sampleHeight, rng = Math.random) {
  e.phase += dt;
  e.breakTimer = Math.max(0, e.breakTimer - dt);
  const ace = Boolean(e.ace);
  const turnCap = Math.min(ace ? 1 : 0.9, (ace ? 0.92 : 0.72) * (e.turn || 0.86) / 0.86);
  if (e.fleeing) {
    const awayX = e.x - player.x;
    const awayZ = e.z - player.z;
    const aim = { x: e.x + awayX * 2, y: e.y + 22, z: e.z + awayZ * 2 };
    const fly = flyTo(e, aim, dt, 0.85, sampleHeight, player);
    const pDist = Math.hypot(player.x - e.x, player.y - e.y, player.z - e.z);
    return { fire: false, forward: fly, dist: pDist, ram: false };
  }
  if (e.wasHit) {
    e.wasHit = false;
    e.state = 'break';
    e.breakTimer = (ace ? 0.95 : 0.62) + rng() * 0.22;
    e.breakSign = Math.sign(rng() - 0.5) || 1;
    e.breakPitch = rng() > 0.38 ? -0.62 : 0.48;
    e.turnCommit = e.breakSign;
  }
  const fwd = forwardFromEuler(e.heading, e.pitch);
  const toPlayer = { x: player.x - e.x, y: player.y - e.y, z: player.z - e.z };
  const dist = Math.max(0.001, Math.hypot(toPlayer.x, toPlayer.y, toPlayer.z));
  toPlayer.x /= dist;
  toPlayer.y /= dist;
  toPlayer.z /= dist;
  const facingPlayer = fwd.x * toPlayer.x + fwd.y * toPlayer.y + fwd.z * toPlayer.z;
  const pFwd = forwardFromEuler(player.heading, player.pitch);
  const playerOnTail = facingPlayer < -0.42 && dist < 44;

  if (playerOnTail && e.breakTimer <= 0) {
    e.state = 'break';
    e.breakTimer = (ace ? 0.82 : 0.55) + rng() * 0.18;
    e.breakSign = Math.sign(rng() - 0.5) || 1;
    e.breakPitch = rng() > 0.32 ? (ace ? -0.58 : -0.38) : 0.28;
    e.turnCommit = e.breakSign;
  }

  let aim = { x: player.x, y: player.y, z: player.z };
  const eright = rightFromHeading(e.heading);
  const pright = rightFromHeading(player.heading);
  const weaveY = Math.sin(e.phase * 1.15) * 5.5;
  if (e.state === 'break' && e.breakTimer > 0.1) {
    aim = {
      x: player.x + eright.x * e.breakSign * 34,
      y: player.y + e.breakPitch * 16,
      z: player.z + eright.z * e.breakSign * 34,
    };
  } else if (facingPlayer > 0.2 || dist > 70) {
    e.state = 'attack';
    const lead = facingPlayer > 0.38 ? Math.min(ace ? 24 : 16, dist * 0.14) : 0;
    aim = { x: player.x + pFwd.x * lead, y: player.y + 2 + weaveY, z: player.z + pFwd.z * lead };
  } else {
    e.state = 'convert';
    const sway = Math.sin(e.phase * 0.9 + e.turn) * (ace ? 20 : 12);
    aim = {
      x: player.x + pFwd.x * -16 + pright.x * sway,
      y: player.y + weaveY,
      z: player.z + pFwd.z * -16 + pright.z * sway,
    };
  }

  const fly = flyTo(e, aim, dt, turnCap, sampleHeight, player);
  e.fireTimer -= dt;
  let fire = false;
  const toP = { x: player.x - e.x, y: player.y - e.y, z: player.z - e.z };
  const pDist = Math.max(0.001, Math.hypot(toP.x, toP.y, toP.z));
  const cone = (fly.x * toP.x + fly.y * toP.y + fly.z * toP.z) / pDist;
  const aiRange = Math.max(COMBAT.FIRE_RANGE, 120);
  const aiCone = Math.min(COMBAT.FIRE_CONE, 0.76);
  if (e.fireTimer <= 0 && pDist < aiRange && cone > aiCone) {
    fire = true;
    e.fireTimer = (e.fireInterval || 2.1) * 0.72 + rng() * 0.35;
  }
  return { fire, forward: fly, dist: pDist, ram: pDist < 5 };
}
