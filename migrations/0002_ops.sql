CREATE TABLE IF NOT EXISTS idents (
  aid TEXT PRIMARY KEY,
  user_id TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  telemetry_ok INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_idents_user ON idents(user_id);
CREATE INDEX IF NOT EXISTS idx_idents_seen ON idents(last_seen);

CREATE TABLE IF NOT EXISTS telemetry_blobs (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  aid TEXT NOT NULL,
  user_id TEXT,
  n INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_blobs_at ON telemetry_blobs(at);
CREATE INDEX IF NOT EXISTS idx_blobs_aid ON telemetry_blobs(aid);

CREATE TABLE IF NOT EXISTS funnel_daily (
  day INTEGER PRIMARY KEY,
  boots INTEGER DEFAULT 0,
  starts INTEGER DEFAULT 0,
  first_kills INTEGER DEFAULT 0,
  onboard_finishes INTEGER DEFAULT 0,
  mission1_finishes INTEGER DEFAULT 0,
  d7_returns INTEGER DEFAULT 0,
  hunt_matches INTEGER DEFAULT 0,
  hunt_practice INTEGER DEFAULT 0,
  median_hunt_wait_s INTEGER DEFAULT 0,
  do_minutes INTEGER DEFAULT 0,
  webgl_fail INTEGER DEFAULT 0,
  client_error INTEGER DEFAULT 0,
  new_aids INTEGER DEFAULT 0,
  boot_ms_p50 INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mission_daily (
  day INTEGER NOT NULL,
  mission_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  starts INTEGER DEFAULT 0,
  finishes INTEGER DEFAULT 0,
  fails INTEGER DEFAULT 0,
  median_s INTEGER DEFAULT 0,
  PRIMARY KEY (day, mission_id, kind, difficulty)
);

CREATE TABLE IF NOT EXISTS progress_sync (
  user_id TEXT PRIMARY KEY,
  unlocked INTEGER NOT NULL DEFAULT 1,
  completed TEXT NOT NULL DEFAULT '[]',
  stars TEXT NOT NULL DEFAULT '{}',
  craft_id TEXT NOT NULL DEFAULT 'camel',
  onboarded INTEGER DEFAULT 0,
  rev INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS banned_emails (
  email TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  from_user TEXT,
  about_user TEXT,
  match_id TEXT,
  note TEXT,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ops_audit (
  id TEXT PRIMARY KEY,
  at INTEGER NOT NULL,
  action TEXT NOT NULL,
  target TEXT
);

CREATE TABLE IF NOT EXISTS ops_counters (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO flags (k, v) VALUES ('mp_enabled', '1');
INSERT OR IGNORE INTO flags (k, v) VALUES ('shop_enabled', '1');
INSERT OR IGNORE INTO flags (k, v) VALUES ('telemetry_enabled', '1');
