import { one } from './db.js';

const PATH = '/wings-of-honor';
let cache = { at: 0, row: null };

export async function localSeo(env) {
  if (cache.row && Date.now() - cache.at < 60_000) return cache.row;
  try {
    const row = await one(env, 'SELECT * FROM seo_pages WHERE path = ?', PATH);
    cache = { at: Date.now(), row };
    return row;
  } catch {
    return null;
  }
}

export function applyGameSeo(response, row) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') || response.status !== 200 || !row) return response;
  return new HTMLRewriter()
    .on('title', { element(el) { if (row.title) el.setInnerContent(row.title); } })
    .on('meta[name="description"]', { element(el) { if (row.description) el.setAttribute('content', row.description); } })
    .on('meta[property="og:title"]', { element(el) { if (row.og_title) el.setAttribute('content', row.og_title); } })
    .on('meta[property="og:description"]', { element(el) { if (row.og_description) el.setAttribute('content', row.og_description); } })
    .on('meta[property="og:image"]', { element(el) { if (row.og_image) el.setAttribute('content', row.og_image); } })
    .on('meta[property="og:url"]', { element(el) { if (row.canonical) el.setAttribute('content', row.canonical); } })
    .on('link[rel="canonical"]', { element(el) { if (row.canonical) el.setAttribute('href', row.canonical); } })
    .on('script[type="application/ld+json"]', {
      element(el) {
        if (row.jsonld_extra) el.setInnerContent(row.jsonld_extra);
      },
    })
    .transform(response);
}
