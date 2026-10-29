import { TABLES as T, COLS } from './tables.js';

export { TABLES, COLS, INDEXES, LEGACY_TABLES } from './tables.js';

const WRITE_GAP_MS = 3 * 60 * 1000;
const lastWrite = new Map();

export async function ensureSchema(env) {
  if (!env.DB) return;
}

export function shouldWrite(key, minMs = WRITE_GAP_MS, nowTs = Date.now()) {
  if (!key) return false;
  const prev = lastWrite.get(key) || 0;
  if (nowTs - prev < minMs) return false;
  lastWrite.set(key, nowTs);
  if (lastWrite.size > 5000) {
    const cutoff = nowTs - minMs;
    for (const [k, at] of lastWrite) {
      if (at < cutoff) lastWrite.delete(k);
    }
  }
  return true;
}

export function changedSince(prev, next) {
  if (!prev) return true;
  return JSON.stringify(prev) !== JSON.stringify(next);
}

export async function one(env, sql, ...binds) {
  return env.DB.prepare(sql)
    .bind(...binds)
    .first();
}

export async function all(env, sql, ...binds) {
  const res = await env.DB.prepare(sql)
    .bind(...binds)
    .all();
  return res.results || [];
}

export async function run(env, sql, ...binds) {
  return env.DB.prepare(sql)
    .bind(...binds)
    .run();
}

export async function userById(env, id) {
  return one(env, `SELECT ${COLS.user} FROM ${T.authUsers} WHERE id = ? AND deleted = 0`, id);
}

export async function userByEmail(env, email) {
  return one(env, `SELECT ${COLS.user} FROM ${T.authUsers} WHERE email = ? AND deleted = 0`, email);
}

export async function userByUsername(env, username) {
  return one(env, `SELECT ${COLS.user} FROM ${T.authUsers} WHERE username = ? AND deleted = 0`, username);
}

export async function publicUser(row, extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    created_at: row.created_at,
    last_seen: row.last_seen,
    ...extra,
  };
}

export async function squadronOf(env, userId) {
  return one(
    env,
    `SELECT s.id, s.name, s.tag, s.owner_id, s.roster_cap, s.created_at, s.dissolved, m.role
     FROM ${T.socialMembers} m JOIN ${T.socialSquadrons} s ON s.id = m.squadron_id
     WHERE m.user_id = ? AND s.dissolved = 0`,
    userId,
  );
}

export async function entitlementsOf(env, userId) {
  return all(env, `SELECT sku, at, expires_at FROM ${T.shopEntitlements} WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)`, userId, Date.now());
}

export async function touchRecent(env, a, b) {
  if (!a || !b || a === b) return;
  const t = Date.now();
  await run(
    env,
    `INSERT INTO ${T.socialRecent} (user_id, other_id, at) VALUES (?, ?, ?) ON CONFLICT(user_id, other_id) DO UPDATE SET at = excluded.at`,
    a,
    b,
    t,
  );
  await run(
    env,
    `INSERT INTO ${T.socialRecent} (user_id, other_id, at) VALUES (?, ?, ?) ON CONFLICT(user_id, other_id) DO UPDATE SET at = excluded.at`,
    b,
    a,
    t,
  );
}
