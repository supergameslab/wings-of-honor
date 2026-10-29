import { PROTOCOL, NET, integrateFlight } from '../sim/index.js';
import { apiPath } from '../paths.js';

export class MpSession {
  constructor({ matchId, ticket, userId, planeId, onSnapshot, onLobby, onResult, onEvent, onClose }) {
    this.matchId = matchId;
    this.ticket = ticket;
    this.userId = userId;
    this.planeId = planeId || 'spitfire';
    this.onSnapshot = onSnapshot;
    this.onLobby = onLobby;
    this.onResult = onResult;
    this.onEvent = onEvent;
    this.onClose = onClose;
    this.ws = null;
    this.lastSnap = null;
    this.status = 'connecting';
    this.afk = false;
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}${apiPath(`/api/match/${this.matchId}/ws`)}?ticket=${encodeURIComponent(this.ticket)}`;
    this.ws = new WebSocket(url);
    this.ws.addEventListener('open', () => {
      this.status = 'open';
      this.send({ type: 'hello', protocol: PROTOCOL, planeId: this.planeId });
    });
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === 'snapshot' || msg.type === 'hello' && msg.room) {
        if (msg.type === 'snapshot') {
          this.lastSnap = msg;
          this.onSnapshot?.(msg);
        }
      }
      if (msg.type === 'hello' || msg.type === 'lobby' || msg.type === 'countdown') this.onLobby?.(msg.room || msg);
      if (msg.type === 'snapshot') this.onSnapshot?.(msg);
      if (msg.type === 'result') this.onResult?.(msg);
      if (msg.events) {
        const last = msg.events[msg.events.length - 1];
        if (last) this.onEvent?.(last.text);
      }
      if (msg.type === 'error') this.onEvent?.(msg.error);
    });
    this.ws.addEventListener('close', () => {
      this.status = 'closed';
      this.onClose?.();
    });
  }

  send(obj) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  setReady(ready) {
    this.send({ type: 'ready', ready: Boolean(ready) });
  }

  worldReady() {
    this.send({ type: 'worldReady' });
  }

  start() {
    this.send({ type: 'start' });
  }

  sendInput(input) {
    this.send({ type: 'input', ...input });
  }

  leave() {
    this.send({ type: 'leave' });
    this.ws?.close();
  }

  predict(craft, input, dt, sampleHeight, wind, elapsed) {
    const snap = this.lastSnap?.pilots?.find((p) => p.id === this.userId);
    integrateFlight(craft, input, dt, sampleHeight, wind, elapsed);
    if (!snap?.craft) return;
    const dx = craft.x - snap.craft.x;
    const dy = craft.y - snap.craft.y;
    const dz = craft.z - snap.craft.z;
    const err = Math.hypot(dx, dy, dz);
    if (err > 12) {
      craft.x = snap.craft.x;
      craft.y = snap.craft.y;
      craft.z = snap.craft.z;
      craft.heading = snap.craft.heading;
      craft.pitch = snap.craft.pitch;
      craft.roll = snap.craft.roll;
    } else if (err > 1.5) {
      craft.x += (snap.craft.x - craft.x) * 0.18;
      craft.y += (snap.craft.y - craft.y) * 0.18;
      craft.z += (snap.craft.z - craft.z) * 0.18;
    }
  }
}

export { NET };
