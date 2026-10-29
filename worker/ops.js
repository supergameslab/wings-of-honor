import { TABLES as T, COLS } from './tables.js';
import { all, one, run, changedSince, shouldWrite } from './db.js';
import { json, cookie, readCookie, readBody, now, isHttps } from './util.js';
import { sortieKind, clampSortie, mergeProgress } from '../src/sim/progress.js';

const OPS_COOKIE = 'ops_wings';
const FLAGS_TTL_MS = 45_000;
const CLEAN_BATCH = 200;
const defaultFlags = { mp_enabled: '1', shop_enabled: '1', telemetry_enabled: '1', payments_mode: 'off' };

let flagsCache = { at: 0, value: null };

export async function ensureOps(env) {
  if (!env.DB) return;
}

function rememberFlags(value) {
  flagsCache = { at: Date.now(), value };
  return value;
}

export async function flagsOf(env) {
  if (flagsCache.value && Date.now() - flagsCache.at < FLAGS_TTL_MS) return flagsCache.value;
  const rows = await all(env, `SELECT k, v FROM ${T.opsFlags}`);
  const out = { ...defaultFlags };
  for (const r of rows) out[r.k] = r.v;
  return rememberFlags(out);
}

export async function bumpCounter(env, k, n = 1) {
  await run(env, `INSERT INTO ${T.opsCounters} (k, n) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET n = n + excluded.n`, k, n);
}

function dayStart(ts = now()) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function opsCookie(value, request, clear = false) {
  return cookie(OPS_COOKIE, clear ? '' : value, clear ? 0 : 7 * 86400, { secure: isHttps(request) });
}

async function secretHash(secret) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(secret || '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function opsAuthed(request, env) {
  if (!env.ADMIN_SECRET) return false;
  const tok = readCookie(request, OPS_COOKIE);
  if (!tok) return false;
  return tok === (await secretHash(env.ADMIN_SECRET));
}

async function requireOps(request, env) {
  if (await opsAuthed(request, env)) return { ok: true };
  return { error: json(request, { error: 'ops auth required' }, 401) };
}

async function audit(env, action, target) {
  await run(env, `INSERT INTO ${T.opsAudit} (id, at, action, target) VALUES (?, ?, ?, ?)`, crypto.randomUUID(), now(), action, String(target || '').slice(0, 80));
}

async function expireOld(env, sql, bind) {
  await run(env, sql, bind);
}

export async function ingestTelemetry(request, env) {
  const flags = await flagsOf(env);
  if (flags.telemetry_enabled === '0') return json(request, { ok: true, off: true });
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const body = await readBody(request);
  const aid = String(body.aid || '').slice(0, 64);
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(aid)) return json(request, { error: 'bad aid' }, 400);
  const events = Array.isArray(body.events) ? body.events.slice(0, 20) : [];
  if (!events.length) return json(request, { ok: true });
  if (env.LIMITS) {
    const k = `rl:tel:${aid}`;
    const t = now();
    const rec = (await env.LIMITS.get(k, 'json')) || { n: 0, t };
    if (t - rec.t > 60000) {
      await env.LIMITS.put(k, JSON.stringify({ n: 1, t }), { expirationTtl: 70 });
    } else if (rec.n >= 30) {
      return json(request, { error: 'slow down' }, 429);
    } else {
      rec.n += 1;
      await env.LIMITS.put(k, JSON.stringify(rec), { expirationTtl: 70 });
    }
  }
  const clean = events.map((e) => ({
    name: String(e.name || 'event').slice(0, 40),
    at: Number(e.at) || now(),
    kind: e.kind ? sortieKind(e.kind) : undefined,
    mission_id: e.mission_id != null ? Number(e.mission_id) : e.missionId != null ? Number(e.missionId) : undefined,
    difficulty: e.difficulty ? String(e.difficulty).slice(0, 12) : undefined,
    win: e.win ? 1 : 0,
    kills: Math.min(40, Number(e.kills) || 0),
    hull_pct: e.hull_pct,
    elapsed_s: e.elapsed_s,
    boot_ms: e.boot_ms,
    m: e.m ? String(e.m).slice(0, 80) : undefined,
  }));
  const t = now();
  const ident = await one(env, `SELECT ${COLS.ident} FROM ${T.opsIdents} WHERE aid = ?`, aid);
  if (!ident) {
    await run(env, `INSERT INTO ${T.opsIdents} (aid, user_id, first_seen, last_seen, telemetry_ok) VALUES (?, ?, ?, ?, 1)`, aid, null, t, t);
  } else if (shouldWrite(`ident:${aid}`)) {
    await run(env, `UPDATE ${T.opsIdents} SET last_seen = ? WHERE aid = ?`, t, aid);
  }
  await run(
    env,
    `INSERT INTO ${T.opsTelemetry} (id, at, aid, user_id, n, json) VALUES (?, ?, ?, ?, ?, ?)`,
    crypto.randomUUID(),
    t,
    aid,
    ident?.user_id || null,
    clean.length,
    JSON.stringify(clean),
  );
  void ip;
  return json(request, { ok: true });
}

export async function mergeAndSaveProgress(env, userId, local) {
  const row = await one(env, `SELECT ${COLS.progress} FROM ${T.progressSync} WHERE user_id = ?`, userId);
  const server = row
    ? {
        unlocked: row.unlocked,
        completed: JSON.parse(row.completed || '[]'),
        stars: JSON.parse(row.stars || '{}'),
        craftId: row.craft_id,
        onboarded: Boolean(row.onboarded),
        rev: row.rev,
      }
    : {};
  const merged = mergeProgress(server, local || {});
  const next = {
    unlocked: merged.unlocked,
    completed: JSON.stringify(merged.completed),
    stars: JSON.stringify(merged.stars),
    craft_id: merged.craftId,
    onboarded: merged.onboarded ? 1 : 0,
    rev: merged.rev,
  };
  if (
    row &&
    !changedSince(
      { unlocked: row.unlocked, completed: row.completed, stars: row.stars, craft_id: row.craft_id, onboarded: row.onboarded, rev: row.rev },
      next,
    )
  ) {
    return merged;
  }
  await run(
    env,
    `INSERT INTO ${T.progressSync} (user_id, unlocked, completed, stars, craft_id, onboarded, rev, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET unlocked = excluded.unlocked, completed = excluded.completed, stars = excluded.stars,
       craft_id = excluded.craft_id, onboarded = excluded.onboarded, rev = excluded.rev, updated_at = excluded.updated_at`,
    userId,
    next.unlocked,
    next.completed,
    next.stars,
    next.craft_id,
    next.onboarded,
    next.rev,
    now(),
  );
  return merged;
}

export async function bindIdent(env, aid, userId) {
  if (!aid || !userId) return;
  const t = now();
  const ident = await one(env, `SELECT aid, user_id FROM ${T.opsIdents} WHERE aid = ?`, aid);
  if (!ident) await run(env, `INSERT INTO ${T.opsIdents} (aid, user_id, first_seen, last_seen, telemetry_ok) VALUES (?, ?, ?, ?, 1)`, aid, userId, t, t);
  else await run(env, `UPDATE ${T.opsIdents} SET user_id = ?, last_seen = ? WHERE aid = ?`, userId, t, aid);
}

export async function wipeIdent(env, userId) {
  await run(env, `DELETE FROM ${T.opsTelemetry} WHERE aid IN (SELECT aid FROM ${T.opsIdents} WHERE user_id = ?)`, userId);
  await run(env, `DELETE FROM ${T.opsIdents} WHERE user_id = ?`, userId);
  await run(env, `DELETE FROM ${T.progressSync} WHERE user_id = ?`, userId);
}

export async function runOpsJobs(env) {
  const t = now();
  const day = dayStart(t);
  const windowStart = day - 86400000;
  const blobs = await all(env, `SELECT json, at FROM ${T.opsTelemetry} WHERE at >= ? ORDER BY at LIMIT 2000`, windowStart);
  const funnel = {
    boots: 0,
    starts: 0,
    first_kills: 0,
    onboard_finishes: 0,
    mission1_finishes: 0,
    hunt_matches: 0,
    hunt_practice: 0,
    webgl_fail: 0,
    client_error: 0,
    new_aids: 0,
  };
  const missions = new Map();
  const bootsMs = [];
  for (const b of blobs) {
    let events = [];
    try {
      events = JSON.parse(b.json);
    } catch {
      continue;
    }
    if (b.at < day) continue;
    for (const e of events) {
      if (e.name === 'boot') {
        funnel.boots += 1;
        if (e.boot_ms) bootsMs.push(Number(e.boot_ms));
      }
      if (e.name === 'sortie_start') {
        funnel.starts += 1;
        const key = `${e.mission_id || 0}|${e.kind || 'campaign'}|${e.difficulty || 'normal'}`;
        const row = missions.get(key) || { starts: 0, finishes: 0, fails: 0, times: [] };
        row.starts += 1;
        missions.set(key, row);
      }
      if (e.name === 'first_kill') funnel.first_kills += 1;
      if (e.name === 'sortie_end') {
        const key = `${e.mission_id || 0}|${e.kind || 'campaign'}|${e.difficulty || 'normal'}`;
        const row = missions.get(key) || { starts: 0, finishes: 0, fails: 0, times: [] };
        if (e.win) row.finishes += 1;
        else row.fails += 1;
        if (e.elapsed_s) row.times.push(Number(e.elapsed_s));
        missions.set(key, row);
        if (e.kind === 'onboard' && e.win) funnel.onboard_finishes += 1;
        if (e.kind === 'campaign' && Number(e.mission_id) === 1 && e.win) funnel.mission1_finishes += 1;
        if (e.kind === 'hunt_practice') funnel.hunt_practice += 1;
        if (e.kind === 'hunt' && e.win) funnel.hunt_matches += 1;
      }
      if (e.name === 'webgl_fail') funnel.webgl_fail += 1;
      if (e.name === 'client_error') funnel.client_error += 1;
      if (e.name === 'hunt_room') funnel.hunt_matches += 1;
    }
  }
  const newAids = await one(env, `SELECT COUNT(*) as n FROM ${T.opsIdents} WHERE first_seen >= ?`, day);
  const d7 = await one(
    env,
    `SELECT COUNT(*) as n FROM ${T.opsIdents} WHERE first_seen <= ? AND last_seen >= ?`,
    day - 6.5 * 86400000,
    day,
  );
  const doMin = await one(env, `SELECT COALESCE(SUM(do_ms),0) as ms FROM ${T.matchRooms} WHERE created_at >= ?`, day);
  const waits = await all(env, `SELECT live_at, created_at FROM ${T.matchRooms} WHERE live_at IS NOT NULL AND created_at >= ? LIMIT 500`, day);
  const waitSecs = waits.map((w) => Math.max(0, (Number(w.live_at) - Number(w.created_at)) / 1000)).sort((a, b) => a - b);
  const medianWait = waitSecs.length ? Math.round(waitSecs[Math.floor(waitSecs.length / 2)]) : 0;
  bootsMs.sort((a, b) => a - b);
  const bootP50 = bootsMs.length ? Math.round(bootsMs[Math.floor(bootsMs.length / 2)]) : 0;
  await run(
    env,
    `INSERT INTO ${T.opsFunnel} (day, boots, starts, first_kills, onboard_finishes, mission1_finishes, d7_returns, hunt_matches, hunt_practice, median_hunt_wait_s, do_minutes, webgl_fail, client_error, new_aids, boot_ms_p50)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET boots = excluded.boots, starts = excluded.starts, first_kills = excluded.first_kills,
       onboard_finishes = excluded.onboard_finishes, mission1_finishes = excluded.mission1_finishes, d7_returns = excluded.d7_returns,
       hunt_matches = excluded.hunt_matches, hunt_practice = excluded.hunt_practice, median_hunt_wait_s = excluded.median_hunt_wait_s,
       do_minutes = excluded.do_minutes, webgl_fail = excluded.webgl_fail, client_error = excluded.client_error, new_aids = excluded.new_aids, boot_ms_p50 = excluded.boot_ms_p50`,
    day,
    funnel.boots,
    funnel.starts,
    funnel.first_kills,
    funnel.onboard_finishes,
    funnel.mission1_finishes,
    d7?.n || 0,
    funnel.hunt_matches,
    funnel.hunt_practice,
    medianWait,
    Math.round((doMin?.ms || 0) / 60000),
    funnel.webgl_fail,
    funnel.client_error,
    newAids?.n || 0,
    bootP50,
  );
  for (const [key, row] of missions) {
    const [mission_id, kind, difficulty] = key.split('|');
    const times = row.times.sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : 0;
    await run(
      env,
      `INSERT INTO ${T.opsMissions} (day, mission_id, kind, difficulty, starts, finishes, fails, median_s)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, mission_id, kind, difficulty) DO UPDATE SET starts = excluded.starts, finishes = excluded.finishes, fails = excluded.fails, median_s = excluded.median_s`,
      day,
      Number(mission_id),
      kind,
      difficulty,
      row.starts,
      row.finishes,
      row.fails,
      median,
    );
  }
  await expireOld(
    env,
    `DELETE FROM ${T.opsTelemetry} WHERE rowid IN (SELECT rowid FROM ${T.opsTelemetry} WHERE at < ? LIMIT ${CLEAN_BATCH})`,
    t - 7 * 86400000,
  );
  await run(env, `UPDATE ${T.matchRooms} SET status = 'stale' WHERE status = 'lobby' AND created_at < ?`, t - 30 * 60000);
  await expireOld(
    env,
    `DELETE FROM ${T.authSessions} WHERE rowid IN (SELECT rowid FROM ${T.authSessions} WHERE expires_at < ? LIMIT ${CLEAN_BATCH})`,
    t,
  );
  await expireOld(
    env,
    `DELETE FROM ${T.authMagicLinks} WHERE rowid IN (SELECT rowid FROM ${T.authMagicLinks} WHERE expires_at < ? LIMIT ${CLEAN_BATCH})`,
    t,
  );
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function routeOps(request, env, url) {
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = request.method;
  if (method !== 'GET' && !sameOrigin(request)) return json(request, { error: 'bad origin' }, 403);

  if (path === '/api/ops/login' && method === 'POST') {
    const body = await readBody(request);
    if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) return json(request, { error: 'denied' }, 401);
    const tok = await secretHash(env.ADMIN_SECRET);
    await audit(env, 'login', 'ops');
    return json(request, { ok: true }, 200, { 'set-cookie': opsCookie(tok, request) });
  }

  if (path === '/api/ops/logout' && method === 'POST') {
    return json(request, { ok: true }, 200, { 'set-cookie': opsCookie('', request, true) });
  }

  const gate = await requireOps(request, env);
  if (gate.error) return gate.error;

  if (path === '/api/ops/overview' && method === 'GET') {
    const today = await one(env, `SELECT * FROM ${T.opsFunnel} WHERE day = ?`, dayStart());
    const live = await one(env, `SELECT COUNT(*) as n FROM ${T.matchRooms} WHERE status IN ('lobby','countdown','live')`);
    const players = await one(env, `SELECT COUNT(*) as n FROM ${T.authUsers} WHERE deleted = 0`);
    const mail = await one(env, `SELECT n FROM ${T.opsCounters} WHERE k = 'mail_fail'`);
    return json(request, { today: today || {}, live: live?.n || 0, players: players?.n || 0, mail_fail: mail?.n || 0, flags: await flagsOf(env) });
  }

  if (path === '/api/ops/funnel' && method === 'GET') {
    const rows = await all(env, `SELECT * FROM ${T.opsFunnel} ORDER BY day DESC LIMIT 28`);
    return json(request, { days: rows });
  }

  if (path === '/api/ops/campaign' && method === 'GET') {
    const rows = await all(env, `SELECT * FROM ${T.opsMissions} WHERE day = ? ORDER BY mission_id LIMIT 120`, dayStart());
    return json(request, { missions: rows });
  }

  if (path === '/api/ops/mp' && method === 'GET') {
    const live = await all(
      env,
      `SELECT id, mode, status, host_id, created_at, live_at, do_ms, mission_id FROM ${T.matchRooms} WHERE status IN ('lobby','countdown','live') ORDER BY created_at DESC LIMIT 20`,
    );
    const rows = await all(
      env,
      `SELECT id, mode, status, host_id, created_at, completed_at, live_at, do_ms, mission_id FROM ${T.matchRooms} WHERE status != 'stale' ORDER BY created_at DESC LIMIT 40`,
    );
    return json(request, { live, matches: rows });
  }

  if (path === '/api/ops/players' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').slice(0, 24);
    const rows = q
      ? await all(env, `SELECT ${COLS.user} FROM ${T.authUsers} WHERE username LIKE ? OR email LIKE ? LIMIT 20`, `%${q}%`, `%${q}%`)
      : await all(env, `SELECT ${COLS.user} FROM ${T.authUsers} ORDER BY created_at DESC LIMIT 20`);
    const reports = await all(env, `SELECT id, from_user, about_user, match_id, note, at FROM ${T.moderationReports} ORDER BY at DESC LIMIT 20`);
    return json(request, { players: rows, reports });
  }

  if (path === '/api/ops/ban' && method === 'POST') {
    const body = await readBody(request);
    const id = String(body.userId || '');
    const user = await one(env, `SELECT id, email FROM ${T.authUsers} WHERE id = ?`, id);
    if (!user) return json(request, { error: 'not found' }, 404);
    await run(env, `UPDATE ${T.authUsers} SET banned = 1 WHERE id = ?`, id);
    if (user.email) await run(env, `INSERT OR IGNORE INTO ${T.authBannedEmails} (email, at, reason) VALUES (?, ?, ?)`, user.email, now(), String(body.reason || 'ops'));
    await run(env, `DELETE FROM ${T.authSessions} WHERE user_id = ?`, id);
    await audit(env, 'ban', id);
    return json(request, { ok: true });
  }

  if (path === '/api/ops/flags' && method === 'POST') {
    const body = await readBody(request);
    for (const [k, v] of Object.entries(body.flags || {})) {
      if (!['mp_enabled', 'shop_enabled', 'telemetry_enabled'].includes(k)) continue;
      await run(env, `INSERT INTO ${T.opsFlags} (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, String(v));
    }
    flagsCache = { at: 0, value: null };
    await audit(env, 'flags', JSON.stringify(body.flags || {}));
    return json(request, { ok: true, flags: await flagsOf(env) });
  }

  if (path === '/api/ops/economy' && method === 'GET') {
    const ents = await all(env, `SELECT sku, COUNT(*) as n FROM ${T.shopEntitlements} GROUP BY sku LIMIT 50`);
    return json(request, { entitlements: ents });
  }

  if (path === '/api/ops/csv' && method === 'GET') {
    const which = url.searchParams.get('table') === 'mission' ? T.opsMissions : T.opsFunnel;
    const rows = await all(env, `SELECT * FROM ${which} ORDER BY day DESC LIMIT 90`);
    const keys = rows[0] ? Object.keys(rows[0]) : ['day'];
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => r[k]).join(','))].join('\n');
    return new Response(csv, { status: 200, headers: { 'content-type': 'text/csv', 'content-disposition': `attachment; filename=${which}.csv` } });
  }

  if (path === '/api/ops/audit' && method === 'GET') {
    const rows = await all(env, `SELECT id, at, action, target FROM ${T.opsAudit} ORDER BY at DESC LIMIT 40`);
    return json(request, { audit: rows });
  }

  if (path === '/api/ops/capture' && method === 'GET') {
    return json(request, {
      shots: [
        { mission: 1, weather: 'dawn', note: 'Kent takeoff' },
        { mission: 4, weather: 'clear', note: 'Supply dump' },
        { mission: 70, weather: 'storm', note: 'Red Baron' },
        { mission: 72, weather: 'clear', note: 'Trench' },
        { mission: 10, weather: 'clear', note: 'Channel ships' },
      ],
    });
  }

  return null;
}

export { clampSortie, sortieKind };
