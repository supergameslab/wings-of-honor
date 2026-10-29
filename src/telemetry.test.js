import { describe, expect, it, beforeEach } from 'vitest';
import { acceptAge, track, getAid, telemetryAllowed } from './telemetry.js';

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    store[k] = String(v);
  },
  removeItem: (k) => {
    delete store[k];
  },
};

describe('telemetry', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
  });

  it('mints aid only after the 13+ gate', () => {
    expect(getAid()).toBe('');
    acceptAge(false);
    expect(telemetryAllowed()).toBe(false);
    expect(getAid()).toBe('');
    acceptAge(true);
    expect(telemetryAllowed()).toBe(true);
    expect(getAid().length).toBeGreaterThanOrEqual(8);
  });

  it('queues a batch of at most 20 named events', () => {
    acceptAge(true);
    const posts = [];
    globalThis.fetch = async (url, opts) => {
      posts.push(JSON.parse(opts.body));
      return { ok: true };
    };
    for (let i = 0; i < 25; i++) track('boot', { n: i });
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0].aid).toBe(getAid());
    expect(posts[0].events.length).toBeLessThanOrEqual(20);
    expect(posts[0].events[0].name).toBe('boot');
  });
});
