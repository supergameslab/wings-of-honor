import { DIFFICULTY, layoutFor, missionById } from '../src/campaign.js';
import { ensureSchema } from './db.js';
import {
  PROTOCOL,
  NET,
  COMBAT,
  windFor,
  paramsForMission,
  heightAt,
  createCraft,
  integrateFlight,
  createAiCraft,
  updateAi,
  spawnBullet,
  planeById,
  rightFromHeading,
  stepBullet,
  spawnBomb,
  stepBomb,
  segmentHitsSphere,
  bombHitsTarget,
  groundSpec,
  isStrafeable,
  stepConvoy,
  killScore,
  aceById,
} from '../src/sim/index.js';

const TICK_MS = NET.TICK_DT * 1000;

function sample(room) {
  return (x, z) => heightAt(x, z, room.terrain, room.params);
}

function spawnPoint(room, team, index, count) {
  const spread = (index - (count - 1) / 2) * 18;
  if (room.mode === 'duel') {
    if (team === 1) return { x: spread, z: -90, heading: Math.PI, y: 0 };
    return { x: spread, z: 90, heading: 0, y: 0 };
  }
  return { x: spread, z: 80 + index * 6, heading: 0, y: 0 };
}

export class MatchRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sockets = new Map();
    this.tickets = new Map();
    this.reconnect = new Map();
    this.timer = null;
    this.written = false;
    this.resetEmpty();
  }

  resetEmpty() {
    this.room = {
      id: '',
      protocol: PROTOCOL,
      status: 'lobby',
      mode: 'hunt',
      ranked: false,
      difficulty: 'normal',
      missionId: 1,
      seed: 1,
      hostId: '',
      t: 0,
      countdown: 0,
      frozen: false,
      events: [],
      pilots: [],
      ai: [],
      targets: [],
      waypoints: [],
      bullets: [],
      bombs: [],
      firstBlood: null,
      winnerTeam: null,
      lives: 1,
    };
  }

  stub() {
    return this.env.MATCH_ROOM.get(this.state.id);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.acceptSocket(request, url);
    }
    if (url.pathname.endsWith('/init') && request.method === 'POST') {
      const body = await request.json();
      this.init(body);
      return Response.json({ ok: true, id: this.room.id });
    }
    if (url.pathname.endsWith('/admit') && request.method === 'POST') {
      const body = await request.json();
      const err = this.admit(body);
      if (err) return Response.json({ error: err }, { status: 400 });
      return Response.json({ ok: true });
    }
    if (url.pathname.endsWith('/ticket') && request.method === 'POST') {
      const body = await request.json();
      const ticket = this.issueTicket(body.userId);
      if (!ticket) return Response.json({ error: 'not in roster' }, { status: 403 });
      return Response.json({ ticket, expires: NET.JOIN_TICKET_S });
    }
    if (url.pathname.endsWith('/state')) {
      return Response.json(this.publicState());
    }
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  init(cfg) {
    this.resetEmpty();
    this.written = false;
    const mission = missionById(cfg.missionId || 1);
    this.room.id = cfg.id;
    this.room.mode = cfg.mode === 'duel' ? 'duel' : 'hunt';
    this.room.ranked = Boolean(cfg.ranked);
    this.room.difficulty = DIFFICULTY[cfg.difficulty] ? cfg.difficulty : 'normal';
    this.room.missionId = mission.id;
    this.room.mission = mission;
    this.room.terrain = mission.terrain;
    this.room.params = paramsForMission(mission);
    this.room.seed = this.room.params.seed;
    this.room.hostId = cfg.hostId;
    this.room.lives = this.room.mode === 'duel' && !this.room.ranked && cfg.lives === 3 ? 3 : 1;
    this.room.wind = windFor(mission.weather);
    this.room.status = 'lobby';
    if (cfg.host) this.admit(cfg.host);
    this.hostWait = setTimeout(() => {
      if (this.room.status === 'lobby' && this.sockets.size === 0) this.abort();
    }, 20000);
  }

  admit(pilot) {
    if (!pilot?.id) return 'bad pilot';
    if (this.room.frozen || this.room.status === 'live' || this.room.status === 'complete') return 'roster frozen';
    if (this.room.pilots.some((p) => p.id === pilot.id)) return null;
    if (this.room.pilots.length >= NET.MAX_PILOTS) return 'room full';
    if (this.room.mode === 'hunt' && this.room.pilots.length >= NET.MAX_PILOTS) return 'room full';
    const team = this.room.mode === 'duel' ? Number(pilot.team) || 0 : 0;
    if (this.room.mode === 'duel') {
      const n0 = this.room.pilots.filter((p) => p.team === 0).length;
      const n1 = this.room.pilots.filter((p) => p.team === 1).length;
      if (team === 0 && n0 >= 4) return 'team full';
      if (team === 1 && n1 >= 4) return 'team full';
    }
    this.room.pilots.push({
      id: pilot.id,
      username: pilot.username || 'pilot',
      tag: pilot.tag || '',
      team,
      skinId: pilot.skinId || 'linen',
      planeId: planeById(pilot.planeId).id,
      ready: false,
      worldReady: false,
      connected: false,
      afkSince: 0,
      lastInputAt: Date.now(),
      lastShot: -10,
      lastBomb: -10,
      kills: 0,
      deaths: 0,
      ground: 0,
      recon: 0,
      aceBonus: 0,
      lives: this.room.lives,
      spawnProtect: 0,
      input: { pitch: 0, turn: 0, fire: false, bomb: false },
      craft: null,
      alive: true,
    });
    return null;
  }

  issueTicket(userId) {
    if (!this.room.pilots.some((p) => p.id === userId)) return null;
    const ticket = crypto.randomUUID().replace(/-/g, '');
    this.tickets.set(ticket, { userId, exp: Date.now() + NET.JOIN_TICKET_S * 1000 });
    return ticket;
  }

  acceptSocket(request, url) {
    const ticket = url.searchParams.get('ticket') || '';
    const rec = this.tickets.get(ticket) || this.reconnect.get(ticket);
    if (!rec || rec.exp < Date.now()) {
      return new Response('bad ticket', { status: 401 });
    }
    this.tickets.delete(ticket);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    const pilot = this.room.pilots.find((p) => p.id === rec.userId);
    if (!pilot) {
      server.close(4403, 'not in roster');
      return new Response(null, { status: 101, webSocket: client });
    }
    const prev = this.sockets.get(pilot.id);
    if (prev) {
      try {
        prev.close(4000, 'replaced');
      } catch {}
    }
    this.sockets.set(pilot.id, server);
    pilot.connected = true;
    pilot.afkSince = 0;
    if (this.hostWait) {
      clearTimeout(this.hostWait);
      this.hostWait = null;
    }
    server.addEventListener('message', (ev) => this.onMessage(pilot, ev.data));
    server.addEventListener('close', () => this.onClose(pilot));
    this.send(server, { type: 'hello', protocol: PROTOCOL, room: this.lobbyView() });
    if (this.room.status === 'live' || this.room.status === 'countdown') this.ensureTick();
    return new Response(null, { status: 101, webSocket: client });
  }

  send(ws, payload) {
    try {
      ws.send(JSON.stringify(payload));
    } catch {}
  }

  broadcast(payload) {
    const raw = JSON.stringify(payload);
    for (const ws of this.sockets.values()) {
      try {
        ws.send(raw);
      } catch {}
    }
  }

  onMessage(pilot, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'hello' && msg.protocol !== PROTOCOL) {
      const ws = this.sockets.get(pilot.id);
      this.send(ws, { type: 'error', error: 'protocol mismatch' });
      ws?.close(4409, 'protocol');
      return;
    }
    if (msg.type === 'hello') {
      if (msg.planeId && !pilot.craft) pilot.planeId = planeById(msg.planeId).id;
      return;
    }
    if (msg.type === 'ready') {
      if (!this.room.frozen) {
        pilot.ready = Boolean(msg.ready);
        this.maybeCountdown();
        this.broadcast({ type: 'lobby', room: this.lobbyView() });
      }
      return;
    }
    if (msg.type === 'worldReady') {
      pilot.worldReady = true;
      return;
    }
    if (msg.type === 'start' && pilot.id === this.room.hostId) {
      this.maybeCountdown(true);
      return;
    }
    if (msg.type === 'input' && this.room.status === 'live') {
      const pitch = Math.max(-1, Math.min(1, Number(msg.pitch) || 0));
      const turn = Math.max(-1, Math.min(1, Number(msg.turn) || 0));
      pilot.input = { pitch, turn, fire: Boolean(msg.fire), bomb: Boolean(msg.bomb) };
      pilot.lastInputAt = Date.now();
      pilot.afkSince = 0;
    }
    if (msg.type === 'leave') {
      this.leave(pilot, 'leave');
    }
  }

  onClose(pilot) {
    if (this.sockets.get(pilot.id)) this.sockets.delete(pilot.id);
    pilot.connected = false;
    const recon = crypto.randomUUID().replace(/-/g, '');
    this.reconnect.set(recon, { userId: pilot.id, exp: Date.now() + NET.RECONNECT_S * 1000 });
    this.sendReconnectHint(pilot.id, recon);
    if (this.room.status === 'lobby' || this.room.status === 'countdown') {
      if (pilot.id === this.room.hostId) this.transferHost();
      this.broadcast({ type: 'lobby', room: this.lobbyView() });
      return;
    }
    setTimeout(() => {
      if (!pilot.connected && this.room.status === 'live') {
        if (this.room.mode === 'duel') this.killPilot(pilot, 'disconnect');
        else pilot.afkSince = Date.now();
      }
    }, NET.RECONNECT_S * 1000);
  }

  sendReconnectHint() {}

  transferHost() {
    const next = this.room.pilots.find((p) => p.connected && p.id !== this.room.hostId);
    if (next) {
      this.room.hostId = next.id;
      return;
    }
    this.room.status = 'aborted';
    this.broadcast({ type: 'aborted' });
    this.stopTick();
  }

  leave(pilot, why) {
    if (this.room.status === 'live') {
      this.killPilot(pilot, why);
      return;
    }
    this.room.pilots = this.room.pilots.filter((p) => p.id !== pilot.id);
    this.sockets.get(pilot.id)?.close(4001, 'left');
    this.sockets.delete(pilot.id);
    if (pilot.id === this.room.hostId) this.transferHost();
    this.broadcast({ type: 'lobby', room: this.lobbyView() });
  }

  maybeCountdown(force = false) {
    if (this.room.status !== 'lobby') return;
    const n = this.room.pilots.length;
    if (this.room.mode === 'hunt' && n < 1 && !force) return;
    if (this.room.mode === 'duel') {
      const a = this.room.pilots.filter((p) => p.team === 0).length;
      const b = this.room.pilots.filter((p) => p.team === 1).length;
      if (this.room.ranked && (a !== b || a < NET.DUEL_RANKED_MIN)) return;
      if (!this.room.ranked && a + b < 2) return;
    }
    const allReady = this.room.pilots.length && this.room.pilots.every((p) => p.ready);
    if (!allReady && !force) {
      if (!this._readyAt && this.room.pilots.some((p) => p.ready)) this._readyAt = Date.now();
      if (!(this._readyAt && Date.now() - this._readyAt > 60000)) return;
    }
    this.room.frozen = true;
    this.room.status = 'countdown';
    this.room.countdown = 3;
    this.ensureTick();
    this.broadcast({ type: 'countdown', room: this.lobbyView() });
  }

  ensureTick() {
    const humans = this.sockets.size;
    const ms = this.room.status === 'live' && humans <= 1 ? 100 : TICK_MS;
    if (this.timer && this.tickMs === ms) return;
    this.stopTick();
    this.tickMs = ms;
    this.timer = setInterval(() => this.tick(), ms);
  }

  stopTick() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async abort() {
    if (this.room.status === 'complete' || this.room.status === 'aborted') return;
    this.room.status = 'aborted';
    this.stopTick();
    if (this.env.DB && this.room.id) {
      try {
        await this.env.DB.prepare(`UPDATE matches SET status = 'aborted', completed_at = ?, do_ms = ? WHERE id = ? AND status != 'complete'`).bind(Date.now(), this.room.doMs || 0, this.room.id).run();
      } catch {}
    }
  }

  startLive() {
    const spec = DIFFICULTY[this.room.difficulty];
    const mission = this.room.mission;
    const layout = layoutFor(mission, this.room.difficulty, this.room.mode === 'hunt' ? { pilotCount: this.room.pilots.length } : undefined);
    const h = sample(this.room);
    this.room.layout = layout;
    this.room.pilots.forEach((p, i) => {
      const sp = spawnPoint(this.room, p.team, i, this.room.pilots.length);
      if (this.room.mode === 'duel') {
        const same = this.room.pilots.filter((x) => x.team === p.team);
        const idx = same.indexOf(p);
        Object.assign(sp, spawnPoint(this.room, p.team, idx, same.length));
      }
      const gy = h(sp.x, sp.z);
      const plane = planeById(p.planeId);
      const hull = spec.hull * (plane.hullMul || 1);
      p.craft = createCraft({
        x: sp.x,
        y: Math.max(42, gy + 40),
        z: sp.z,
        heading: sp.heading,
        hull,
        maxHull: hull,
        planeId: plane.id,
      });
      p.alive = true;
      p.aceBonus = 0;
      p.spawnProtect = this.room.mode === 'duel' ? NET.SPAWN_PROTECT_S : 0;
    });
    this.room.ai = [];
    this.room.targets = [];
    this.room.waypoints = [];
    this.room.bullets = [];
    this.room.bombs = [];
    if (this.room.mode === 'hunt') {
      layout.enemies.forEach((spawn, i) => {
        const gy = h(spawn.x, spawn.z);
        const y = Math.max(gy + 16, gy + (spawn.agl ?? 22));
        this.room.ai.push(createAiCraft({ ...spawn, y, phase: i * 0.7, fireTimer: 0.8 + i * 0.2 }, spec));
      });
      this.room.targets = layout.targets.map((t, i) => ({
        id: i,
        x: t.x,
        z: t.z,
        kind: t.kind,
        heading: t.heading || 0,
        speed: t.speed || 0,
        role: t.role || 'primary',
        health: groundSpec(t.kind).health,
      }));
      this.room.waypoints = layout.waypoints.map((w, i) => {
        const gy = h(w.x, w.z);
        return { id: i, x: w.x, y: Math.max(w.y, gy + 18), z: w.z, hit: false, claimedBy: null };
      });
    }
    this.room.status = 'live';
    this.room.t = 0;
    this.room.spec = spec;
    this.room.liveAt = Date.now();
    this.ensureTick();
    if (this.env.DB && this.room.id) {
      this.env.DB.prepare(`UPDATE matches SET status = 'live', live_at = ? WHERE id = ?`).bind(this.room.liveAt, this.room.id).run().catch(() => {});
    }
  }

  tick() {
    const dt = (this.tickMs || TICK_MS) / 1000;
    this.room.doMs = (this.room.doMs || 0) + (this.tickMs || TICK_MS);
    if (!this.sockets.size) {
      this.emptyAt = this.emptyAt || Date.now();
      if (Date.now() - this.emptyAt > 180000) {
        this.abort();
        return;
      }
    } else this.emptyAt = 0;
    if (this.room.status === 'countdown') {
      this.room.countdown -= dt;
      const waiting = this.room.pilots.some((p) => !p.worldReady);
      if (this.room.countdown <= 0 && (!waiting || this.room.countdown < -20)) {
        this.startLive();
      }
      this.broadcast({ type: 'snapshot', ...this.snapshot() });
      return;
    }
    if (this.room.status !== 'live') return;
    this.room.t += dt;
    const spec = this.room.spec || DIFFICULTY.normal;
    const h = sample(this.room);

    for (const p of this.room.pilots) {
      if (!p.craft) continue;
      if (!p.connected && p.afkSince && Date.now() - p.afkSince > NET.AFK_S * 1000) {
        if (this.room.mode === 'hunt') {
          const others = this.room.pilots.some((x) => x.id !== p.id && x.alive && x.connected);
          if (!others) {
            this.finish('loss');
            return;
          }
        }
        if (this.room.mode === 'duel' && p.alive) this.killPilot(p, 'afk');
        else p.input = { pitch: 0, turn: 0, fire: false, bomb: false };
      }
      if (!p.alive) continue;
      if (p.spawnProtect > 0) p.spawnProtect -= dt;
      const flown = integrateFlight(p.craft, p.input, dt, h, this.room.wind, this.room.t);
      if (flown.groundDamage) p.craft.hull -= flown.groundDamage * spec.damageMul;
      const fwd = flown.forward;
      const plane = planeById(p.planeId);
      if (p.input.fire && this.room.t - p.lastShot > (plane.shotS || COMBAT.PLAYER_SHOT_S)) {
        p.lastShot = this.room.t;
        const guns = plane.guns || 1;
        const right = rightFromHeading(p.craft.heading);
        for (let i = 0; i < guns; i++) {
          const side = guns === 1 ? 0 : i === 0 ? -0.14 : 0.14;
          this.room.bullets.push(spawnBullet({ ...p.craft, x: p.craft.x + right.x * side, z: p.craft.z + right.z * side }, fwd, p.id, p.team, true));
        }
      }
      if (this.room.mode === 'hunt' && p.input.bomb && this.room.t - p.lastBomb > COMBAT.BOMB_S) {
        p.lastBomb = this.room.t;
        this.room.bombs.push(spawnBomb(p.craft, p.id));
      }
      if (p.craft.hull <= 0) this.killPilot(p, 'hull');
    }

    if (this.room.mode === 'hunt') {
      const hunters = this.room.pilots.filter((p) => p.alive && p.craft);
      const focus = hunters[0]?.craft || { x: 0, y: 40, z: 0, heading: 0, pitch: 0, roll: 0 };
      for (const e of this.room.ai) {
        if (!e.alive) continue;
        const nearest = this.nearestAlive(e, hunters);
        const target = nearest?.craft || focus;
        const result = updateAi(e, target, dt, h);
        if (result.fire) this.room.bullets.push(spawnBullet(e, result.forward, 'ai', -1, false));
        if (result.ram && nearest && nearest.spawnProtect <= 0) {
          nearest.craft.hull -= COMBAT.RAM_DAMAGE * spec.damageMul;
          if (nearest.craft.hull <= 0) this.killPilot(nearest, 'ram');
        }
      }
      for (const t of this.room.targets) {
        if (t.health <= 0 || !t.speed) continue;
        stepConvoy(t, dt);
      }
    }

    for (let i = this.room.bullets.length - 1; i >= 0; i--) {
      const b = this.room.bullets[i];
      const px = b.x;
      const py = b.y;
      const pz = b.z;
      stepBullet(b, dt);
      let hit = false;
      if (b.playerShot) {
        if (this.room.mode === 'hunt') {
          for (const e of this.room.ai) {
            if (!e.alive) continue;
            if (segmentHitsSphere(px, py, pz, b.x, b.y, b.z, e.x, e.y, e.z, e.hitRadius || COMBAT.HIT_RADIUS_AI)) {
              e.health -= 1;
              e.wasHit = true;
              e.lastHitBy = b.owner;
              hit = true;
              if (e.health <= 0) this.killAi(e, b.owner);
              break;
            }
          }
          if (!hit) {
            for (const t of this.room.targets) {
              if (t.health <= 0 || !isStrafeable(t.kind)) continue;
              const g = groundSpec(t.kind);
              const gy = h(t.x, t.z);
              if (segmentHitsSphere(px, py, pz, b.x, b.y, b.z, t.x, gy + g.lift * 0.45, t.z, g.hitR)) {
                t.health -= 1;
                hit = true;
                if (t.health <= 0) {
                  const shooter = this.room.pilots.find((p) => p.id === b.owner);
                  if (shooter) {
                    shooter.ground += 1;
                    this.pushEvent(`${shooter.username} strafed a ${t.kind}`);
                  }
                }
                break;
              }
            }
          }
        }
        for (const p of this.room.pilots) {
          if (!p.alive || p.id === b.owner || p.team === b.team || p.spawnProtect > 0) continue;
          if (segmentHitsSphere(px, py, pz, b.x, b.y, b.z, p.craft.x, p.craft.y, p.craft.z, COMBAT.HIT_RADIUS_PLAYER)) {
            p.craft.hull -= COMBAT.BULLET_DAMAGE * spec.damageMul;
            p.lastHitBy = b.owner;
            hit = true;
            if (p.craft.hull <= 0) this.killPilot(p, 'gun', b.owner);
            break;
          }
        }
      } else {
        for (const p of this.room.pilots) {
          if (!p.alive || p.spawnProtect > 0) continue;
          if (segmentHitsSphere(px, py, pz, b.x, b.y, b.z, p.craft.x, p.craft.y, p.craft.z, COMBAT.HIT_RADIUS_PLAYER)) {
            p.craft.hull -= COMBAT.BULLET_DAMAGE * spec.damageMul;
            hit = true;
            if (p.craft.hull <= 0) this.killPilot(p, 'ai');
            break;
          }
        }
      }
      if (hit || b.life <= 0) this.room.bullets.splice(i, 1);
    }

    for (let i = this.room.bombs.length - 1; i >= 0; i--) {
      const b = this.room.bombs[i];
      stepBomb(b, dt);
      const impactY = h(b.x, b.z);
      if (b.y < impactY + 2 || b.life <= 0) {
        let nearest = null;
        let dist = Infinity;
        for (const t of this.room.targets) {
          if (t.health <= 0) continue;
          const d = Math.hypot(b.x - t.x, b.z - t.z);
          if (d < dist) {
            dist = d;
            nearest = t;
          }
        }
        if (nearest && bombHitsTarget(b.x, b.z, nearest.x, nearest.z, groundSpec(nearest.kind).bombR)) {
          nearest.health = 0;
          const bomber = this.room.pilots.find((p) => p.id === b.owner);
          if (bomber) {
            bomber.ground += 1;
            this.pushEvent(`${bomber.username} cratered a ${nearest.kind}`);
          }
        }
        this.room.bombs.splice(i, 1);
      }
    }

    for (const p of this.room.pilots) {
      if (!p.alive || !p.craft) continue;
      for (const w of this.room.waypoints) {
        if (w.hit) continue;
        if (Math.hypot(p.craft.x - w.x, p.craft.y - w.y, p.craft.z - w.z) < COMBAT.WAYPOINT_RADIUS) {
          w.hit = true;
          w.claimedBy = p.id;
          p.recon += 1;
          this.pushEvent(`${p.username} photographed a mark`);
        }
      }
    }

    this.checkEnd();
    this.broadcast({ type: 'snapshot', ...this.snapshot() });
  }

  nearestAlive(e, hunters) {
    let best = null;
    let bestD = Infinity;
    for (const p of hunters) {
      const d = Math.hypot(p.craft.x - e.x, p.craft.y - e.y, p.craft.z - e.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  killAi(e, ownerId) {
    e.alive = false;
    const p = this.room.pilots.find((x) => x.id === (e.lastHitBy || ownerId));
    if (p) {
      p.kills += 1;
      const ace = e.ace ? aceById(e.ace) : null;
      if (ace) p.aceBonus = (p.aceBonus || 0) + (killScore(ace) - 500);
      if (!this.room.firstBlood) {
        this.room.firstBlood = p.id;
        this.pushEvent(`${p.username} first blood`);
      }
      this.pushEvent(ace ? `${p.username} downed ${ace.tag}` : `${p.username} destroyed a scout`);
    }
  }

  killPilot(p, why, killerId) {
    if (!p.alive) return;
    p.lives -= 1;
    if (p.lives > 0 && this.room.mode === 'duel') {
      p.craft.hull = p.craft.maxHull;
      p.spawnProtect = NET.SPAWN_PROTECT_S;
      this.pushEvent(`${p.username} down — ${p.lives} left`);
      return;
    }
    p.alive = false;
    p.deaths += 1;
    if (p.craft) p.craft.alive = false;
    const killer = this.room.pilots.find((x) => x.id === (killerId || p.lastHitBy));
    if (killer && killer.id !== p.id) killer.kills += 1;
    this.pushEvent(`${p.username} is down${killer ? ` · ${killer.username}` : ''} (${why})`);
  }

  pushEvent(text) {
    this.room.events.push({ t: this.room.t, text });
    if (this.room.events.length > 24) this.room.events.shift();
  }

  checkEnd() {
    if (this.room.mode === 'hunt') {
      const living = this.room.pilots.some((p) => p.alive);
      const aiLeft = this.room.ai.some((e) => e.alive);
      if (!living) {
        this.finish('loss');
        return;
      }
      if (!aiLeft) {
        this.finish('win');
        return;
      }
      if (this.room.t > 540) this.finish('time');
      return;
    }
    const a = this.room.pilots.filter((p) => p.team === 0 && p.alive).length;
    const b = this.room.pilots.filter((p) => p.team === 1 && p.alive).length;
    if (a === 0 && b === 0) this.finish('draw');
    else if (a === 0) this.finish('team1');
    else if (b === 0) this.finish('team0');
  }

  async finish(result) {
    if (this.room.status === 'complete') return;
    this.room.status = 'complete';
    this.room.result = result;
    if (result === 'team0') this.room.winnerTeam = 0;
    else if (result === 'team1') this.room.winnerTeam = 1;
    else this.room.winnerTeam = null;
    this.stopTick();
    this.broadcast({ type: 'result', ...this.snapshot(), result });
    await this.persist();
  }

  lobbyView() {
    return {
      id: this.room.id,
      protocol: PROTOCOL,
      status: this.room.status,
      mode: this.room.mode,
      ranked: this.room.ranked,
      difficulty: this.room.difficulty,
      missionId: this.room.missionId,
      seed: this.room.seed,
      hostId: this.room.hostId,
      countdown: this.room.countdown,
      lives: this.room.lives,
      terrain: this.room.terrain,
      weather: this.room.mission?.weather,
      pilots: this.room.pilots.map((p) => ({
        id: p.id,
        username: p.username,
        tag: p.tag,
        team: p.team,
        ready: p.ready,
        connected: p.connected,
        skinId: p.skinId,
        planeId: p.planeId || 'spitfire',
      })),
    };
  }

  snapshot() {
    return {
      t: this.room.t,
      protocol: PROTOCOL,
      status: this.room.status,
      mode: this.room.mode,
      seed: this.room.seed,
      missionId: this.room.missionId,
      difficulty: this.room.difficulty,
      countdown: this.room.countdown,
      events: this.room.events.slice(-8),
      pilots: this.room.pilots.map((p) => ({
        id: p.id,
        username: p.username,
        tag: p.tag,
        team: p.team,
        skinId: p.skinId,
        planeId: p.planeId || 'spitfire',
        alive: p.alive,
        kills: p.kills,
        deaths: p.deaths,
        ground: p.ground,
        recon: p.recon,
        aceBonus: p.aceBonus || 0,
        hull: p.craft?.hull ?? 0,
        maxHull: p.craft?.maxHull ?? 100,
        spawnProtect: p.spawnProtect,
        craft: p.craft
          ? { x: p.craft.x, y: p.craft.y, z: p.craft.z, heading: p.craft.heading, pitch: p.craft.pitch, roll: p.craft.roll }
          : null,
      })),
      ai: this.room.ai.filter((e) => e.alive).map((e) => ({
        x: e.x,
        y: e.y,
        z: e.z,
        heading: e.heading,
        pitch: e.pitch,
        roll: e.roll,
        ace: e.ace || null,
        aceTag: e.aceTag || null,
        aceName: e.aceName || null,
      })),
      targets: this.room.targets.filter((t) => t.health > 0).map((t) => ({ id: t.id, x: t.x, z: t.z, kind: t.kind })),
      waypoints: this.room.waypoints.filter((w) => !w.hit).map((w) => ({ id: w.id, x: w.x, y: w.y, z: w.z })),
      bullets: this.room.bullets.map((b) => ({ x: b.x, y: b.y, z: b.z })),
      bombs: this.room.bombs.map((b) => ({ x: b.x, y: b.y, z: b.z })),
      winnerTeam: this.room.winnerTeam,
      result: this.room.result,
    };
  }

  publicState() {
    return this.room.status === 'lobby' || this.room.status === 'countdown' ? this.lobbyView() : this.snapshot();
  }

  async persist() {
    if (this.written || !this.env.DB) return;
    this.written = true;
    const t = Date.now();
    try {
      await ensureSchema(this.env);
      await this.env.DB.prepare(
        `UPDATE matches SET status = ?, completed_at = ?, winner_team = ?, do_ms = ? WHERE id = ? AND status != 'complete'`,
      )
        .bind(this.room.status, t, this.room.winnerTeam, this.room.doMs || 0, this.room.id)
        .run();
      for (const p of this.room.pilots) {
        await this.env.DB.prepare(
          `UPDATE match_pilots SET kills = ?, deaths = ?, ground = ?, recon = ?, alive = ?, callsign = ? WHERE match_id = ? AND user_id = ?`,
        )
          .bind(p.kills, p.deaths, p.ground, p.recon, p.alive ? 1 : 0, p.username, this.room.id, p.id)
          .run();
        const score = p.kills * 500 + p.ground * 350 + p.recon * 250 + (p.aceBonus || 0);
        const won = this.room.mode === 'duel' ? this.room.winnerTeam === p.team : this.room.result === 'win';
        await this.env.DB.prepare(
          `INSERT INTO sortie_history (id, user_id, callsign, kind, mission_id, score, kills, deaths, ground, recon, win, at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(crypto.randomUUID(), p.id, p.username, this.room.mode, this.room.missionId, score, p.kills, p.deaths, p.ground, p.recon, won ? 1 : 0, t)
          .run();
        const ribbons = [];
        if (this.room.firstBlood === p.id) ribbons.push('first_blood');
        if (this.room.mode === 'hunt' && p.kills >= 5) ribbons.push('ace');
        if (this.room.mode === 'duel' && p.alive && this.room.winnerTeam === p.team) ribbons.push('last_man');
        if (p.ground >= 3) ribbons.push('convoy_killer');
        for (const r of ribbons) {
          await this.env.DB.prepare('INSERT OR IGNORE INTO ribbons (user_id, ribbon, at, match_id) VALUES (?, ?, ?, ?)')
            .bind(p.id, r, t, this.room.id)
            .run();
        }
      }
    } catch (err) {
      console.warn('persist failed', err);
    }
  }
}
