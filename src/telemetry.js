import { apiPath } from './paths.js';

const AID_KEY = 'wings-honor-aid';
const AGE_KEY = 'wings-honor-age-ok';
const TEL_KEY = 'wings-honor-telemetry';

let queue = [];
let timer = null;
let aid = '';
let allowed = false;
const bootAt = typeof performance !== 'undefined' ? performance.now() : 0;

export function telemetryAllowed() {
  return allowed;
}

export function getAid() {
  return aid;
}

export function ageAccepted() {
  return localStorage.getItem(AGE_KEY) === '1';
}

export function acceptAge(ok) {
  localStorage.setItem(AGE_KEY, ok ? '1' : '0');
  if (ok) {
    allowed = localStorage.getItem(TEL_KEY) !== '0';
    ensureAid();
  } else {
    allowed = false;
  }
  return allowed;
}

export function setTelemetryPref(on) {
  localStorage.setItem(TEL_KEY, on ? '1' : '0');
  allowed = on && ageAccepted();
  if (allowed) ensureAid();
}

function ensureAid() {
  if (!allowed) return '';
  aid = localStorage.getItem(AID_KEY) || '';
  if (!aid) {
    aid = crypto.randomUUID();
    localStorage.setItem(AID_KEY, aid);
  }
  return aid;
}

export function bootTelemetry() {
  if (!ageAccepted()) return;
  allowed = localStorage.getItem(TEL_KEY) !== '0';
  if (allowed) ensureAid();
  window.addEventListener('error', (ev) => {
    track('client_error', { m: String(ev.message || 'error').slice(0, 80) });
  });
  window.addEventListener('unhandledrejection', () => {
    track('client_error', { m: 'unhandledrejection' });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

export function track(name, props = {}) {
  if (!allowed || !aid) return;
  queue.push({
    name: String(name).slice(0, 40),
    at: Date.now(),
    ...props,
  });
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 8000);
}

export function trackBoot(extra = {}) {
  track('boot', {
    boot_ms: Math.round((typeof performance !== 'undefined' ? performance.now() : 0) - bootAt),
    iframe: window.top !== window.self,
    webgl: extra.webgl !== false,
    quality: extra.quality || 'HIGH',
    mem: navigator.deviceMemory || 0,
  });
}

export async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!allowed || !aid || !queue.length) return;
  const events = queue.splice(0, 20);
  try {
    await fetch(apiPath('/api/telemetry'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ aid, events }),
      keepalive: true,
    });
  } catch {
    queue = events.concat(queue).slice(0, 40);
  }
}

export function bindUser(userId) {
  if (!userId || !allowed) return;
  track('ident_bind', { user: String(userId).slice(0, 36) });
  flush();
}
