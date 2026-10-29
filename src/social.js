import { api, getSession, isNative, requestMagic, saveCallsign, logout, deleteAccount, refreshMe, consumeToken } from './auth.js';
import { huntFighterCount, missionById } from './campaign.js';
import { acesFor, aceById } from './sim/aces.js';
import { track } from './telemetry.js';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let turnstileId = null;

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (window.__sglTurnstile) return window.__sglTurnstile;
  window.__sglTurnstile = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile'));
    document.head.appendChild(s);
  });
  return window.__sglTurnstile;
}

async function mountTurnstile() {
  const el = $('auth-turnstile');
  if (!el || turnstileId != null) return;
  try {
    await loadTurnstileScript();
  } catch {
    return;
  }
  if (!window.turnstile) return;
  const health = await api('/api/health');
  const key = health.turnstileSiteKey || '';
  if (!key) return;
  turnstileId = window.turnstile.render(el, { sitekey: key });
}

function turnstileToken() {
  if (turnstileId == null || !window.turnstile) return '';
  return window.turnstile.getResponse(turnstileId) || '';
}

let hooks = {};
let presenceTimer = null;
let lastInviteTokens = new Set();

export function bootSocial(h) {
  hooks = h;
  wire();
  renderAuthChrome();
  const pending = sessionStorage.getItem('iron-invite');
  const user = getSession();
  if (pending && user?.username) {
    sessionStorage.removeItem('iron-invite');
    acceptInvite(pending);
  } else if (pending && user && !user.username) {
    hooks.setMode?.('callsign');
  }
  startPresence();
}

function wire() {
  $('mess-btn')?.addEventListener('click', () => openMess());
  $('auth-btn')?.addEventListener('click', () => openAuth());
  $('auth-send')?.addEventListener('click', sendMagic);
  $('auth-close')?.addEventListener('click', () => hooks.setMode?.('menu'));
  $('callsign-save')?.addEventListener('click', saveName);
  $('mess-back')?.addEventListener('click', () => hooks.setMode?.('menu'));
  $('mess-tabs')?.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  $('hunt-create')?.addEventListener('click', () => createMatch('hunt'));
  $('hunt-practice')?.addEventListener('click', () => hooks.startPracticeHunt?.());
  $('hunt-quick')?.addEventListener('click', () => quickMatch());
  $('duel-create')?.addEventListener('click', () => createMatch('duel'));
  $('squadron-create')?.addEventListener('click', createSquadron);
  $('squadron-leave')?.addEventListener('click', leaveSquadron);
  $('invite-send')?.addEventListener('click', sendInvite);
  $('legal-btn')?.addEventListener('click', () => hooks.setMode?.('legal'));
  $('legal-close')?.addEventListener('click', () => hooks.setMode?.('menu'));
  $('logout-btn')?.addEventListener('click', async () => {
    await logout();
    renderAuthChrome();
    hooks.setMode?.('menu');
  });
  $('delete-btn')?.addEventListener('click', async () => {
    if (!confirm('Delete this account? Your name comes off the boards. You can still fly as a guest.')) return;
    await deleteAccount();
    renderAuthChrome();
    hooks.setMode?.('menu');
  });
  $('invite-banner-accept')?.addEventListener('click', () => {
    const tok = $('invite-banner')?.dataset.token;
    if (tok) acceptInvite(tok);
    $('invite-banner')?.classList.add('hidden');
  });
  $('invite-banner-dismiss')?.addEventListener('click', () => $('invite-banner')?.classList.add('hidden'));
  $('shop-list')?.addEventListener('click', onShopClick);
}

export function renderAuthChrome() {
  const user = getSession();
  const btn = $('auth-btn');
  if (btn) btn.textContent = user?.username ? user.username.toUpperCase() : user ? 'PICK A NAME' : 'SIGN IN';
  const who = $('mess-who');
  if (who) who.textContent = user?.username ? `${user.username}${user.squadron?.tag ? ' · ' + user.squadron.tag : ''}` : 'GUEST';
}

async function openAuth() {
  const user = getSession();
  if (user && !user.username) {
    hooks.setMode?.('callsign');
    const pref = localStorage.getItem('wings-honor-pilot') || '';
    if ($('callsign-input') && pref) $('callsign-input').value = pref.replace(/[^a-z0-9_]/gi, '').slice(0, 16).toLowerCase();
    return;
  }
  if (user?.username) {
    openMess();
    return;
  }
  hooks.setMode?.('auth');
  mountTurnstile();
}

async function openMess() {
  const user = getSession() || (await refreshMe());
  if (user && !user.username) {
    hooks.setMode?.('callsign');
    return;
  }
  hooks.setMode?.('mess');
  showTab('hunt');
  if (!user) {
    if ($('mess-status')) $('mess-status').textContent = 'Practice is free. Sign in when you want to fly with a friend.';
    $('hunt-create')?.classList.add('hidden');
    $('hunt-quick')?.classList.add('hidden');
    return;
  }
  $('hunt-create')?.classList.remove('hidden');
  $('hunt-quick')?.classList.remove('hidden');
  fillMess();
}

async function sendMagic() {
  const email = $('auth-email')?.value || '';
  const status = $('auth-status');
  status.textContent = 'Sending…';
  const data = await requestMagic(email, turnstileToken());
  if (data.error) {
    status.textContent = data.error;
    return;
  }
  if (data.devToken) {
    status.textContent = 'Opening your sign-in link…';
    const consumed = await consumeToken(data.devToken);
    renderAuthChrome();
    if (consumed?.invite) sessionStorage.setItem('iron-invite', consumed.invite);
    if (consumed?.user && !consumed.user.username) hooks.setMode?.('callsign');
    else if (consumed?.user) openMess();
    if (consumed?.invite) acceptInvite(consumed.invite);
    return;
  }
  status.textContent = 'Check your email — the link is waiting.';
}

async function saveName() {
  const name = $('callsign-input')?.value || '';
  const age = $('age-gate')?.checked;
  const status = $('callsign-status');
  if (!age) {
    status.textContent = "Ask a grown-up if you're not sure, then tick the box.";
    return;
  }
  const data = await saveCallsign(name, true);
  if (data.error) {
    status.textContent = data.error;
    return;
  }
  renderAuthChrome();
  const pending = sessionStorage.getItem('iron-invite');
  if (pending) {
    sessionStorage.removeItem('iron-invite');
    acceptInvite(pending);
    return;
  }
  openMess();
}

function showTab(id) {
  document.querySelectorAll('#mess-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === id));
  document.querySelectorAll('.mess-pane').forEach((p) => p.classList.toggle('hidden', p.id !== `mess-${id}`));
  if (id === 'logbook') fillLogbook();
  if (id === 'shop') fillShop();
  if (id === 'squadron') fillSquadron();
  if (id === 'duel' || id === 'hunt') fillRecent();
}

async function fillMess() {
  const user = await refreshMe();
  renderAuthChrome();
  fillSquadron();
  fillRecent();
  const health = await api('/api/health');
  const banner = $('mess-offline');
  if (banner) banner.classList.toggle('hidden', Boolean(health?.mp));
}

async function fillRecent() {
  const data = await api('/api/recent');
  const box = $('recent-list');
  if (!box) return;
  const rows = data.recent || [];
  box.innerHTML = rows.length
        ? rows.map((r) => `<button type="button" data-user="${escapeHtml(r.username)}">${escapeHtml(r.username)}</button>`).join('')
    : '<small>No recent pilots yet.</small>';
  box.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      if ($('invite-who')) $('invite-who').value = b.dataset.user;
    });
  });
}

async function fillSquadron() {
  const user = getSession();
  const pane = $('squadron-detail');
  const create = $('squadron-create-form');
  if (!pane) return;
  if (!user?.squadron) {
    pane.classList.add('hidden');
    create?.classList.remove('hidden');
    return;
  }
  create?.classList.add('hidden');
  pane.classList.remove('hidden');
  pane.querySelector('.sq-name').textContent = `${user.squadron.tag} · ${user.squadron.name}`;
  pane.querySelector('.sq-role').textContent = user.squadron.role;
  pane.querySelector('.sq-roster').innerHTML = (user.squadron.members || [])
    .map((m) => `<li><b>${escapeHtml(m.username)}</b><small>${escapeHtml(m.role)}</small></li>`)
    .join('');
}

async function createSquadron() {
  const name = $('squadron-name')?.value || '';
  const tag = $('squadron-tag')?.value || '';
  const data = await api('/api/squadrons', { method: 'POST', body: JSON.stringify({ name, tag }) });
  $('squadron-status').textContent = data.error || 'Squadron raised.';
  if (!data.error) {
    await refreshMe();
    renderAuthChrome();
    fillSquadron();
  }
}

async function leaveSquadron() {
  const user = getSession();
  if (!user?.squadron) return;
  const data = await api(`/api/squadrons/${user.squadron.id}/leave`, { method: 'POST', body: '{}' });
  $('squadron-status').textContent = data.error || 'You left the squadron.';
  await refreshMe();
  fillSquadron();
}

async function sendInvite() {
  const user = getSession();
  const who = $('invite-who')?.value || '';
  const kind = $('invite-kind')?.value || 'hunt';
  const body = who.includes('@') ? { email: who } : { username: who };
  let path = '/api/squadrons/' + (user?.squadron?.id || '') + '/invite';
  if (kind !== 'squadron') {
    $('invite-status').textContent = 'Open a room first, then invite from the waiting screen.';
    return;
  }
  const data = await api(path, { method: 'POST', body: JSON.stringify(body) });
  $('invite-status').textContent = data.error || (data.devToken ? `Invite ready ${data.devToken}` : 'Invite sent.');
  if (!data.error) track('invite_sent', { kind });
}

async function createMatch(mode) {
  const difficulty = $('mess-diff')?.value || 'normal';
  const missionId = Number($('mess-mission')?.value || (mode === 'duel' ? 6 : 3));
  const ranked = Boolean($('duel-ranked')?.checked) && mode === 'duel';
  const challengeTag = $('duel-tag')?.value || '';
  const lives = $('duel-patrol')?.checked ? 3 : 1;
  const data = await api('/api/matches', {
    method: 'POST',
    body: JSON.stringify({ mode, difficulty, missionId, ranked, challengeTag, lives }),
  });
  if (data.error) {
    $('mess-status').textContent = data.error;
    return;
  }
  hooks.joinMatch?.(data.matchId);
  track('hunt_room', { mode });
}

async function quickMatch() {
  const data = await api('/api/matches/quick', { method: 'POST', body: '{}' });
  if (data.error) {
    $('mess-status').textContent = data.error;
    return;
  }
  track('hunt_room', { mode: 'quick' });
  hooks.joinMatch?.(data.matchId);
}

async function fillLogbook() {
  const data = await api('/api/logbook');
  const week = await api('/api/board/weekly');
  const box = $('logbook-body');
  if (!box) return;
  if (data.error) {
    box.textContent = data.error;
    return;
  }
  const w = Object.fromEntries((data.wins || []).map((x) => [x.mode, x.n]));
  box.innerHTML = `
    <p>Flights ${data.stats?.sorties || 0} · Score ${data.stats?.score || 0} · Hits ${data.stats?.kills || 0}</p>
    <p>Hunt wins ${w.hunt || 0} · Duel wins ${w.duel || 0}</p>
    <div class="ribbon-row">${(data.ribbons || []).map((r) => `<span>${r.ribbon.replace('_', ' ')}</span>`).join('') || '<small>No ribbons yet — go fly!</small>'}</div>
    <h3>This week</h3>
    <ol>${(week.board || []).map((r) => `<li><b>${escapeHtml(r.name)}</b> ${escapeHtml(r.tag || '')} <span>${Number(r.kills) || 0}</span></li>`).join('') || '<li>No flights yet this week. Be the first!</li>'}</ol>
  `;
}

async function fillShop() {
  const pane = $('shop-list');
  if (!pane) return;
  if (isNative()) {
    pane.innerHTML = '<p class="brief-copy">Plane paint is on the website for now. Phones and tablets stay free to fly.</p>';
    return;
  }
  const data = await api('/api/shop');
  track('shop_view');
  if (!data.stripe && !data.devGrant) {
    pane.innerHTML = '<p class="brief-copy">The paint shop is not open yet. Flying stays free.</p>';
    return;
  }
  const owned = new Set((data.owned || []).map((o) => o.sku));
  pane.innerHTML = (data.catalog || [])
    .map(
      (s) => `<div class="shop-row"><div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.blurb || s.kind)} · $${(s.price / 100).toFixed(2)}</small></div>
      <button data-sku="${escapeHtml(s.sku)}" ${owned.has(s.sku) ? 'disabled' : ''}>${owned.has(s.sku) ? 'YOURS' : data.stripe ? 'GET' : 'TRY'}</button></div>`,
    )
    .join('');
}

async function onShopClick(e) {
  const sku = e.target?.dataset?.sku;
  if (!sku) return;
  const data = await api('/api/shop/checkout', { method: 'POST', body: JSON.stringify({ sku }) });
  if (data.url) location.href = data.url;
  else {
    $('shop-status').textContent = data.error || (data.granted ? `Granted ${data.granted}` : 'Done.');
    fillShop();
  }
}

export async function acceptInvite(token) {
  const data = await api(`/api/invites/${token}/accept`, { method: 'POST', body: '{}' });
  if (data.error) {
    hooks.notify?.(data.error);
    return;
  }
  if (data.payload?.matchId) hooks.joinMatch?.(data.payload.matchId);
  else {
    await refreshMe();
    openMess();
  }
}

function startPresence() {
  const beat = async () => {
    if (!getSession()?.username) return;
    const data = await api('/api/presence', { method: 'POST', body: '{}' });
    const inv = (data.invites || []).find((i) => !lastInviteTokens.has(i.token));
    if (inv) {
      lastInviteTokens.add(inv.token);
      const banner = $('invite-banner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.dataset.token = inv.token;
        $('invite-banner-text').textContent = `${inv.from_name} wants you in the sky.`;
      }
    }
  };
  beat();
  presenceTimer = setInterval(beat, 20000);
}

export function fillLobby(room, userId) {
  const box = $('lobby-roster');
  if (!box || !room) return;
  box.innerHTML = (room.pilots || [])
    .map((p) => `<li class="team-${p.team}"><b>${escapeHtml(p.tag ? p.tag + ' ' : '')}${escapeHtml(p.username)}</b><small>${p.ready ? 'READY' : 'WAIT'}${p.connected ? '' : ' · LINK LOST'}</small></li>`)
    .join('');
  let meta = `${room.mode.toUpperCase()} · ${room.difficulty} · mission ${String(room.missionId).padStart(2, '0')}${room.ranked ? ' · RANKED' : ''}`;
  if (room.mode === 'hunt') {
    const mission = missionById(room.missionId);
    if (mission) {
      const n = huntFighterCount(mission, room.difficulty, room.pilots?.length || 2);
      const names = acesFor(mission, { pilotCount: room.pilots?.length || 2 })
        .map(aceById)
        .filter(Boolean)
        .map((a) => a.tag)
        .join(', ');
      meta += ` · ${n} planes`;
      if (names) meta += ` · ACE ${names}`;
    }
  }
  $('lobby-meta').textContent = meta;
  $('lobby-host').classList.toggle('hidden', room.hostId !== userId);
}

export { showTab, openMess, openAuth };
