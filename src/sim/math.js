export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function euclideanModulo(n, m) {
  return ((n % m) + m) % m;
}

export function saturate(v) {
  return clamp(v, 0, 1);
}

export function smoothstep(e0, e1, x) {
  const t = saturate((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

export function angleDiff(from, to) {
  return euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

export function analogStick(dx, dy, rangePx, dead = 0.16) {
  const range = Math.max(1, rangePx);
  let nx = dx / range;
  let ny = dy / range;
  const len = Math.hypot(nx, ny);
  if (len > 1) {
    nx /= len;
    ny /= len;
  }
  const mag = Math.min(1, Math.hypot(nx, ny));
  if (mag <= dead) return { x: 0, y: 0 };
  const scaled = (mag - dead) / (1 - dead);
  return { x: (nx / mag) * scaled, y: (ny / mag) * scaled };
}
