import { one, all, run, squadronOf } from './db.js';
import { TABLES as T } from './tables.js';
import { json, now, originOf, timingSafeEqual, token } from './util.js';
import { flagsOf } from './ops.js';
import { sendTemplate } from './mail.js';

export const GAME = 'wings';
export const MOUNT = '/wings-of-honor';

export const SHOP_SEED = [
  { sku: 'founder', name: 'Founder pack', price: 900, kind: 'pack', blurb: 'Roundels, linen, smoke, title.', payload: { pack: 'founder' } },
  { sku: 'skin_olive', name: 'Olive linen', price: 300, kind: 'skin', blurb: 'Olive linen', payload: { skinId: 'olive' } },
  { sku: 'skin_sand', name: 'Desert linen', price: 300, kind: 'skin', blurb: 'Desert linen', payload: { skinId: 'sand' } },
  { sku: 'skin_night', name: 'Night linen', price: 300, kind: 'skin', blurb: 'Night linen', payload: { skinId: 'night' } },
  { sku: 'charter', name: 'Squadron charter', price: 1200, kind: 'charter', blurb: 'Tag colour, roster 24, Duel archive.', payload: { charter: true } },
  { sku: 'season', name: 'Season pass', price: 800, kind: 'season', blurb: 'Cosmetics and ribbons only.', payload: { season: true }, interval: 'month' },
];

let catalogCache = { at: 0, items: null };

export function paymentsMode(env, flags) {
  if (flags.payments_mode === 'off' || flags.payments_mode === 'test' || flags.payments_mode === 'live') return flags.payments_mode;
  if (flags.shop_enabled === '0') return 'off';
  if (env.STRIPE_SECRET_LIVE) return 'live';
  if (env.STRIPE_SECRET_TEST || env.STRIPE_SECRET) return 'test';
  return 'off';
}

export function stripeSecret(env, mode) {
  if (mode === 'live') return env.STRIPE_SECRET_LIVE || '';
  if (mode === 'test') return env.STRIPE_SECRET_TEST || env.STRIPE_SECRET || '';
  return '';
}

function webhookSecret(env, mode) {
  if (mode === 'live') return env.STRIPE_WEBHOOK_SECRET_LIVE || env.STRIPE_WEBHOOK_SECRET || '';
  if (mode === 'test') return env.STRIPE_WEBHOOK_SECRET_TEST || env.STRIPE_WEBHOOK_SECRET || '';
  return env.STRIPE_WEBHOOK_SECRET || '';
}

async function seedShop(env) {
  for (const item of SHOP_SEED) {
    await run(
      env,
      `INSERT OR IGNORE INTO shop_items (sku, name, kind, blurb, game, active, payload_json) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      item.sku,
      item.name,
      item.kind,
      item.blurb || '',
      GAME,
      JSON.stringify(item.payload || {}),
    );
    await run(
      env,
      `INSERT OR IGNORE INTO shop_prices (sku, interval, amount_cents, currency) VALUES (?, ?, ?, 'usd')`,
      item.sku,
      item.interval || 'once',
      item.price,
    );
  }
}

export async function catalogOf(env) {
  if (catalogCache.items && Date.now() - catalogCache.at < 60_000) return catalogCache.items;
  try {
    await seedShop(env);
    const rows = await all(
      env,
      `SELECT i.sku, i.name, i.kind, i.blurb, i.active, i.payload_json, p.amount_cents, p.currency, p.interval, p.stripe_price_test, p.stripe_price_live
       FROM shop_items i LEFT JOIN shop_prices p ON p.sku = i.sku WHERE i.active = 1`,
    );
    const items = (rows.length ? rows : SHOP_SEED.map((s) => ({ ...s, amount_cents: s.price, interval: s.interval || 'once', active: 1 }))).map((r) => ({
      sku: r.sku,
      name: r.name,
      kind: r.kind,
      blurb: r.blurb || '',
      price: r.amount_cents || r.price || 0,
      interval: r.interval || 'once',
      payload_json: r.payload_json || '{}',
      stripe_price_test: r.stripe_price_test || '',
      stripe_price_live: r.stripe_price_live || '',
    }));
    catalogCache = { at: Date.now(), items };
    return items;
  } catch {
    return SHOP_SEED.map((s) => ({ sku: s.sku, name: s.name, kind: s.kind, blurb: s.blurb || '', price: s.price, interval: s.interval || 'once' }));
  }
}

export async function itemOf(env, sku) {
  const items = await catalogOf(env);
  return items.find((s) => s.sku === sku) || null;
}

async function fulfill(env, { userId, sku, source, orderId, expiresAt, amount }) {
  if (!userId || !sku) return;
  await run(
    env,
    `INSERT INTO ${T.shopEntitlements} (user_id, sku, at, expires_at, source, order_id) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, sku) DO UPDATE SET at = excluded.at, expires_at = excluded.expires_at, source = excluded.source, order_id = excluded.order_id`,
    userId,
    sku,
    now(),
    expiresAt || null,
    source || 'stripe',
    orderId || null,
  );
  const item = await itemOf(env, sku);
  let payload = {};
  try {
    payload = JSON.parse(item?.payload_json || '{}');
  } catch {
    payload = {};
  }
  if (sku === 'charter' || payload.charter) {
    const sq = await squadronOf(env, userId);
    if (sq && sq.role === 'owner') await run(env, `UPDATE ${T.socialSquadrons} SET roster_cap = 24 WHERE id = ?`, sq.id);
  }
  if (orderId) {
    await run(
      env,
      `INSERT OR IGNORE INTO shop_orders (id, user_id, sku, stripe_id, status, amount_cents, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      orderId,
      userId,
      sku,
      orderId,
      'paid',
      amount || item?.price || 0,
      now(),
    );
  }
}

export async function routeShop(request, env, url, { currentUser, requireUser }) {
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = request.method;
  const flags = await flagsOf(env);
  const mode = paymentsMode(env, flags);
  const secret = stripeSecret(env, mode);

  if (path === '/api/shop' && method === 'GET') {
    const user = await currentUser(request, env);
    const owned = user ? await all(env, `SELECT sku, at, expires_at FROM ${T.shopEntitlements} WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)`, user.id, now()) : [];
    const catalog = (await catalogOf(env)).filter((s) => s.sku !== 'season' || s.kind === 'season').map((s) => ({
      sku: s.sku,
      name: s.name,
      price: s.price,
      kind: s.kind,
      blurb: s.blurb,
      interval: s.interval,
    }));
    const customer = user ? await one(env, 'SELECT * FROM shop_customers WHERE user_id = ?', user.id) : null;
    const stripeOn = Boolean(secret) && mode !== 'off';
    return json(request, {
      catalog: catalog.filter((s) => s.sku !== 'season'),
      owned,
      stripe: stripeOn,
      native: false,
      devGrant: !stripeOn && env.MP_DEV !== '0',
      interval: true,
      manageUrl: Boolean(customer?.stripe_customer && stripeOn),
    });
  }

  if (path === '/api/shop/checkout' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    if (mode === 'off') return json(request, { error: 'the paint shop is not open yet' }, 503);
    const body = await request.json().catch(() => ({}));
    const item = await itemOf(env, body.sku);
    if (!item) return json(request, { error: 'unknown sku' }, 400);
    if (!secret) {
      if (env.MP_DEV === '0') return json(request, { error: 'the paint shop is not open yet' }, 503);
      await fulfill(env, { userId: user.id, sku: item.sku, source: 'dev', orderId: `dev_${token(8)}` });
      return json(request, { ok: true, granted: item.sku, dev: true });
    }
    const origin = originOf(request);
    const success = `${origin}${MOUNT}/?shop=ok`;
    const cancel = `${origin}${MOUNT}/?shop=cancel`;
    const sub = item.kind === 'sub' || item.kind === 'season' || (item.interval && item.interval !== 'once');
    const priceId = mode === 'live' ? item.stripe_price_live : item.stripe_price_test;
    const params = new URLSearchParams({
      mode: sub ? 'subscription' : 'payment',
      success_url: success,
      cancel_url: cancel,
      client_reference_id: user.id,
      customer_email: user.email,
      'metadata[sku]': item.sku,
      'metadata[user]': user.id,
      'metadata[game]': GAME,
    });
    if (priceId) {
      params.set('line_items[0][price]', priceId);
      params.set('line_items[0][quantity]', '1');
    } else {
      params.set('line_items[0][price_data][currency]', 'usd');
      params.set('line_items[0][price_data][product_data][name]', item.name);
      params.set('line_items[0][price_data][unit_amount]', String(item.price));
      params.set('line_items[0][quantity]', '1');
      if (sub) params.set('line_items[0][price_data][recurring][interval]', item.interval === 'year' ? 'year' : 'month');
    }
    const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await session.json();
    return json(request, { url: data.url, id: data.id, error: data.error?.message });
  }

  if (path === '/api/shop/manage' && method === 'POST') {
    const { user, error } = await requireUser(request, env);
    if (error) return error;
    if (mode === 'off' || !secret) return json(request, { error: 'the paint shop is not open yet' }, 503);
    const row = await one(env, 'SELECT * FROM shop_customers WHERE user_id = ?', user.id);
    if (!row?.stripe_customer) return json(request, { error: 'no billing portal yet' }, 400);
    const session = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer: row.stripe_customer, return_url: `${originOf(request)}${MOUNT}/` }),
    });
    const data = await session.json();
    return json(request, { url: data.url });
  }

  if (path === '/api/shop/webhook' && method === 'POST') {
    const raw = await request.text();
    const live = Boolean(env.STRIPE_SECRET_LIVE) && (request.headers.get('Stripe-Signature') || '').length > 0;
    const hookMode = mode === 'off' ? (env.STRIPE_WEBHOOK_SECRET_LIVE ? 'live' : 'test') : mode;
    const whsec = webhookSecret(env, hookMode) || webhookSecret(env, live ? 'live' : 'test');
    if (whsec) {
      const sig = request.headers.get('Stripe-Signature') || '';
      const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=')));
      const signed = `${parts.t}.${raw}`;
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(whsec), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signed));
      const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const got = String(parts.v1 || '');
      if (!timingSafeEqual(hex, got)) return json(request, { error: 'bad signature' }, 400);
    } else if (env.MP_DEV === '0') {
      return json(request, { error: 'webhook secret missing' }, 503);
    }
    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return json(request, { error: 'bad json' }, 400);
    }
    const eventId = body.id || token(12);
    const seen = await one(env, 'SELECT id FROM shop_stripe_events WHERE id = ?', eventId);
    if (seen) return json(request, { ok: true, dup: true });
    await run(env, 'INSERT INTO shop_stripe_events (id, type, at) VALUES (?, ?, ?)', eventId, body.type || '', now());
    const obj = body.data?.object || {};
    const sku = obj.metadata?.sku || obj.lines?.data?.[0]?.price?.metadata?.sku;
    const userId = obj.metadata?.user || obj.client_reference_id;
    if (obj.customer && userId) {
      await run(
        env,
        `INSERT INTO shop_customers (user_id, stripe_customer, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET stripe_customer = excluded.stripe_customer, updated_at = excluded.updated_at`,
        userId,
        obj.customer,
        now(),
      );
    }
    const type = body.type || '';
    if (type === 'checkout.session.completed' || type === 'invoice.paid') {
      const periodEnd = obj.current_period_end ? obj.current_period_end * 1000 : obj.lines?.data?.[0]?.period?.end * 1000;
      await fulfill(env, {
        userId,
        sku,
        source: 'stripe',
        orderId: obj.id,
        expiresAt: periodEnd || null,
        amount: obj.amount_total || obj.amount_paid,
      });
      if (userId && sku) {
        const user = await one(env, `SELECT email FROM ${T.authUsers} WHERE id = ?`, userId);
        if (user?.email) await sendTemplate(env, type === 'invoice.paid' ? 'subscription_renewed' : 'receipt', user.email, { sku });
      }
    }
    if (type === 'customer.subscription.updated' || type === 'customer.subscription.created') {
      const periodEnd = obj.current_period_end ? obj.current_period_end * 1000 : null;
      if (userId && sku) await fulfill(env, { userId, sku, source: 'stripe', orderId: obj.id, expiresAt: periodEnd });
    }
    if (type === 'customer.subscription.deleted' || type === 'charge.refunded' || type === 'invoice.payment_failed') {
      if (userId && sku) await run(env, `DELETE FROM ${T.shopEntitlements} WHERE user_id = ? AND sku = ?`, userId, sku);
      if (type === 'invoice.payment_failed' && userId && sku) {
        const user = await one(env, `SELECT email FROM ${T.authUsers} WHERE id = ?`, userId);
        if (user?.email) await sendTemplate(env, 'subscription_failed', user.email, { sku });
      }
    }
    return json(request, { ok: true });
  }

  return null;
}
