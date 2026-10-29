export const BASE_URL = import.meta.env.BASE_URL || '/';

export function apiPath(path) {
  const rel = String(path || '').replace(/^\//, '');
  return `${BASE_URL}${rel}`;
}
