export const PROTOCOL = 1;

export const FLIGHT = {
  PITCH_RATE_UP: 1.14,
  PITCH_RATE_DOWN: 1.46,
  MAX_PITCH_UP: 0.58,
  MAX_PITCH_DOWN: 0.9,
  ROLL_RATE: 2.62,
  MAX_ROLL: 0.82,
  TURN_RATE: 1.12,
  BASE_SPEED: 78,
  MAX_AGL: 340,
  ENEMY_MAX_ABOVE: 24,
  GROUND_CLEARANCE: 4.2,
  CRASH_PITCH: 0.28,
  CRASH_DESCENT: 24,
  ENEMY_CLEARANCE: 14,
  MIN_SPEED: 52,
  MAX_SPEED: 118,
};

export const COMBAT = {
  PLAYER_SHOT_S: 0.082,
  BOMB_S: 0.85,
  BOMB_GRAVITY: 38,
  BOMB_INHERIT: 1.08,
  BOMB_LIFE: 6,
  BOMB_LOAD: 8,
  BULLET_SPEED_PLAYER: 260,
  BULLET_SPEED_AI: 128,
  BULLET_LIFE_PLAYER: 1.7,
  BULLET_LIFE_AI: 2.4,
  HIT_RADIUS_AI: 5.4,
  HIT_RADIUS_PLAYER: 5.8,
  BOMB_RADIUS: 50,
  WAYPOINT_RADIUS: 8.5,
  GROUND_DPS: 11,
  BULLET_DAMAGE: 8,
  RAM_DAMAGE: 18,
  FIRE_CONE: 0.88,
  FIRE_RANGE: 108,
  AA_BULLET_SPEED: 124,
  AA_BULLET_LIFE: 2.2,
  GROUND_STRAFE: 1,
};

export const NET = {
  TICK_HZ: 20,
  TICK_DT: 0.05,
  RECONNECT_S: 30,
  AFK_S: 8,
  SPAWN_PROTECT_S: 3,
  JOIN_TICKET_S: 60,
  MAX_PILOTS: 8,
  HUNT_MIN: 1,
  DUEL_RANKED_MIN: 2,
};

export const WIND = {
  storm: 10,
  dust: 8,
  rain: 3.8,
  overcast: 1.6,
  heat: 2.2,
};

export const FUEL = {
  BURN_PER_S: 1 / 100,
  SPUTTER: 0.14,
  LOW: 0.32,
  STRIP_HALF_W: 20,
  STRIP_HALF_L: 96,
  STRIP_OFFSET_Z: -36,
  LAND_AGL: 28,
  LAND_ALIGN: 0.85,
  TOUCH_AGL: 12,
  TOUCH_ALIGN: 1.2,
  APPROACH_R: 320,
};

export function windFor(weather) {
  return WIND[weather] || 0;
}

export function missionSeed(mission) {
  const id = mission.seed || mission.id || 1;
  return id * 31 + (mission.region || '').length * 17 + String(mission.theater || 'x').charCodeAt(0);
}
