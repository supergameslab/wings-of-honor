const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, username_changed_at INTEGER, email TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at INTEGER NOT NULL, last_seen INTEGER, age_ok INTEGER DEFAULT 0, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS magic_links (token TEXT PRIMARY KEY, email TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS squadrons (id TEXT PRIMARY KEY, name TEXT NOT NULL, tag TEXT NOT NULL UNIQUE COLLATE NOCASE, owner_id TEXT NOT NULL, roster_cap INTEGER DEFAULT 16, tag_color TEXT, created_at INTEGER NOT NULL, dissolved INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS squadron_members (squadron_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (squadron_id, user_id));
CREATE TABLE IF NOT EXISTS invites (token TEXT PRIMARY KEY, kind TEXT NOT NULL, from_user TEXT NOT NULL, email TEXT, to_user TEXT, payload TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, accepted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, from_squadron TEXT NOT NULL, to_squadron TEXT NOT NULL, match_id TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS blocks (user_id TEXT NOT NULL, blocked_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, blocked_id));
CREATE TABLE IF NOT EXISTS recent_contacts (user_id TEXT NOT NULL, other_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, other_id));
CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, mode TEXT NOT NULL, ranked INTEGER DEFAULT 0, difficulty TEXT, mission_id INTEGER, status TEXT NOT NULL, host_id TEXT, created_at INTEGER NOT NULL, completed_at INTEGER, winner_team INTEGER, seed INTEGER);
CREATE TABLE IF NOT EXISTS match_pilots (match_id TEXT NOT NULL, user_id TEXT NOT NULL, team INTEGER NOT NULL, kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, ground INTEGER DEFAULT 0, recon INTEGER DEFAULT 0, alive INTEGER DEFAULT 1, callsign TEXT, PRIMARY KEY (match_id, user_id));
CREATE TABLE IF NOT EXISTS ribbons (user_id TEXT NOT NULL, ribbon TEXT NOT NULL, at INTEGER NOT NULL, match_id TEXT, PRIMARY KEY (user_id, ribbon, match_id));
CREATE TABLE IF NOT EXISTS entitlements (user_id TEXT NOT NULL, sku TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, sku));
CREATE TABLE IF NOT EXISTS join_tickets (ticket TEXT PRIMARY KEY, match_id TEXT NOT NULL, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sortie_history (id TEXT PRIMARY KEY, user_id TEXT, callsign TEXT, kind TEXT NOT NULL, mission_id INTEGER, score INTEGER DEFAULT 0, kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, ground INTEGER DEFAULT 0, recon INTEGER DEFAULT 0, win INTEGER DEFAULT 0, at INTEGER NOT NULL);
`;

let ready = false;
let historyReady = false;

export async function ensureSchema(env) {
  if (!env.DB) return;
  if (!ready) {
    const statements = SCHEMA.split(';')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => env.DB.prepare(s));
    await env.DB.batch(statements);
    ready = true;
    historyReady = true;
    return;
  }
  if (!historyReady) {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sortie_history (id TEXT PRIMARY KEY, user_id TEXT, callsign TEXT, kind TEXT NOT NULL, mission_id INTEGER, score INTEGER DEFAULT 0, kills INTEGER DEFAULT 0, deaths INTEGER DEFAULT 0, ground INTEGER DEFAULT 0, recon INTEGER DEFAULT 0, win INTEGER DEFAULT 0, at INTEGER NOT NULL)`,
    ).run();
    historyReady = true;
  }
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
  return one(env, 'SELECT * FROM users WHERE id = ? AND deleted = 0', id);
}

export async function userByEmail(env, email) {
  return one(env, 'SELECT * FROM users WHERE email = ? AND deleted = 0', email);
}

export async function userByUsername(env, username) {
  return one(env, 'SELECT * FROM users WHERE username = ? AND deleted = 0', username);
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
    `SELECT s.*, m.role FROM squadron_members m JOIN squadrons s ON s.id = m.squadron_id
     WHERE m.user_id = ? AND s.dissolved = 0`,
    userId,
  );
}

export async function entitlementsOf(env, userId) {
  return all(env, 'SELECT sku, at FROM entitlements WHERE user_id = ?', userId);
}

export async function touchRecent(env, a, b) {
  if (!a || !b || a === b) return;
  const t = Date.now();
  await run(env, 'INSERT INTO recent_contacts (user_id, other_id, at) VALUES (?, ?, ?) ON CONFLICT(user_id, other_id) DO UPDATE SET at = excluded.at', a, b, t);
  await run(env, 'INSERT INTO recent_contacts (user_id, other_id, at) VALUES (?, ?, ?) ON CONFLICT(user_id, other_id) DO UPDATE SET at = excluded.at', b, a, t);
}
