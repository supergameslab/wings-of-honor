import { one, run, userByEmail, userById } from './db.js';
import { TABLES as T } from './tables.js';
import { json, now, token, readCookie, bearer, timingSafeEqual } from './util.js';

export const GAME = 'wings';
export const SESSION_COOKIE = 'wings_session';
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export async function portalFetch(env, path, body) {
  if (!env.PORTAL || !env.SGL_INTERNAL) return null;
  try {
    const res = await env.PORTAL.fetch(new Request(`https://sgl${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sgl-internal': env.SGL_INTERNAL },
      body: JSON.stringify(body || {}),
    }));
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export async function verifyTurnstileViaPortal(env, request, turnstileToken) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (env.PORTAL && env.SGL_INTERNAL) {
    const data = await portalFetch(env, '/api/sgl/turnstile/verify', { token: turnstileToken, ip });
    if (!data) return json(request, { error: 'that check did not pass' }, 400);
    if (!data.ok) return json(request, { error: data.error || 'that check did not pass' }, 400);
    return null;
  }
  if (env.TURNSTILE_SECRET) {
    if (!turnstileToken) return json(request, { error: 'please tick the check' }, 400);
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: String(turnstileToken) });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!data.success) return json(request, { error: 'that check did not pass' }, 400);
    return null;
  }
  if (env.MP_DEV === '0') return json(request, { error: 'turnstile is not ready' }, 400);
  return null;
}

export async function attachSgl(env, email, gameUserId, ageOk) {
  await portalFetch(env, '/api/sgl/identity/attach', { email, game: GAME, game_user_id: gameUserId, age_ok: ageOk });
}

export async function sglConfig(env) {
  if (!env.PORTAL) return { turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' };
  try {
    const res = await env.PORTAL.fetch('https://sgl/api/sgl/config');
    return await res.json();
  } catch {
    return { turnstileSiteKey: '' };
  }
}

export async function trySso(request, env, sessionCookie) {
  if (bearer(request) || readCookie(request, SESSION_COOKIE)) return null;
  const sid = readCookie(request, 'sgl_session');
  if (!sid || !env.PORTAL || !env.SGL_INTERNAL) return null;
  const resolved = await portalFetch(env, '/api/sgl/identity/resolve', { sgl_session: sid });
  if (!resolved?.ok || !resolved.email) return null;
  const any = await one(env, `SELECT * FROM ${T.authUsers} WHERE email = ?`, resolved.email);
  if (any?.deleted) return null;
  if (any?.banned) return null;
  let user = await userByEmail(env, resolved.email);
  if (!user) {
    const id = crypto.randomUUID();
    await run(
      env,
      `INSERT INTO ${T.authUsers} (id, email, created_at, last_seen, age_ok) VALUES (?, ?, ?, ?, ?)`,
      id,
      resolved.email,
      now(),
      now(),
      resolved.age_ok ? 1 : 0,
    );
    user = await userById(env, id);
  }
  if (!user) return null;
  await attachSgl(env, user.email, user.id, user.age_ok);
  const raw = token(24);
  await run(env, `INSERT INTO ${T.authSessions} (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`, raw, user.id, now(), now() + SESSION_MS);
  return { sid: raw, cookie: sessionCookie(raw, request), user };
}

export { timingSafeEqual };
