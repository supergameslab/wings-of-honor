export const SORTIE_KINDS = ['onboard', 'campaign', 'quick', 'hunt', 'hunt_practice', 'duel'];

export function sortieKind(raw) {
  const k = String(raw || 'campaign');
  return SORTIE_KINDS.includes(k) ? k : 'campaign';
}

export function clampSortie(body = {}) {
  const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  return {
    kind: sortieKind(body.kind),
    missionId: n(body.missionId, 10000),
    score: n(body.score, 500000),
    kills: n(body.kills, 40),
    deaths: n(body.deaths, 20),
    ground: n(body.ground, 40),
    recon: n(body.recon, 20),
    win: body.win ? 1 : 0,
  };
}

export function starRating({ win, hullPct = 1, elapsed = 90, par = 90 } = {}) {
  if (!win) return 0;
  let stars = 1;
  if (hullPct >= 0.45) stars = 2;
  if (hullPct >= 0.72 && elapsed <= par * 1.15) stars = 3;
  return stars;
}

export function mergeProgress(server = {}, local = {}) {
  const unlocked = Math.max(Number(server.unlocked) || 1, Number(local.unlocked) || 1);
  const completed = [...new Set([...(server.completed || []), ...(local.completed || [])])]
    .filter((n) => n >= 1 && n <= 100)
    .sort((a, b) => a - b);
  const stars = { ...(server.stars || {}) };
  for (const [k, v] of Object.entries(local.stars || {})) {
    stars[k] = Math.max(Number(stars[k]) || 0, Number(v) || 0);
  }
  const craftId = local.craftId || server.craftId || 'spitfire';
  const onboarded = Boolean(server.onboarded || local.onboarded);
  return {
    unlocked: Math.min(100, Math.max(1, unlocked)),
    completed,
    stars,
    craftId,
    onboarded,
    difficulty: local.difficulty || server.difficulty || 'normal',
    scores: { ...(server.scores || {}), ...(local.scores || {}) },
    rev: Math.max(Number(server.rev) || 0, Number(local.rev) || 0) + 1,
  };
}

export function makePrologue() {
  return {
    id: 0,
    seed: 17,
    skirmish: true,
    onboard: true,
    theater: 'britain',
    name: 'First Flight',
    region: 'Kent',
    terrain: 'fields',
    weather: 'dawn',
    fighters: 1,
    targets: 0,
    targetKind: 'depot',
    win: { type: 'kills', kills: 1 },
    brief: "You're on the grass. Hold fire to speed up, lift off, and catch the fighter ahead. Lean to turn. Space to shoot.",
  };
}

export function nextCraftUnlock(unlocked, crafts) {
  return (crafts || []).find((c) => !c.aiOnly && c.unlock > (unlocked || 1)) || null;
}

export function nextAceMission(fromId, missions) {
  return (missions || []).find((m) => m.id > fromId && m.aces?.length) || null;
}
