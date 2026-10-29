import { MatchRoom } from './room.js';
import { ensureSchema, one, all, run, userById, userByEmail, userByUsername, squadronOf, entitlementsOf, touchRecent, shouldWrite } from './db.js';
import { TABLES as T } from './tables.js';
import { json, jsonHeaders, token, now, normalizeEmail, validEmail, normalizeUsername, validUsername, normalizeTag, cookie, readCookie, bearer, readBody, originOf, mpEnabled, PROTOCOL, isHttps } from './util.js';
import { sendTemplate, magicMail, inviteMail } from './mail.js';
import { ensureOps, flagsOf, ingestTelemetry, routeOps, mergeAndSaveProgress, bindIdent, wipeIdent, runOpsJobs, bumpCounter, clampSortie } from './ops.js';
import { routeShop, paymentsMode, stripeSecret } from './shop.js';
import { trySso, attachSgl, verifyTurnstileViaPortal, sglConfig } from './sso.js';
import { localSeo, applyGameSeo } from './seo.js';

export { MatchRoom };

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

function sessionCookie(id, request, clear = false) {
  return cookie('wings_session', clear ? '' : id, clear ? 0 : SESSION_MS / 1000, { secure: isHttps(request) });
}

async function currentUser(request, env) {
  const sid = bearer(request) || readCookie(request, 'wings_session');
  if (!sid) return null;
  const row = await one(env, `SELECT s.id as sid, s.expires_at, u.* FROM ${T.authSessions} s JOIN ${T.authUsers} u ON u.id = s.user_id WHERE s.id = ? AND u.deleted = 0`, sid);
  if (!row || row.expires_at < now()) return null;
  if (row.banned) return null;
  row.sessionId = row.sid;
  return row;
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) return { error: json(request, { error: 'please sign in first' }, 401) };
  return { user };
}

async function rate(env, key, max, windowMs) {
  const k = `rl:${key}`;
  const t = now();
  if (env.LIMITS) {
    const rec = (await env.LIMITS.get(k, 'json')) || { n: 0, t };
    if (t - rec.t > windowMs) {
      await env.LIMITS.put(k, JSON.stringify({ n: 1, t }), { expirationTtl: Math.ceil(windowMs / 1000) + 5 });
      return true;
    }
    if (rec.n >= max) return false;
    rec.n += 1;
    await env.LIMITS.put(k, JSON.stringify(rec), { expirationTtl: Math.ceil(windowMs / 1000) + 5 });
    return true;
  }
  return true;
}

function roomStub(env, matchId) {
  const id = env.MATCH_ROOM.idFromName(matchId);
  return env.MATCH_ROOM.get(id, { locationHint: 'wnam' });
}

async function mePayload(env, user) {
  const squadron = await squadronOf(env, user.id);
  const entitlements = await entitlementsOf(env, user.id);
  const members = squadron
    ? await all(
        env,
        `SELECT u.id, u.username, m.role FROM ${T.socialMembers} m JOIN ${T.authUsers} u ON u.id = m.user_id WHERE m.squadron_id = ?`,
        squadron.id,
      )
    : [];
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: user.created_at,
    last_seen: user.last_seen,
    age_ok: user.age_ok,
    squadron: squadron
      ? { id: squadron.id, name: squadron.name, tag: squadron.tag, role: squadron.role, roster_cap: squadron.roster_cap, members }
      : null,
    entitlements,
    nativeShop: false,
  };
}

async function createSession(env, request, userId) {
  const sid = token(24);
  await run(env, `INSERT INTO ${T.authSessions} (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`, sid, userId, now(), now() + SESSION_MS);
  return {
    token: sid,
    headers: { 'set-cookie': sessionCookie(sid, request) },
  };
}

function utcWeekStart(ts = now()) {
  const d = new Date(ts);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff);
  return start;
}

const MOUNT = '/wings-of-honor';

function stripMount(pathname) {
  if (pathname === MOUNT) return '/';
  if (pathname.startsWith(`${MOUNT}/`)) return pathname.slice(MOUNT.length) || '/';
  return pathname;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.supergameslab.com') {
      url.hostname = 'supergameslab.com';
      return Response.redirect(url.toString(), 301);
    }
    const pathname = stripMount(url.pathname);

    if (pathname === '/join' || pathname === '/join/' || pathname === '/wings' || pathname === '/wings/') {
      const dest = new URL(`${MOUNT}/`, url);
      dest.search = url.search;
      return Response.redirect(dest.toString(), 302);
    }

    if (pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: jsonHeaders(request) });
      }
      try {
        await ensureSchema(env);
        await ensureOps(env);
        const routed = new URL(url.toString());
        routed.pathname = pathname;
        const sso = await trySso(request, env, sessionCookie);
        if (sso?.cookie) {
          const headers = new Headers(request.headers);
          headers.set('Cookie', `${headers.get('Cookie') || ''}; wings_session=${sso.sid}`);
          request = new Request(request, { headers });
        }
        const res = await route(request, env, routed);
        if (sso?.cookie) {
          const h = new Headers(res.headers);
          h.append('Set-Cookie', sso.cookie);
          return new Response(res.body, { status: res.status, headers: h });
        }
        return res;
      } catch (err) {
        console.error(err);
        return json(request, { error: 'server error' }, 500);
      }
    }

    if (url.pathname.startsWith(MOUNT) && env.ASSETS) {
      const dest = new URL(pathname + url.search, url.origin);
      const res = await env.ASSETS.fetch(new Request(dest, request));
      try {
        await ensureSchema(env);
        return applyGameSeo(res, await localSeo(env));
      } catch {
        return res;
      }
    }

    return new Response(null, { status: 404 });
  },
  async scheduled(_event, env) {
    await ensureSchema(env);
    await runOpsJobs(env);
  },
};

async function route(request, env, url) {
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = request.method;

  if (path === '/api/health' && method === 'GET') {
    const flags = await flagsOf(env);
    return json(request, {
      ok: true,
      service: 'wings-of-honor',
      runtime: 'cloudflare-worker',
      protocol: PROTOCOL,
      mp: mpEnabled(env) && flags.mp_enabled !== '0' && Boolean(env.MATCH_ROOM && env.DB),
      shop: paymentsMode(env, flags) !== 'off' && Boolean(stripeSecret(env, paymentsMode(env, flags))),
      telemetry: flags.telemetry_enabled !== '0',
      persistent: Boolean(env.DB),
      support: env.SUPPORT_MAIL || '',
      flags,
      turnstileSiteKey: (await sglConfig(env)).turnstileSiteKey || '',
    });
  }

  if (path.startsWith('/api/ops')) {
    const ops = await routeOps(request, env, url);
    if (ops) return ops;
  }

  if (path === '/api/telemetry' && method === 'POST') {
    return ingestTelemetry(request, env);
  }

  if (path === '/api/scores' && method === 'GET') {
    const rows = await all(
      env,
      `SELECT callsign as name, SUM(score) as score, MAX(at) as at
       FROM ${T.progressSorties} WHERE callsign IS NOT NULL AND callsign != 'deleted' AND user_id IS NOT NULL
       GROUP BY user_id ORDER BY score DESC LIMIT 10`,
    );
    return json(request, { scores: rows });
  }

  if (path === '/api/sorties' && method === 'POST') {
    const user = await currentUser(request, env);
    const body = await readBody(request);
    if (!user && !body.aid && !body.callsign) return json(request, { error: 'please sign in first' }, 401);
    if (!(await rate(env, `sortie:${user?.id || body.aid || 'anon'}`, 20, 60000))) return json(request, { error: 'easy does it — try again in a moment' }, 429);
    const clamped = clampSortie(body);
    const id = crypto.randomUUID();
    const callsign = user?.username || String(body.callsign || 'ACE').slice(0, 16);
    await run(
      env,
      `INSERT INTO ${T.progressSorties} (id, user_id, callsign, kind, mission_id, score, kills, deaths, ground, recon, win, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      user?.id || null,
      callsign,
      clamped.kind,
      clamped.missionId,
      clamped.score,
      clamped.kills,
      clamped.deaths,
      clamped.ground,
      clamped.recon,
      clamped.win,
      now(),
    );
    if (user && Array.isArray(body.ribbons)) {
      for (const rib of body.ribbons.slice(0, 8)) {
        await run(env, `INSERT OR IGNORE INTO ${T.progressRibbons} (user_id, ribbon, at, match_id) VALUES (?, ?, ?, ?)`, user.id, String(rib).slice(0, 32), now(), id);
      }
    }
    const scores = await all(
      env,
      `SELECT callsign as name, SUM(score) as score, MAX(at) as at
       FROM ${T.progressSorties} WHERE callsign IS NOT NULL AND callsign != 'deleted' AND user_id IS NOT NULL
       GROUP BY user_id ORDER BY score DESC LIMIT 10`,
    );
    return json(request, { ok: true, scores });
  }

  if (path === '/api/auth/magic' && method === 'POST') {
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    if (!validEmail(email)) return json(request, { error: "that email doesn't look right" }, 400);
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (!(await rate(env, `magic:${email}`, 5, 3600000))) return json(request, { error: 'that is a lot of mail — try again later' }, 429);
    if (!(await rate(env, `magicip:${ip}`, 20, 86400000))) return json(request, { error: 'that is a lot of mail — try again later' }, 429);
    const ts = await verifyTurnstileViaPortal(env, request, body.turnstile);
    if (ts) return ts;
    const tok = token(18);
    await run(env, `INSERT INTO ${T.authMagicLinks} (token, email, created_at, expires_at, used) VALUES (?, ?, ?, ?, 0)`, tok, email, now(), now() + 15 * 60 * 1000);
    const mail = magicMail(originOf(request), tok);
    const sent = await sendTemplate(env, 'magic', email, { link: `${originOf(request)}${MOUNT}/?token=${tok}` }, mail);
    if (!sent.ok) await bumpCounter(env, 'mail_fail');
    const payload = { ok: true };
    if (sent.skipped) payload.devToken = tok;
    return json(request, payload);
  }

  if (path === '/api/auth/consume' && method === 'POST') {
    const body = await readBody(request);
    const tok = String(body.token || url.searchParams.get('token') || '');
    let row = await one(env, `SELECT * FROM ${T.authMagicLinks} WHERE token = ?`, tok);
    const invite = await one(env, `SELECT * FROM ${T.socialInvites} WHERE token = ?`, tok);
    if (!row && invite) row = { email: invite.email, used: 0, expires_at: invite.expires_at };
    if (!row || row.used || row.expires_at < now()) return json(request, { error: 'that link is too old — ask for a new one' }, 400);
    if (row.token || (await one(env, `SELECT token FROM ${T.authMagicLinks} WHERE token = ?`, tok))) {
      await run(env, `UPDATE ${T.authMagicLinks} SET used = 1 WHERE token = ?`, tok);
    }
    const banned = await one(env, `SELECT email FROM ${T.authBannedEmails} WHERE email = ?`, row.email);
    if (banned) return json(request, { error: "this account can't play right now" }, 403);
    let user = await userByEmail(env, row.email);
    if (user?.banned) return json(request, { error: "this account can't play right now" }, 403);
    if (!user) {
      const id = crypto.randomUUID();
      await run(env, `INSERT INTO ${T.authUsers} (id, email, created_at, last_seen, age_ok) VALUES (?, ?, ?, ?, 0)`, id, row.email, now(), now());
      user = await userById(env, id);
    }
    const sess = await createSession(env, request, user.id);
    const aid = String(body.aid || '');
    if (aid) await bindIdent(env, aid, user.id);
    await attachSgl(env, user.email, user.id, user.age_ok);
    const out = { ok: true, user: await mePayload(env, user), invite: invite?.token || null };
    if (body.native) out.token = sess.token;
    return json(request, out, 200, sess.headers);
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const sid = bearer(request) || readCookie(request, 'wings_session');
    if (sid) await run(env, `DELETE FROM ${T.authSessions} WHERE id = ?`, sid);
    return json(request, { ok: true }, 200, { 'set-cookie': sessionCookie('', request, true) });
  }

  if (path === '/api/me' && method === 'GET') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    return json(request, await mePayload(env, user));
  }

  if (path === '/api/me' && method === 'PATCH') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const body = await readBody(request);
    if (body.age_ok) await run(env, `UPDATE ${T.authUsers} SET age_ok = 1 WHERE id = ?`, user.id);
    if (body.username != null) {
      const name = normalizeUsername(body.username);
      if (!validUsername(name)) return json(request, { error: 'pilot names are 3–16 letters, numbers, or underscore' }, 400);
      if (user.username && user.username_changed_at && now() - user.username_changed_at < 30 * 86400000) {
        return json(request, { error: 'you can change your name once a month' }, 400);
      }
      const taken = await userByUsername(env, name);
      if (taken && taken.id !== user.id) return json(request, { error: 'that name is taken' }, 409);
      await run(env, `UPDATE ${T.authUsers} SET username = ?, username_changed_at = ? WHERE id = ?`, name, now(), user.id);
    }
    const fresh = await userById(env, user.id);
    return json(request, await mePayload(env, fresh));
  }

  if (path === '/api/me' && method === 'DELETE') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const sq = await squadronOf(env, user.id);
    if (sq && sq.role === 'owner') {
      const next = await one(
        env,
        `SELECT user_id FROM ${T.socialMembers} WHERE squadron_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 1`,
        sq.id,
        user.id,
      );
      if (next) {
        await run(env, `UPDATE ${T.socialSquadrons} SET owner_id = ? WHERE id = ?`, next.user_id, sq.id);
        await run(env, `UPDATE ${T.socialMembers} SET role = 'owner' WHERE squadron_id = ? AND user_id = ?`, sq.id, next.user_id);
      } else {
        await run(env, `UPDATE ${T.socialSquadrons} SET dissolved = 1 WHERE id = ?`, sq.id);
      }
    }
    await run(env, `DELETE FROM ${T.socialMembers} WHERE user_id = ?`, user.id);
    await run(env, `DELETE FROM ${T.authSessions} WHERE user_id = ?`, user.id);
    await run(env, `UPDATE ${T.authUsers} SET deleted = 1, username = NULL, email = ? WHERE id = ?`, `deleted+${user.id}@invalid`, user.id);
    await run(env, `UPDATE ${T.matchPilots} SET callsign = 'deleted' WHERE user_id = ?`, user.id);
    await run(env, `UPDATE ${T.progressSorties} SET callsign = 'deleted' WHERE user_id = ?`, user.id);
    await wipeIdent(env, user.id);
    return json(request, { ok: true }, 200, { 'set-cookie': sessionCookie('', request, true) });
  }

  if (path === '/api/presence' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    if (shouldWrite(`seen:${user.id}`)) await run(env, `UPDATE ${T.authUsers} SET last_seen = ? WHERE id = ?`, now(), user.id);
    const pending = await all(
      env,
      `SELECT i.token, i.kind, i.payload, u.username as from_name FROM ${T.socialInvites} i JOIN ${T.authUsers} u ON u.id = i.from_user
       WHERE i.accepted = 0 AND i.expires_at > ? AND (i.to_user = ? OR i.email = ?) ORDER BY i.created_at DESC LIMIT 8`,
      now(),
      user.id,
      user.email,
    );
    return json(request, { ok: true, invites: pending });
  }

  if (path === '/api/users/lookup' && method === 'GET') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const q = normalizeUsername(url.searchParams.get('u') || '');
    if (q.length < 3) return json(request, { user: null });
    if (!(await rate(env, `lookup:${user.id}`, 30, 60000))) return json(request, { error: 'easy does it — try again in a moment' }, 429);
    const found = await userByUsername(env, q);
    if (!found || found.id === user.id) return json(request, { user: null });
    const blocked = await one(env, `SELECT 1 FROM ${T.socialBlocks} WHERE user_id = ? AND blocked_id = ?`, found.id, user.id);
    if (blocked) return json(request, { user: null });
    const sq = await squadronOf(env, found.id);
    return json(request, { user: { id: found.id, username: found.username, tag: sq?.tag || '', last_seen: found.last_seen } });
  }

  if (path === '/api/recent' && method === 'GET') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const rows = await all(
      env,
      `SELECT u.id, u.username, r.at FROM ${T.socialRecent} r JOIN ${T.authUsers} u ON u.id = r.other_id
       WHERE r.user_id = ? AND u.deleted = 0 ORDER BY r.at DESC LIMIT 20`,
      user.id,
    );
    return json(request, { recent: rows });
  }

  if (path === '/api/blocks' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const body = await readBody(request);
    const other = await userByUsername(env, normalizeUsername(body.username));
    if (!other) return json(request, { error: 'not found' }, 404);
    await run(env, `INSERT OR IGNORE INTO ${T.socialBlocks} (user_id, blocked_id, created_at) VALUES (?, ?, ?)`, user.id, other.id, now());
    return json(request, { ok: true });
  }

  if (path === '/api/squadrons' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    if (!user.username) return json(request, { error: 'pick a pilot name first' }, 400);
    const existing = await squadronOf(env, user.id);
    if (existing) return json(request, { error: 'already in a squadron' }, 400);
    const body = await readBody(request);
    const name = String(body.name || '').trim().slice(0, 32);
    const tag = normalizeTag(body.tag);
    if (name.length < 3 || tag.length < 2) return json(request, { error: 'name and 2–4 letter tag required' }, 400);
    const taken = await one(env, `SELECT id FROM ${T.socialSquadrons} WHERE tag = ? AND dissolved = 0`, tag);
    if (taken) return json(request, { error: 'tag taken' }, 409);
    const id = crypto.randomUUID();
    await run(env, `INSERT INTO ${T.socialSquadrons} (id, name, tag, owner_id, roster_cap, created_at) VALUES (?, ?, ?, ?, 16, ?)`, id, name, tag, user.id, now());
    await run(env, `INSERT INTO ${T.socialMembers} (squadron_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, id, user.id, 'owner', now());
    const fresh = await userById(env, user.id);
    return json(request, await mePayload(env, fresh));
  }

  if (path.startsWith('/api/squadrons/') && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const parts = path.split('/');
    const sid = parts[3];
    const action = parts[4];
    const sq = await one(env, `SELECT * FROM ${T.socialSquadrons} WHERE id = ? AND dissolved = 0`, sid);
    if (!sq) return json(request, { error: 'squadron gone' }, 404);
    const member = await one(env, `SELECT * FROM ${T.socialMembers} WHERE squadron_id = ? AND user_id = ?`, sid, user.id);
    const body = await readBody(request);

    if (action === 'invite') {
      if (!member || (member.role !== 'owner' && member.role !== 'officer')) return json(request, { error: 'officers only' }, 403);
      return inviteSomeone(request, env, user, body, { kind: 'squadron', payload: { squadronId: sid } });
    }
    if (action === 'leave') {
      if (!member) return json(request, { error: 'not a member' }, 400);
      const lastRated = await one(
        env,
        `SELECT m.completed_at FROM ${T.matchPilots} p JOIN ${T.matchRooms} m ON m.id = p.match_id
         WHERE p.user_id = ? AND m.mode = 'duel' AND m.ranked = 1 AND m.completed_at IS NOT NULL ORDER BY m.completed_at DESC LIMIT 1`,
        user.id,
      );
      if (lastRated && now() - lastRated.completed_at < 24 * 3600000) return json(request, { error: 'wait a day after a ranked duel' }, 400);
      await run(env, `DELETE FROM ${T.socialMembers} WHERE squadron_id = ? AND user_id = ?`, sid, user.id);
      if (member.role === 'owner') {
        const next = await one(env, `SELECT user_id FROM ${T.socialMembers} WHERE squadron_id = ? ORDER BY joined_at ASC LIMIT 1`, sid);
        if (next) {
          await run(env, `UPDATE ${T.socialSquadrons} SET owner_id = ? WHERE id = ?`, next.user_id, sid);
          await run(env, `UPDATE ${T.socialMembers} SET role = 'owner' WHERE squadron_id = ? AND user_id = ?`, sid, next.user_id);
        } else await run(env, `UPDATE ${T.socialSquadrons} SET dissolved = 1 WHERE id = ?`, sid);
      }
      return json(request, { ok: true });
    }
    if (action === 'kick') {
      if (!member || member.role !== 'owner') return json(request, { error: 'owner only' }, 403);
      const other = await userByUsername(env, normalizeUsername(body.username));
      if (!other) return json(request, { error: 'not found' }, 404);
      await run(env, `DELETE FROM ${T.socialMembers} WHERE squadron_id = ? AND user_id = ?`, sid, other.id);
      return json(request, { ok: true });
    }
    if (action === 'transfer') {
      if (!member || member.role !== 'owner') return json(request, { error: 'owner only' }, 403);
      const other = await userByUsername(env, normalizeUsername(body.username));
      if (!other) return json(request, { error: 'not found' }, 404);
      await run(env, `UPDATE ${T.socialSquadrons} SET owner_id = ? WHERE id = ?`, other.id, sid);
      await run(env, `UPDATE ${T.socialMembers} SET role = 'owner' WHERE squadron_id = ? AND user_id = ?`, sid, other.id);
      await run(env, `UPDATE ${T.socialMembers} SET role = 'officer' WHERE squadron_id = ? AND user_id = ?`, sid, user.id);
      return json(request, { ok: true });
    }
    return json(request, { error: 'not found' }, 404);
  }

  if (path === '/api/invites' && method === 'GET') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const rows = await all(
      env,
      `SELECT token, kind, payload, from_user, created_at FROM ${T.socialInvites} WHERE accepted = 0 AND expires_at > ? AND (to_user = ? OR email = ?)`,
      now(),
      user.id,
      user.email,
    );
    return json(request, { invites: rows });
  }

  if (path.startsWith('/api/invites/') && path.endsWith('/accept') && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const tok = path.split('/')[3];
    const inv = await one(env, `SELECT * FROM ${T.socialInvites} WHERE token = ?`, tok);
    if (!inv || inv.accepted || inv.expires_at < now()) return json(request, { error: 'that invite is too old' }, 400);
    if (inv.email && inv.email !== user.email) {
      return json(request, { error: `this invite is for ${inv.email}` }, 403);
    }
    const payload = inv.payload ? JSON.parse(inv.payload) : {};
    if (inv.kind === 'squadron' && payload.squadronId) {
      const existing = await squadronOf(env, user.id);
      if (existing) return json(request, { error: 'already in a squadron' }, 400);
      const sq = await one(env, `SELECT * FROM ${T.socialSquadrons} WHERE id = ? AND dissolved = 0`, payload.squadronId);
      if (!sq) return json(request, { error: 'squadron gone' }, 404);
      const count = await one(env, `SELECT COUNT(*) as n FROM ${T.socialMembers} WHERE squadron_id = ?`, sq.id);
      const cap = sq.roster_cap || 16;
      if (count.n >= cap) return json(request, { error: 'roster full' }, 400);
      await run(env, `INSERT OR IGNORE INTO ${T.socialMembers} (squadron_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)`, sq.id, user.id, 'pilot', now());
      await touchRecent(env, user.id, inv.from_user);
    }
    if ((inv.kind === 'hunt' || inv.kind === 'duel') && payload.matchId) {
      const stub = roomStub(env, payload.matchId);
      const sq = await squadronOf(env, user.id);
      const skins = await entitlementsOf(env, user.id);
      const skinId = skins.find((s) => s.sku.startsWith('skin_'))?.sku.replace('skin_', '') || (skins.some((s) => s.sku === 'founder') ? 'founder' : 'linen');
      const res = await stub.fetch('https://room/admit', {
        method: 'POST',
        body: JSON.stringify({
          id: user.id,
          username: user.username,
          tag: sq?.tag || '',
          team: payload.team || 0,
          skinId,
        }),
      });
      const data = await res.json();
      if (!res.ok) return json(request, data, res.status);
      await run(env, `INSERT OR IGNORE INTO ${T.matchPilots} (match_id, user_id, team, callsign) VALUES (?, ?, ?, ?)`, payload.matchId, user.id, payload.team || 0, user.username);
      await touchRecent(env, user.id, inv.from_user);
    }
    await run(env, `UPDATE ${T.socialInvites} SET accepted = 1, to_user = ? WHERE token = ?`, user.id, tok);
    return json(request, { ok: true, kind: inv.kind, payload });
  }

  if (path === '/api/progress' && method === 'GET') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const row = await one(env, `SELECT * FROM ${T.progressSync} WHERE user_id = ?`, user.id);
    return json(request, {
      progress: row
        ? {
            unlocked: row.unlocked,
            completed: JSON.parse(row.completed || '[]'),
            stars: JSON.parse(row.stars || '{}'),
            craftId: row.craft_id,
            onboarded: Boolean(row.onboarded),
            rev: row.rev,
          }
        : null,
    });
  }

  if (path === '/api/progress' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const body = await readBody(request);
    const merged = await mergeAndSaveProgress(env, user.id, body.progress || body);
    return json(request, { ok: true, progress: merged });
  }

  if (path === '/api/reports' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const body = await readBody(request);
    await run(
      env,
      `INSERT INTO ${T.moderationReports} (id, from_user, about_user, match_id, note, at) VALUES (?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      user.id,
      String(body.aboutUser || '').slice(0, 40),
      String(body.matchId || '').slice(0, 40),
      String(body.note || '').slice(0, 200),
      now(),
    );
    return json(request, { ok: true });
  }

  if (path === '/api/matches/quick' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    if (!user.username) return json(request, { error: 'pick a pilot name first' }, 400);
    const flags = await flagsOf(env);
    if (!mpEnabled(env) || flags.mp_enabled === '0' || !env.MATCH_ROOM) return json(request, { error: 'friends mode is taking a rest' }, 503);
    const open = await one(env, `SELECT id FROM ${T.matchRooms} WHERE mode = 'hunt' AND status = 'lobby' AND created_at > ? ORDER BY created_at DESC LIMIT 1`, now() - 20 * 60000);
    if (open) {
      const stub = roomStub(env, open.id);
      const sq = await squadronOf(env, user.id);
      const res = await stub.fetch('https://room/admit', {
        method: 'POST',
        body: JSON.stringify({ id: user.id, username: user.username, tag: sq?.tag || '', team: 0, skinId: pickSkin(await entitlementsOf(env, user.id)) }),
      });
      const data = await res.json();
      if (!res.ok) return json(request, data, res.status);
      await run(env, `INSERT OR IGNORE INTO ${T.matchPilots} (match_id, user_id, team, callsign) VALUES (?, ?, ?, ?)`, open.id, user.id, 0, user.username);
      return json(request, { ok: true, matchId: open.id, joined: true });
    }
    const id = crypto.randomUUID();
    const sq = await squadronOf(env, user.id);
    await run(
      env,
      `INSERT INTO ${T.matchRooms} (id, mode, ranked, difficulty, mission_id, status, host_id, created_at, seed) VALUES (?, 'hunt', 0, 'normal', 3, 'lobby', ?, ?, 0)`,
      id,
      user.id,
      now(),
    );
    await run(env, `INSERT INTO ${T.matchPilots} (match_id, user_id, team, callsign) VALUES (?, ?, 0, ?)`, id, user.id, user.username);
    const stub = roomStub(env, id);
    await stub.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify({
        id,
        mode: 'hunt',
        ranked: false,
        difficulty: 'normal',
        missionId: 3,
        hostId: user.id,
        lives: 1,
        host: { id: user.id, username: user.username, tag: sq?.tag || '', team: 0, skinId: pickSkin(await entitlementsOf(env, user.id)) },
      }),
    });
    return json(request, { ok: true, matchId: id, created: true });
  }

  if (path === '/api/matches' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const flags = await flagsOf(env);
    if (!mpEnabled(env) || flags.mp_enabled === '0' || !env.MATCH_ROOM) return json(request, { error: 'friends mode is taking a rest' }, 503);
    if (!user.username) return json(request, { error: 'pick a pilot name first' }, 400);
    const body = await readBody(request);
    const mode = body.mode === 'duel' ? 'duel' : 'hunt';
    const ranked = Boolean(body.ranked) && mode === 'duel';
    if (ranked && !user.email) return json(request, { error: 'ranked needs a signed-in email' }, 400);
    const sq = await squadronOf(env, user.id);
    if (ranked && !sq) return json(request, { error: 'ranked needs a squadron' }, 400);
    const id = crypto.randomUUID();
    const missionId = Number(body.missionId) || (mode === 'duel' ? 6 : 3);
    await run(
      env,
      `INSERT INTO ${T.matchRooms} (id, mode, ranked, difficulty, mission_id, status, host_id, created_at, seed) VALUES (?, ?, ?, ?, ?, 'lobby', ?, ?, 0)`,
      id,
      mode,
      ranked ? 1 : 0,
      body.difficulty || 'normal',
      missionId,
      user.id,
      now(),
    );
    await run(env, `INSERT INTO ${T.matchPilots} (match_id, user_id, team, callsign) VALUES (?, ?, ?, ?)`, id, user.id, body.team || 0, user.username);
    const skins = await entitlementsOf(env, user.id);
    const skinId = pickSkin(skins);
    const stub = roomStub(env, id);
    await stub.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify({
        id,
        mode,
        ranked,
        difficulty: body.difficulty || 'normal',
        missionId,
        hostId: user.id,
        lives: body.lives === 3 ? 3 : 1,
        host: { id: user.id, username: user.username, tag: sq?.tag || (mode === 'duel' && !ranked ? 'SCR' : ''), team: body.team || 0, skinId },
      }),
    });
    if (mode === 'duel' && body.challengeTag) {
      const other = await one(env, `SELECT * FROM ${T.socialSquadrons} WHERE tag = ? AND dissolved = 0`, normalizeTag(body.challengeTag));
      if (!other) return json(request, { error: 'squadron not found' }, 404);
      await run(env, `INSERT INTO ${T.matchChallenges} (id, from_squadron, to_squadron, match_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`, crypto.randomUUID(), sq?.id || '', other.id, id, 'open', now());
      const officers = await all(env, `SELECT u.id, u.email, u.username FROM ${T.socialMembers} m JOIN ${T.authUsers} u ON u.id = m.user_id WHERE m.squadron_id = ? AND m.role IN ('owner','officer')`, other.id);
      for (const off of officers) {
        await inviteSomeone(request, env, user, { username: off.username }, { kind: 'duel', payload: { matchId: id, team: 1 } });
      }
    }
    return json(request, { ok: true, matchId: id });
  }

  if (path.startsWith('/api/matches/') && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const parts = path.split('/');
    const matchId = parts[3];
    const action = parts[4];
    const match = await one(env, `SELECT * FROM ${T.matchRooms} WHERE id = ?`, matchId);
    if (!match) return json(request, { error: "that room isn't here" }, 404);
    const stub = roomStub(env, matchId);
    if (action === 'ticket') {
      const res = await stub.fetch('https://room/ticket', { method: 'POST', body: JSON.stringify({ userId: user.id }) });
      const data = await res.json();
      return json(request, data, res.status);
    }
    if (action === 'invite') {
      const body = await readBody(request);
      return inviteSomeone(request, env, user, body, { kind: match.mode, payload: { matchId, team: body.team || 0 } });
    }
    if (action === 'join') {
      const sq = await squadronOf(env, user.id);
      const res = await stub.fetch('https://room/admit', {
        method: 'POST',
        body: JSON.stringify({ id: user.id, username: user.username, tag: sq?.tag || '', team: Number((await readBody(request)).team) || 0, skinId: pickSkin(await entitlementsOf(env, user.id)) }),
      });
      const data = await res.json();
      if (!res.ok) return json(request, data, res.status);
      await run(env, `INSERT OR IGNORE INTO ${T.matchPilots} (match_id, user_id, team, callsign) VALUES (?, ?, ?, ?)`, matchId, user.id, 0, user.username);
      return json(request, { ok: true });
    }
    return json(request, { error: 'not found' }, 404);
  }

  if (path.startsWith('/api/match/') && path.endsWith('/ws')) {
    const matchId = path.split('/')[3];
    const stub = roomStub(env, matchId);
    return stub.fetch(request);
  }

  if (path === '/api/logbook' && method === 'GET') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    const stats = await one(
      env,
      `SELECT COUNT(*) as sorties, COALESCE(SUM(kills),0) as kills, COALESCE(SUM(deaths),0) as deaths,
              COALESCE(SUM(ground),0) as ground, COALESCE(SUM(recon),0) as recon, COALESCE(SUM(score),0) as score
       FROM ${T.progressSorties} WHERE user_id = ?`,
      user.id,
    );
    const wins = await all(
      env,
      `SELECT kind as mode, COUNT(*) as n FROM ${T.progressSorties} WHERE user_id = ? AND win = 1 GROUP BY kind`,
      user.id,
    );
    const ribbons = await all(env, `SELECT ribbon, at, match_id FROM ${T.progressRibbons} WHERE user_id = ? ORDER BY at DESC LIMIT 24`, user.id);
    const recent = await all(
      env,
      `SELECT id, kind as mode, at as completed_at, kills, deaths, ground, score, win FROM ${T.progressSorties}
       WHERE user_id = ? ORDER BY at DESC LIMIT 16`,
      user.id,
    );
    return json(request, { stats, wins, ribbons, recent });
  }

  if (path === '/api/board/weekly' && method === 'GET') {
    const start = utcWeekStart();
    const rows = await all(
      env,
      `SELECT h.callsign as name, SUM(h.kills) as kills, s.tag
       FROM ${T.progressSorties} h
       LEFT JOIN ${T.socialMembers} sm ON sm.user_id = h.user_id
       LEFT JOIN ${T.socialSquadrons} s ON s.id = sm.squadron_id AND s.dissolved = 0
       WHERE h.at >= ? AND h.kind IN ('hunt','duel') AND h.user_id IS NOT NULL
       GROUP BY h.user_id ORDER BY kills DESC LIMIT 20`,
      start,
    );
    return json(request, { week: start, board: rows });
  }

  const shop = await routeShop(request, env, url, { currentUser, requireUser });
  if (shop) return shop;

  return json(request, { error: 'not found' }, 404);
}

function pickSkin(list) {
  if (list.some((s) => s.sku === 'founder')) return 'founder';
  const skin = list.find((s) => s.sku.startsWith('skin_'));
  return skin ? skin.sku.replace('skin_', '') : 'linen';
}

async function inviteSomeone(request, env, user, body, { kind, payload }) {
  const outstanding = await one(env, `SELECT COUNT(*) as n FROM ${T.socialInvites} WHERE from_user = ? AND accepted = 0 AND expires_at > ?`, user.id, now());
  if (outstanding.n >= 20) return json(request, { error: 'too many outstanding invites' }, 429);
  let toUser = null;
  let email = '';
  if (body.username) {
    toUser = await userByUsername(env, normalizeUsername(body.username));
    if (!toUser) return json(request, { error: 'nobody by that name yet' }, 404);
    const blocked = await one(env, `SELECT 1 FROM ${T.socialBlocks} WHERE user_id = ? AND blocked_id = ?`, toUser.id, user.id);
    if (blocked) return json(request, { error: 'cannot invite' }, 403);
    email = toUser.email;
  } else {
    email = normalizeEmail(body.email);
    if (!validEmail(email)) return json(request, { error: 'need a name or email' }, 400);
    toUser = await userByEmail(env, email);
  }
  const tok = token(16);
  await run(
    env,
    `INSERT INTO ${T.socialInvites} (token, kind, from_user, email, to_user, payload, created_at, expires_at, accepted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    tok,
    kind,
    user.id,
    email,
    toUser?.id || null,
    JSON.stringify(payload),
    now(),
    now() + 7 * 86400000,
  );
  await run(env, `INSERT INTO ${T.authMagicLinks} (token, email, created_at, expires_at, used) VALUES (?, ?, ?, ?, 0)`, tok, email, now(), now() + 7 * 86400000);
  const mail = inviteMail(originOf(request), tok, user.username || 'A pilot', kind);
  const sent = await sendTemplate(env, 'invite', email, { link: `${originOf(request)}${MOUNT}/?token=${tok}`, fromName: user.username || 'A pilot' }, mail);
  if (!sent.ok) await bumpCounter(env, 'mail_fail');
  if (toUser) await touchRecent(env, user.id, toUser.id);
  const out = { ok: true, token: tok };
  if (sent.skipped) out.devToken = tok;
  return json(request, out);
}
