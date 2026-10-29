ALTER TABLE auth_users ADD COLUMN banned INTEGER DEFAULT 0;

ALTER TABLE shop_entitlements ADD COLUMN expires_at INTEGER;
ALTER TABLE shop_entitlements ADD COLUMN source TEXT;
ALTER TABLE shop_entitlements ADD COLUMN order_id TEXT;

CREATE TABLE IF NOT EXISTS shop_items (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  blurb TEXT,
  game TEXT,
  active INTEGER DEFAULT 1,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS shop_prices (
  sku TEXT NOT NULL,
  interval TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  stripe_price_test TEXT,
  stripe_price_live TEXT,
  PRIMARY KEY (sku, interval)
);

CREATE TABLE IF NOT EXISTS shop_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS shop_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  sku TEXT,
  stripe_id TEXT,
  status TEXT,
  amount_cents INTEGER,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shop_stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seo_pages (
  path TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  canonical TEXT,
  twitter TEXT,
  jsonld_extra TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS comms_templates (
  slug TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  updated_at INTEGER
);

INSERT OR IGNORE INTO ops_flags (k, v) VALUES ('payments_mode', 'off');

INSERT OR IGNORE INTO seo_pages (path, title, description, og_title, og_description, og_image, canonical, twitter, updated_at)
VALUES (
  '/wings-of-honor',
  'Wings of Honor',
  'Wings of Honor — hop in a Spitfire and fly. Fly. Fight. Win.',
  'Wings of Honor',
  'Bank to turn, fire, and have fun in a WWII flying game in your browser.',
  'https://supergameslab.com/wings-of-honor/og.png',
  'https://supergameslab.com/wings-of-honor',
  'summary_large_image',
  0
);

INSERT OR IGNORE INTO comms_templates (slug, subject, html, text, updated_at) VALUES
('magic', 'Your Wings of Honor flying link', '<p>Tap to hop into Wings of Honor. This link works once:</p><p><a href="{{link}}">{{link}}</a></p>', 'Tap to hop into Wings of Honor. This link works once:\n{{link}}', 0),
('invite', '{{fromName}} wants you in the sky', '<p>{{fromName}} invited you to fly in Wings of Honor.</p><p><a href="{{link}}">{{link}}</a></p>', '{{fromName}} invited you to fly in Wings of Honor.\n{{link}}', 0),
('receipt', 'Your Wings of Honor hangar receipt', '<p>You now have {{sku}} in Wings of Honor.</p>', 'You now have {{sku}} in Wings of Honor.', 0),
('subscription_renewed', 'Wings of Honor subscription renewed', '<p>Your {{sku}} subscription renewed.</p>', 'Your {{sku}} subscription renewed.', 0),
('subscription_failed', 'Wings of Honor subscription payment failed', '<p>We could not renew {{sku}}.</p>', 'We could not renew {{sku}}.', 0);
