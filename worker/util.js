export const PROTOCOL = 1;
export const RESERVED = new Set(['admin', 'raf', 'spitfire', 'system', 'wings', 'honor', 'sopwith', 'mess', 'hunt', 'duel', 'null', 'deleted']);

export function jsonHeaders(request, extra = {}) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const allow =
    !origin ||
    origin === url.origin ||
    origin.startsWith('capacitor:') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://127.0.0.1');
  return {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': allow ? origin || url.origin : 'null',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'cache-control': 'no-store',
    ...extra,
  };
}

export function json(request, data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders(request, extraHeaders) });
}

export function token(bytes = 24) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function now() {
  return Date.now();
}

export function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .slice(0, 120);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16);
}

export function validUsername(value) {
  return /^[a-z0-9_]{3,16}$/.test(value) && !RESERVED.has(value);
}

export function normalizeTag(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function isHttps(request) {
  return new URL(request.url).protocol === 'https:';
}

export function cookie(name, value, maxAge, opts = {}) {
  const parts = [`${name}=${value}`, `Path=${opts.path || '/'}`, 'HttpOnly', `SameSite=${opts.sameSite || 'Lax'}`, `Max-Age=${maxAge}`];
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

export function timingSafeEqual(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let out = 0;
  for (let i = 0; i < x.length; i += 1) out |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return out === 0;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function fillTemplate(str, vars, html = false) {
  return String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = String(vars[k] ?? '');
    return html ? escapeHtml(v) : v;
  });
}

export function readCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  const match = raw.split(/;\s*/).find((p) => p.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

export function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  return '';
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function originOf(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function mpEnabled(env) {
  return env.MP_ENABLED !== '0';
}
