import { clamp, damp } from './math.js';
import { FLIGHT } from './constants.js';
import { handlingFor } from './planes.js';

export function forwardFromEuler(heading, pitch) {
  const cp = Math.cos(pitch);
  return {
    x: -Math.sin(heading) * cp,
    y: Math.sin(pitch),
    z: -Math.cos(heading) * cp,
  };
}

export function rightFromHeading(heading) {
  return { x: Math.cos(heading), y: 0, z: -Math.sin(heading) };
}

export function createCraft(spawn = {}) {
  const planeId = spawn.planeId || 'spitfire';
  const handling = spawn.handling || handlingFor(planeId);
  return {
    x: spawn.x || 0,
    y: spawn.y || 40,
    z: spawn.z ?? 80,
    heading: spawn.heading || 0,
    pitch: spawn.pitch || 0,
    roll: spawn.roll || 0,
    hull: spawn.hull ?? 100,
    maxHull: spawn.maxHull ?? spawn.hull ?? 100,
    alive: spawn.alive !== false,
    speed: spawn.speed ?? (spawn.grounded ? 0 : handling.baseSpeed),
    grounded: Boolean(spawn.grounded),
    planeId,
    handling,
  };
}

export function integrateFlight(craft, input, dt, sampleHeight, wind = 0, elapsed = 0, clearance = FLIGHT.GROUND_CLEARANCE) {
  const h = craft.handling || handlingFor(craft.planeId);
  const pitchIn = clamp(Number(input?.pitch) || 0, -1, 1);
  const turnIn = clamp(Number(input?.turn) || 0, -1, 1);
  if (craft.grounded) {
    const throttle = clamp((Number(input?.throttle) || 0) + (input?.fire ? 1 : 0), 0, 1);
    const rotate = h.rotateAt || 38;
    const ready = (craft.speed || 0) > rotate * 0.82;
    if (input?.takeoff && ready) {
      craft.grounded = false;
      craft.pitch = 0.16;
    } else {
      craft.speed = damp(craft.speed || 0, throttle * (h.taxiSpeed || 52), 1.35, dt);
      craft.pitch = 0;
      craft.roll = damp(craft.roll, 0, 8, dt);
      craft.heading -= turnIn * 0.42 * dt;
      const forward = forwardFromEuler(craft.heading, 0);
      craft.x += forward.x * craft.speed * dt;
      craft.z += forward.z * craft.speed * dt;
      const groundY = sampleHeight(craft.x, craft.z);
      craft.y = groundY + clearance;
      if (craft.speed > rotate && (pitchIn > 0.12 || throttle > 0.82 || input?.takeoff)) {
        craft.grounded = false;
        craft.pitch = 0.16;
      }
      return { speed: craft.speed, groundDamage: 0, groundHit: null, forward };
    }
  }
  if (Math.abs(pitchIn) < 0.06) {
    craft.pitch = damp(craft.pitch, 0, 2.1, dt);
  } else {
    const rate = pitchIn < 0 ? h.pitchDown : h.pitchUp;
    craft.pitch += pitchIn * rate * dt;
  }
  craft.pitch = clamp(craft.pitch, -h.maxPitchDown, h.maxPitchUp);
  const targetRoll = turnIn * h.maxRoll;
  craft.roll = damp(craft.roll, targetRoll, h.rollRate, dt);
  const yaw = turnIn > 0.04 ? h.turnRight || h.turn : turnIn < -0.04 ? h.turnLeft || h.turn : h.turn;
  craft.heading -= turnIn * yaw * 0.28 * dt;
  craft.heading -= Math.sin(craft.roll) * yaw * dt;

  let speed = clamp(h.baseSpeed - craft.pitch * (h.diveGain || 18), h.minSpeed, h.maxSpeed);
  if (craft.engineOut) {
    speed = damp(craft.speed || speed, h.minSpeed * 0.52, 0.85, dt);
    craft.pitch = damp(craft.pitch, -0.12, 1.6, dt);
  }
  craft.speed = speed;
  const forward = forwardFromEuler(craft.heading, craft.pitch);
  craft.x += forward.x * speed * dt;
  craft.y += forward.y * speed * dt - (craft.engineOut ? 7.5 * dt : 0);
  craft.z += forward.z * speed * dt;
  if (wind) {
    craft.x += wind * dt * 0.32;
    craft.heading += Math.sin(elapsed * 0.85) * wind * dt * 0.01;
  }
  const groundY = sampleHeight(craft.x, craft.z);
  const minAlt = groundY + clearance;
  const maxAlt = groundY + (h.maxAgl || FLIGHT.MAX_AGL);
  let groundDamage = 0;
  let groundHit = null;
  if (craft.y < minAlt) {
    craft.y = minAlt;
    const descent = Math.max(0, -forward.y * speed);
    if (craft.pitch < -FLIGHT.CRASH_PITCH || descent > FLIGHT.CRASH_DESCENT) {
      groundHit = 'crash';
      groundDamage = 999;
    } else {
      groundHit = 'graze';
      if (craft.pitch < 0) craft.pitch *= 0.45;
    }
  } else if (craft.y > maxAlt - 28 && craft.pitch > 0) {
    craft.pitch = damp(craft.pitch, 0, 5.5, dt);
  }
  craft.y = clamp(craft.y, minAlt, maxAlt);
  return { speed, groundDamage, groundHit, forward };
}

export function applyPose(object3d, craft) {
  object3d.position.set(craft.x, craft.y, craft.z);
  object3d.rotation.order = 'YXZ';
  object3d.rotation.set(craft.pitch, craft.heading, -craft.roll);
}
