import { FLIGHT } from './constants.js';

export const PLANES = [
  {
    id: 'spitfire',
    name: 'Supermarine Spitfire Mk I',
    blurb: 'The signature interceptor. Turns inside almost anything. Eight Brownings.',
    unlock: 1,
    side: 'allied',
    sight: 'aldis',
    wings: 1,
    guns: 8,
    hullMul: 1,
    shotS: 0.082,
    bombLoad: 0,
    blades: 3,
    handling: {
      baseSpeed: 78,
      minSpeed: 52,
      maxSpeed: 112,
      turn: 1.28,
      turnRight: 1.28,
      turnLeft: 1.28,
      pitchUp: 1.22,
      pitchDown: 1.36,
      maxPitchUp: 0.58,
      maxPitchDown: 0.86,
      rollRate: 2.78,
      maxRoll: 0.84,
      diveGain: 20,
      maxAgl: 340,
      rotateAt: 44,
      taxiSpeed: 58,
    },
  },
  {
    id: 'p40',
    name: 'Curtiss P-40 Warhawk',
    blurb: 'Rugged desert fighter. Takes a beating. Six guns and a shark’s grin.',
    unlock: 21,
    side: 'allied',
    sight: 'n9',
    wings: 1,
    guns: 6,
    hullMul: 1.22,
    shotS: 0.09,
    bombLoad: 4,
    blades: 3,
    handling: {
      baseSpeed: 74,
      minSpeed: 50,
      maxSpeed: 104,
      turn: 1.08,
      turnRight: 1.08,
      turnLeft: 1.08,
      pitchUp: 1.04,
      pitchDown: 1.42,
      maxPitchUp: 0.54,
      maxPitchDown: 0.88,
      rollRate: 2.35,
      maxRoll: 0.76,
      diveGain: 22,
      maxAgl: 300,
      rotateAt: 46,
      taxiSpeed: 56,
    },
  },
  {
    id: 'stuka',
    name: 'Junkers Ju 87 Stuka',
    blurb: 'Dive-bomber. Slow in a turn, brutal in a dive. Extra bombs.',
    unlock: 18,
    side: 'axis',
    sight: 'revi',
    wings: 1,
    guns: 2,
    hullMul: 1.18,
    shotS: 0.14,
    bombLoad: 12,
    blades: 3,
    axis: true,
    handling: {
      baseSpeed: 62,
      minSpeed: 44,
      maxSpeed: 96,
      turn: 0.82,
      turnRight: 0.82,
      turnLeft: 0.82,
      pitchUp: 0.88,
      pitchDown: 1.72,
      maxPitchUp: 0.48,
      maxPitchDown: 0.96,
      rollRate: 1.85,
      maxRoll: 0.62,
      diveGain: 30,
      maxAgl: 280,
      rotateAt: 40,
      taxiSpeed: 48,
    },
  },
  {
    id: 'bf109',
    name: 'Messerschmitt Bf 109 E',
    blurb: 'Climbs like a rocket. Narrow, mean, and fast upstairs.',
    unlock: 1,
    side: 'axis',
    sight: 'revi',
    wings: 1,
    guns: 4,
    hullMul: 0.94,
    shotS: 0.078,
    bombLoad: 2,
    blades: 3,
    axis: true,
    handling: {
      baseSpeed: 82,
      minSpeed: 54,
      maxSpeed: 118,
      turn: 1.16,
      turnRight: 1.16,
      turnLeft: 1.16,
      pitchUp: 1.38,
      pitchDown: 1.28,
      maxPitchUp: 0.62,
      maxPitchDown: 0.84,
      rollRate: 2.7,
      maxRoll: 0.8,
      diveGain: 18,
      maxAgl: 380,
      rotateAt: 48,
      taxiSpeed: 60,
    },
  },
  {
    id: 'mustang',
    name: 'North American P-51 D',
    blurb: 'Long-range energy fighter. Fastest in a straight line. Keep the speed.',
    unlock: 48,
    side: 'allied',
    sight: 'n9',
    wings: 1,
    guns: 6,
    hullMul: 1.08,
    shotS: 0.08,
    bombLoad: 4,
    blades: 4,
    handling: {
      baseSpeed: 92,
      minSpeed: 58,
      maxSpeed: 132,
      turn: 0.96,
      turnRight: 0.96,
      turnLeft: 0.96,
      pitchUp: 1.06,
      pitchDown: 1.58,
      maxPitchUp: 0.52,
      maxPitchDown: 0.94,
      rollRate: 2.42,
      maxRoll: 0.74,
      diveGain: 28,
      maxAgl: 360,
      rotateAt: 52,
      taxiSpeed: 64,
    },
  },
  {
    id: 'hellcat',
    name: 'Grumman F6F Hellcat',
    blurb: 'Carrier bruiser. Six fifties and a hull that refuses to quit.',
    unlock: 61,
    side: 'allied',
    sight: 'n9',
    wings: 1,
    guns: 6,
    hullMul: 1.34,
    shotS: 0.086,
    bombLoad: 6,
    blades: 3,
    handling: {
      baseSpeed: 80,
      minSpeed: 50,
      maxSpeed: 110,
      turn: 1.1,
      turnRight: 1.1,
      turnLeft: 1.1,
      pitchUp: 1.1,
      pitchDown: 1.4,
      maxPitchUp: 0.56,
      maxPitchDown: 0.88,
      rollRate: 2.28,
      maxRoll: 0.74,
      diveGain: 21,
      maxAgl: 320,
      rotateAt: 42,
      taxiSpeed: 54,
    },
  },
  {
    id: 'zero',
    name: 'Mitsubishi A6M Zero',
    blurb: 'Light, sharp, and dangerous in a turning fight. Cowl nates and wing cannon.',
    unlock: 61,
    side: 'axis',
    sight: 'type99',
    wings: 1,
    guns: 4,
    hullMul: 0.78,
    shotS: 0.1,
    bombLoad: 0,
    blades: 3,
    axis: true,
    handling: {
      baseSpeed: 76,
      minSpeed: 46,
      maxSpeed: 108,
      turn: 1.42,
      turnRight: 1.42,
      turnLeft: 1.42,
      pitchUp: 1.18,
      pitchDown: 1.12,
      maxPitchUp: 0.64,
      maxPitchDown: 0.78,
      rollRate: 2.9,
      maxRoll: 0.86,
      diveGain: 14,
      maxAgl: 310,
      rotateAt: 38,
      taxiSpeed: 50,
    },
  },
  {
    id: 'oscar',
    name: 'Nakajima Ki-43 Hayabusa',
    blurb: 'The Oscar. Almost nothing turns tighter. Two cowl guns, paper-thin wings.',
    unlock: 72,
    side: 'axis',
    sight: 'type99',
    wings: 1,
    guns: 2,
    hullMul: 0.7,
    shotS: 0.11,
    bombLoad: 2,
    blades: 2,
    axis: true,
    handling: {
      baseSpeed: 70,
      minSpeed: 42,
      maxSpeed: 102,
      turn: 1.52,
      turnRight: 1.52,
      turnLeft: 1.52,
      pitchUp: 1.22,
      pitchDown: 1.08,
      maxPitchUp: 0.66,
      maxPitchDown: 0.76,
      rollRate: 2.75,
      maxRoll: 0.84,
      diveGain: 12,
      maxAgl: 300,
      rotateAt: 36,
      taxiSpeed: 48,
    },
  },
];

export function planeById(id) {
  return PLANES.find((p) => p.id === id) || PLANES[0];
}

export const COCKPIT_SIGHT = { x: 0, y: 0.42, z: -1.28 };
export const COCKPIT_CAM = { x: 0, y: 0.42, z: 0.62 };

export function planeSide(plane) {
  if (!plane) return 'allied';
  if (plane.side === 'axis' || plane.axis) return 'axis';
  return 'allied';
}

export function defaultCraftId(side = 'allied') {
  return side === 'axis' ? 'bf109' : 'spitfire';
}

export function planesForSide(side = 'allied') {
  return PLANES.filter((p) => !p.aiOnly && planeSide(p) === side);
}

export function sightFor(id) {
  const plane = planeById(id);
  if (plane.sight) return plane.sight;
  if (plane.id === 'spitfire') return 'aldis';
  if (plane.axis) return plane.id === 'zero' || plane.id === 'oscar' ? 'type99' : 'revi';
  return 'n9';
}

export function gunLayout(id) {
  switch (planeById(id).id) {
    case 'spitfire':
      return { wing: [0.34, 0.48, 0.62, 0.76] };
    case 'p40':
    case 'mustang':
    case 'hellcat':
      return { wing: [0.38, 0.54, 0.7] };
    case 'stuka':
      return { wing: [0.46] };
    case 'bf109':
      return { cowl: 0.16, wing: [0.56] };
    case 'zero':
      return { cowl: 0.14, wing: [0.7] };
    case 'oscar':
      return { cowl: 0.13, wing: [] };
    default:
      return { wing: [0.5] };
  }
}

export function gunStations(id) {
  const layout = gunLayout(id);
  const out = [];
  if (layout.cowl) {
    out.push({ kind: 'cowl', x: -layout.cowl }, { kind: 'cowl', x: layout.cowl });
  }
  for (const span of layout.wing || []) {
    out.push({ kind: 'wing', span, side: -1 }, { kind: 'wing', span, side: 1 });
  }
  return out;
}

export function cockpitGuns(id) {
  const plane = planeById(id);
  const count = plane.guns >= 4 ? 2 : plane.guns || 2;
  const spread = plane.id === 'bf109' ? 0.12 : plane.id === 'stuka' ? 0.18 : 0.16;
  return {
    count,
    offsets: count === 1 ? [0] : [-spread, spread],
    german: Boolean(plane.axis),
    aldis: plane.id === 'spitfire' || plane.sight === 'aldis',
    sight: sightFor(id),
    upperWing: false,
    wingGuns: plane.guns >= 4,
  };
}

export function isCraftUnlocked(craft, progress) {
  if (craft?.aiOnly) return false;
  return (progress?.unlocked || 1) >= (craft?.unlock || 1);
}

export function handlingFor(id) {
  const plane = planeById(id);
  return {
    baseSpeed: FLIGHT.BASE_SPEED,
    minSpeed: FLIGHT.MIN_SPEED,
    maxSpeed: FLIGHT.MAX_SPEED,
    turn: FLIGHT.TURN_RATE,
    turnRight: FLIGHT.TURN_RATE,
    turnLeft: FLIGHT.TURN_RATE,
    pitchUp: FLIGHT.PITCH_RATE_UP,
    pitchDown: FLIGHT.PITCH_RATE_DOWN,
    maxPitchUp: FLIGHT.MAX_PITCH_UP,
    maxPitchDown: FLIGHT.MAX_PITCH_DOWN,
    rollRate: FLIGHT.ROLL_RATE,
    maxRoll: FLIGHT.MAX_ROLL,
    diveGain: 20,
    maxAgl: FLIGHT.MAX_AGL,
    rotateAt: 44,
    taxiSpeed: 58,
    ...(plane.handling || {}),
  };
}

export function enemyCraftFor(mission, index = 0, side = 'allied') {
  const axis = side === 'axis';
  const theater = mission?.theater;
  if (axis) {
    if (theater === 'pacific') return index % 2 ? 'hellcat' : 'p40';
    if (theater === 'desert') return index % 3 === 2 ? 'p40' : 'spitfire';
    if (theater === 'europe' || theater === 'final') return index % 3 === 2 ? 'mustang' : 'spitfire';
    return 'spitfire';
  }
  if (theater === 'pacific') return index % 3 === 2 ? 'oscar' : 'zero';
  if (theater === 'desert' && index % 4 === 3) return 'stuka';
  return index % 3 === 2 ? 'stuka' : 'bf109';
}

export const PLANE_RATING_TRAITS = [
  { id: 'speed', label: 'Speed' },
  { id: 'turn', label: 'Turn' },
  { id: 'climb', label: 'Climb' },
  { id: 'guns', label: 'Guns' },
  { id: 'tough', label: 'Tough' },
  { id: 'dive', label: 'Dive' },
];

function ratingRaw(plane) {
  const h = handlingFor(plane.id);
  const turn = ((h.turnRight || h.turn) + (h.turnLeft || h.turn)) / 2;
  return {
    speed: h.baseSpeed,
    turn,
    climb: h.pitchUp * (h.maxAgl / 250),
    guns: (plane.guns || 1) / (plane.shotS || 0.1),
    tough: plane.hullMul || 1,
    dive: (h.diveGain || 18) * (h.pitchDown || 1),
  };
}

function pipsFor(value, min, max) {
  if (!(max > min)) return 3;
  return Math.max(1, Math.min(5, Math.round(1 + ((value - min) / (max - min)) * 4)));
}

export function planeRatings(id) {
  const plane = planeById(id);
  const rated = PLANES.filter((p) => !p.aiOnly);
  const rawAll = rated.map(ratingRaw);
  const mine = ratingRaw(plane);
  return PLANE_RATING_TRAITS.map((trait) => {
    const values = rawAll.map((row) => row[trait.id]);
    return {
      id: trait.id,
      label: trait.label,
      pips: pipsFor(mine[trait.id], Math.min(...values), Math.max(...values)),
    };
  });
}
