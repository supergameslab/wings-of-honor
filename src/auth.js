import { apiPath } from './paths.js';

const TOKEN_KEY = 'wings-honor-session';
const USER_KEY = 'wings-honor-user';

export function isNative() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

let sessionToken = isNative() ? localStorage.getItem(TOKEN_KEY) || '' : '';
if (!isNative()) localStorage.removeItem(TOKEN_KEY);
let current = null;
try {
  current = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
} catch {
  current = null;
}

export function getSession() {
  return current;
}

export function getToken() {
  return sessionToken;
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['content-type']) headers['content-type'] = 'application/json';
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  try {
    const res = await fetch(apiPath(path), { ...options, headers, credentials: 'include' });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { error: data?.error || String(res.status), status: res.status };
    return data || { ok: true };
  } catch {
    return { error: 'offline' };
  }
}

function persist(user, token) {
  current = user;
  if (isNative() && token) {
    sessionToken = token;
    localStorage.setItem(TOKEN_KEY, token);
  } else if (!isNative()) {
    sessionToken = '';
    localStorage.removeItem(TOKEN_KEY);
  }
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export async function refreshMe() {
  const data = await api('/api/me');
  if (data?.id) {
    persist(data, sessionToken);
    return data;
  }
  if (data?.status === 401) persist(null, '');
  return null;
}

export async function requestMagic(email, turnstile = '') {
  return api('/api/auth/magic', { method: 'POST', body: JSON.stringify({ email, turnstile }) });
}

export async function consumeToken(token) {
  const aid = localStorage.getItem('wings-honor-aid') || '';
  const data = await api('/api/auth/consume', { method: 'POST', body: JSON.stringify({ token, aid, native: isNative() }) });
  if (data?.user) persist(data.user, data.token || '');
  else if (data?.ok) await refreshMe();
  return data;
}

export async function saveCallsign(username, ageOk = true) {
  const data = await api('/api/me', { method: 'PATCH', body: JSON.stringify({ username, age_ok: ageOk ? 1 : 0 }) });
  if (data?.id) persist(data, sessionToken);
  return data;
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  sessionToken = '';
  localStorage.removeItem(TOKEN_KEY);
  persist(null, '');
}

export async function deleteAccount() {
  await api('/api/me', { method: 'DELETE' });
  sessionToken = '';
  localStorage.removeItem(TOKEN_KEY);
  persist(null, '');
}

export async function bootAuth() {
  const params = new URLSearchParams(location.search);
  const joinToken = params.get('token');
  if (joinToken) {
    const consumed = await consumeToken(joinToken);
    history.replaceState({}, '', location.pathname);
    if (consumed?.invite) sessionStorage.setItem('iron-invite', consumed.invite);
    return consumed;
  }
  await refreshMe();
  try {
    const App = window.Capacitor?.Plugins?.App;
    App?.addListener?.('appUrlOpen', async (event) => {
      const u = new URL(event.url);
      const tok = u.searchParams.get('token');
      if (tok) await consumeToken(tok);
    });
  } catch {}
  return { user: current };
}
