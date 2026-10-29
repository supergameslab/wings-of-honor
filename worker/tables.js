/** Shared D1 table names for Super Games Lab workers. Keep identical on Sopwith and Wings. */
export const TABLES = {
  authUsers: 'auth_users',
  authSessions: 'auth_sessions',
  authMagicLinks: 'auth_magic_links',
  authBannedEmails: 'auth_banned_emails',

  socialSquadrons: 'social_squadrons',
  socialMembers: 'social_squadron_members',
  socialInvites: 'social_invites',
  socialBlocks: 'social_blocks',
  socialRecent: 'social_recent',

  matchRooms: 'match_rooms',
  matchPilots: 'match_pilots',
  matchTickets: 'match_tickets',
  matchChallenges: 'match_challenges',

  progressSorties: 'progress_sorties',
  progressRibbons: 'progress_ribbons',
  progressSync: 'progress_sync',

  shopEntitlements: 'shop_entitlements',

  moderationReports: 'moderation_reports',

  opsIdents: 'ops_idents',
  opsTelemetry: 'ops_telemetry',
  opsFunnel: 'ops_funnel',
  opsMissions: 'ops_missions',
  opsFlags: 'ops_flags',
  opsAudit: 'ops_audit',
  opsCounters: 'ops_counters',
};

export const LEGACY_TABLES = {
  authUsers: 'users',
  authSessions: 'sessions',
  authMagicLinks: 'magic_links',
  authBannedEmails: 'banned_emails',

  socialSquadrons: 'squadrons',
  socialMembers: 'squadron_members',
  socialInvites: 'invites',
  socialBlocks: 'blocks',
  socialRecent: 'recent_contacts',

  matchRooms: 'matches',
  matchPilots: 'match_pilots',
  matchTickets: 'join_tickets',
  matchChallenges: 'challenges',

  progressSorties: 'sortie_history',
  progressRibbons: 'ribbons',
  progressSync: 'progress_sync',

  shopEntitlements: 'entitlements',

  moderationReports: 'reports',

  opsIdents: 'idents',
  opsTelemetry: 'telemetry_blobs',
  opsFunnel: 'funnel_daily',
  opsMissions: 'mission_daily',
  opsFlags: 'flags',
  opsAudit: 'ops_audit',
  opsCounters: 'ops_counters',
};

export const COLS = {
  user: 'id, username, email, created_at, last_seen, age_ok, username_changed_at, banned, deleted',
  ident: 'aid, user_id, first_seen, last_seen, telemetry_ok',
  magic: 'token, email, created_at, expires_at, used',
  invite: 'token, kind, from_user, email, to_user, payload, created_at, expires_at, accepted',
  squadron: 'id, name, tag, owner_id, roster_cap, tag_color, created_at, dissolved',
  room: 'id, mode, ranked, difficulty, mission_id, status, host_id, created_at, completed_at, winner_team, seed, live_at, do_ms',
  progress: 'user_id, unlocked, completed, stars, craft_id, onboarded, rev, updated_at',
};

/** Indexes for real WHERE / JOIN / ORDER BY paths. Unique constraints already cover email, username, tag. */
export const INDEXES = [
  { name: 'idx_auth_sessions_user', on: 'auth_sessions(user_id)' },
  { name: 'idx_auth_sessions_expires', on: 'auth_sessions(expires_at)' },
  { name: 'idx_auth_magic_expires', on: 'auth_magic_links(expires_at)' },
  { name: 'idx_social_members_user', on: 'social_squadron_members(user_id)' },
  { name: 'idx_social_invites_inbox', on: 'social_invites(to_user, accepted, expires_at)' },
  { name: 'idx_social_invites_email', on: 'social_invites(email, accepted, expires_at)' },
  { name: 'idx_social_invites_from', on: 'social_invites(from_user, accepted, expires_at)' },
  { name: 'idx_social_recent_at', on: 'social_recent(user_id, at)' },
  { name: 'idx_match_rooms_status', on: 'match_rooms(status, mode, created_at)' },
  { name: 'idx_match_pilots_user', on: 'match_pilots(user_id)' },
  { name: 'idx_progress_sorties_user', on: 'progress_sorties(user_id, at)' },
  { name: 'idx_progress_sorties_board', on: 'progress_sorties(at, kind)' },
  { name: 'idx_progress_ribbons_user', on: 'progress_ribbons(user_id, at)' },
  { name: 'idx_moderation_reports_at', on: 'moderation_reports(at)' },
  { name: 'idx_ops_idents_user', on: 'ops_idents(user_id)' },
  { name: 'idx_ops_idents_first', on: 'ops_idents(first_seen)' },
  { name: 'idx_ops_idents_seen', on: 'ops_idents(last_seen)' },
  { name: 'idx_ops_telemetry_at', on: 'ops_telemetry(at)' },
  { name: 'idx_ops_telemetry_aid', on: 'ops_telemetry(aid)' },
  { name: 'idx_ops_audit_at', on: 'ops_audit(at)' },
];

const LEGACY_INDEXES = ['idx_idents_user', 'idx_idents_seen', 'idx_blobs_at', 'idx_blobs_aid'];

export function renameStatements() {
  return Object.keys(TABLES)
    .filter((key) => LEGACY_TABLES[key] !== TABLES[key])
    .map((key) => `ALTER TABLE ${LEGACY_TABLES[key]} RENAME TO ${TABLES[key]};`);
}

export function indexStatements() {
  return [
    ...LEGACY_INDEXES.map((name) => `DROP INDEX IF EXISTS ${name};`),
    ...INDEXES.map((idx) => `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.on};`),
  ];
}
