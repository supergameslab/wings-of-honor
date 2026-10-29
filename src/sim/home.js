import { angleDiff } from './math.js';
import { FUEL } from './constants.js';

export function headingAlign(heading, stripHeading = 0) {
  return Math.min(Math.abs(angleDiff(heading, stripHeading)), Math.abs(angleDiff(heading, stripHeading + Math.PI)));
}

export function homeStripCenter(field = {}) {
  return {
    x: field.stripX ?? field.x ?? 0,
    z: field.stripZ ?? field.z ?? 0,
    heading: field.heading || 0,
    halfW: field.halfW ?? FUEL.STRIP_HALF_W,
    halfL: field.halfL ?? FUEL.STRIP_HALF_L,
  };
}

export function stripOffset(px, pz, py, heading, field, sampleHeight) {
  const s = homeStripCenter(field);
  const dx = px - s.x;
  const dz = pz - s.z;
  const sh = Math.sin(s.heading);
  const ch = Math.cos(s.heading);
  const along = dx * -sh + dz * -ch;
  const side = dx * ch + dz * -sh;
  const ground = typeof sampleHeight === 'function' ? sampleHeight(px, pz) : 0;
  return {
    side,
    along,
    agl: py - ground,
    align: headingAlign(heading, s.heading),
    dist: Math.hypot(dx, dz),
    halfW: s.halfW,
    halfL: s.halfL,
  };
}

export function overHomeStrip(offset) {
  return Boolean(offset && Math.abs(offset.side) < offset.halfW && Math.abs(offset.along) < offset.halfL);
}

export function linedUp(offset) {
  return Boolean(
    offset
    && overHomeStrip(offset)
    && offset.agl < FUEL.LAND_AGL + 10
    && offset.align < FUEL.LAND_ALIGN + 0.2,
  );
}

export function homeNav(px, pz, heading, field) {
  const s = homeStripCenter(field);
  const dx = s.x - px;
  const dz = s.z - pz;
  const bearing = Math.atan2(-dx, -dz);
  return { bearing, rel: angleDiff(heading, bearing), dist: Math.hypot(dx, dz) };
}

export function canTouchdown(offset) {
  return Boolean(offset && overHomeStrip(offset) && offset.agl <= FUEL.TOUCH_AGL && offset.align <= FUEL.TOUCH_ALIGN);
}

export function canManualLand(offset, meter = 0) {
  return Boolean(offset && overHomeStrip(offset) && offset.agl <= FUEL.LAND_AGL && offset.align <= FUEL.LAND_ALIGN && meter >= 0.18);
}

export function canCommitLand(offset, meter = 0, forced = false) {
  if (canTouchdown(offset)) return true;
  if (canManualLand(offset, meter)) return true;
  return Boolean(
    forced
    && offset
    && overHomeStrip(offset)
    && offset.agl <= FUEL.LAND_AGL + 12
    && offset.align <= FUEL.TOUCH_ALIGN,
  );
}

export function shouldAutoLand(offset, meter = 0) {
  return canTouchdown(offset) || (canManualLand(offset, meter) && meter >= 0.88);
}

export function landRejectReason(offset) {
  if (!offset) return 'FIND THE GOLD STRIP';
  if (!overHomeStrip(offset)) return 'LINE UP WITH THE GOLD STRIP';
  if (offset.agl > FUEL.LAND_AGL) return 'TOO HIGH · DESCEND';
  if (offset.align > FUEL.LAND_ALIGN) return 'TURN TO FACE THE STRIP';
  return 'HOLD THE LINE';
}

export function stepLandMeter(meter, lined, dt) {
  return lined ? Math.min(1, meter + dt / 1.05) : Math.max(0, meter - dt * 0.9);
}

export function landingCue({
  grounded = false,
  airspeed = 0,
  rotateAt = 38,
  offset = null,
  meter = 0,
  fuel = 1,
  jobDone = false,
  nav = null,
} = {}) {
  const rotateReady = airspeed >= rotateAt * 0.82;
  const over = overHomeStrip(offset);
  const lined = linedUp(offset);
  const near = Boolean(offset && offset.dist < FUEL.APPROACH_R);
  const lowFuel = fuel <= FUEL.LOW;
  const showCompass = !grounded && (lowFuel || jobDone || near || fuel <= FUEL.SPUTTER);
  const turn = nav ? (nav.rel > 0.18 ? 'TURN LEFT' : nav.rel < -0.18 ? 'TURN RIGHT' : 'STRAIGHT ON') : 'HOME';
  const range = nav ? Math.round(nav.dist) : 0;

  if (grounded) {
    return {
      prompt: rotateReady ? 'TAKE OFF · T' : 'HOLD FIRE TO TAXI',
      sub: rotateReady ? 'Press T or tap UP' : 'Hold FIRE to build speed on the strip',
      show: true,
      showCompass: false,
      landReady: false,
      takeoffReady: rotateReady,
      auto: false,
    };
  }

  if (shouldAutoLand(offset, meter)) {
    return {
      prompt: 'LANDING',
      sub: 'Settling on the strip',
      show: true,
      showCompass,
      landReady: true,
      takeoffReady: false,
      auto: true,
    };
  }

  if (lined && meter >= 0.28) {
    return {
      prompt: 'LAND · L',
      sub: 'Press L or tap LAND — or settle onto the grass',
      show: true,
      showCompass,
      landReady: true,
      takeoffReady: false,
      auto: false,
    };
  }

  if (over && offset.agl > FUEL.LAND_AGL) {
    return {
      prompt: 'DESCEND ON THE STRIP',
      sub: 'Keep the gold line under the nose',
      show: true,
      showCompass,
      landReady: false,
      takeoffReady: false,
      auto: false,
    };
  }

  if (over && offset.align > FUEL.LAND_ALIGN) {
    return {
      prompt: 'TURN TO FACE THE STRIP',
      sub: 'Line up north–south, then settle down',
      show: true,
      showCompass,
      landReady: false,
      takeoffReady: false,
      auto: false,
    };
  }

  if (near) {
    return {
      prompt: `HOME ${range} · ${turn}`,
      sub: 'Gold runway on radar — line up and descend',
      show: true,
      showCompass: true,
      landReady: false,
      takeoffReady: false,
      auto: false,
    };
  }

  if (jobDone || lowFuel) {
    return {
      prompt: jobDone ? 'JOB DONE · FOLLOW THE COMPASS HOME' : 'FUEL LOW · FOLLOW THE COMPASS',
      sub: 'Gold strip on radar',
      show: true,
      showCompass: true,
      landReady: false,
      takeoffReady: false,
      auto: false,
    };
  }

  return {
    prompt: '',
    sub: '',
    show: false,
    showCompass,
    landReady: false,
    takeoffReady: false,
    auto: false,
  };
}
