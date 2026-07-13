// ==========================================
// BrightModHub — SQLite Database Layer (per-channel)
// ==========================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { TrackedUser, DetectionEvent, CommunicativeRank } from '../types';
import { KARMA_SCORE_MIN, KARMA_SCORE_MAX } from '../types';
import {
  getActiveDatabase,
  getActiveChannel,
  setActiveChannel as cmSetActiveChannel,
  getChannelsDir,
  listChannels,
} from './channel-manager';

const DEFAULT_CHANNEL = process.env.DEFAULT_CHANNEL || 'brightmodhub';

// Statement cache per channel
const stmtCache = new Map<string, Record<string, Database.Statement>>();

function getCacheKey(channel: string | null): string {
  return channel || DEFAULT_CHANNEL;
}

function getChannelCache(channel: string | null): Record<string, Database.Statement> {
  const key = getCacheKey(channel);
  if (!stmtCache.has(key)) {
    stmtCache.set(key, {});
  }
  return stmtCache.get(key)!;
}

function isBuildPhase(): boolean {
  // During `next build`, Next.js sets NEXT_PHASE. Avoid creating runtime DBs.
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build'
  );
}

function getDatabase(): Database.Database {
  const db = getActiveDatabase(DEFAULT_CHANNEL);

  if (isBuildPhase()) {
    // Don't create schema or runtime files during the build.
    return db;
  }

  // Ensure schema exists when the database is first accessed at runtime.
  initSchema(db);
  migrateSchema(db);
  return db;
}

function getStmt(key: string, sql: string): Database.Statement {
  const channel = getActiveChannel();
  const cache = getChannelCache(channel);
  if (!cache[key]) {
    cache[key] = getDatabase().prepare(sql);
  }
  return cache[key];
}

export function setActiveChannel(channel: string): void {
  cmSetActiveChannel(channel);
}

export function getCurrentChannel(): string {
  return getActiveChannel() || DEFAULT_CHANNEL;
}

export function initSchemaForActiveChannel(): void {
  // getDatabase() now initializes schema automatically.
  getDatabase();
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_scores (
      username      TEXT PRIMARY KEY,
      display_name  TEXT,
      score         INTEGER DEFAULT 0,
      is_subscriber INTEGER DEFAULT 0,
      is_mod        INTEGER DEFAULT 0,
      is_vip        INTEGER DEFAULT 0,
      sub_months    INTEGER DEFAULT 0,
      first_seen    TEXT DEFAULT (datetime('now')),
      last_seen     TEXT DEFAULT (datetime('now')),
      total_messages INTEGER DEFAULT 0,
      total_flags   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS detection_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL,
      detector_type TEXT NOT NULL,
      score_delta   INTEGER NOT NULL,
      details       TEXT,
      created_at    TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (username) REFERENCES user_scores(username)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel       TEXT NOT NULL,
      started_at    TEXT DEFAULT (datetime('now')),
      ended_at      TEXT,
      spam_mode     INTEGER DEFAULT 0,
      total_users   INTEGER DEFAULT 0,
      total_flags   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_username ON detection_events(username);
    CREATE INDEX IF NOT EXISTS idx_events_created ON detection_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_type ON detection_events(detector_type);
    CREATE INDEX IF NOT EXISTS idx_scores_score ON user_scores(score DESC);
  `);
}

function columnExists(database: Database.Database, table: string, column: string): boolean {
  const cols = database.pragma(`table_info(${table})`) as { name: string }[];
  return cols.some((c) => c.name === column);
}

function addColumnIfNotExists(
  database: Database.Database,
  table: string,
  column: string,
  def: string
): void {
  if (!columnExists(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

function migrateSchema(database: Database.Database): void {
  // v2 dimension columns
  addColumnIfNotExists(database, 'user_scores', 'bot_score', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'karma_score', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'no_lifer_flag', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'communicative_rank', "TEXT DEFAULT 'neutral'");
  addColumnIfNotExists(database, 'user_scores', 'avg_message_length', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'reply_ratio', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'unique_recipients', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'messages_per_minute', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'last_active_at', 'TEXT');
  addColumnIfNotExists(database, 'user_scores', 'command_ratio', 'REAL DEFAULT 0');
  addColumnIfNotExists(database, 'user_scores', 'command_spammer_flag', 'INTEGER DEFAULT 0');

  database.exec(`
    CREATE TABLE IF NOT EXISTS message_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL,
      message     TEXT NOT NULL,
      normalized  TEXT NOT NULL,
      timestamp   INTEGER NOT NULL,
      is_reply    INTEGER DEFAULT 0,
      reply_to    TEXT,
      word_count  INTEGER DEFAULT 0,
      FOREIGN KEY (username) REFERENCES user_scores(username)
    );
    CREATE INDEX IF NOT EXISTS idx_msg_history_user ON message_history(username, timestamp DESC);

    CREATE TABLE IF NOT EXISTS user_relationships (
      source_user TEXT NOT NULL,
      target_user TEXT NOT NULL,
      reply_count INTEGER DEFAULT 1,
      last_reply_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (source_user, target_user)
    );
  `);
}

// =====================
// User Score Operations
// =====================

export function upsertUser(
  username: string,
  displayName: string,
  isSub: boolean,
  isMod: boolean,
  isVip: boolean,
  subMonths: number
): void {
  const stmt = getStmt('upsertUser', `
    INSERT INTO user_scores (username, display_name, is_subscriber, is_mod, is_vip, sub_months, last_seen, total_messages, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 1, datetime('now'))
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      is_subscriber = excluded.is_subscriber,
      is_mod = excluded.is_mod,
      is_vip = excluded.is_vip,
      sub_months = excluded.sub_months,
      last_seen = datetime('now'),
      last_active_at = datetime('now'),
      total_messages = total_messages + 1
  `);
  stmt.run(username, displayName, isSub ? 1 : 0, isMod ? 1 : 0, isVip ? 1 : 0, subMonths);
}

/**
 * Legacy atomic score update. Kept for compatibility.
 */
export function updateScore(username: string, delta: number): number {
  const stmt = getStmt('updateScore', `
    UPDATE user_scores
    SET score = MAX(-1000, score + ?),
        bot_score = MAX(0, bot_score + ?),
        total_flags = CASE WHEN ? > 0 THEN total_flags + 1 ELSE total_flags END
    WHERE username = ?
    RETURNING score
  `);
  const result = stmt.get(delta, delta, delta, username) as { score: number } | undefined;
  return result?.score ?? 0;
}

export interface DimensionResult {
  botScore: number;
  karmaScore: number;
  noLiferFlag: boolean;
  commandSpammerFlag: boolean;
  communicativeRank: CommunicativeRank;
}

/**
 * Atomic update of bot_score, karma_score and optional classification fields.
 */
export function updateDimensions(
  username: string,
  botDelta: number,
  karmaDelta: number,
  noLiferFlag: boolean | null,
  communicativeRank: CommunicativeRank | null,
  commandSpammerFlag: boolean | null = null,
  commandRatio: number | null = null
): DimensionResult {
  const stmt = getStmt('updateDimensions', `
    UPDATE user_scores
    SET bot_score = MAX(0, bot_score + ?),
        karma_score = MIN(${KARMA_SCORE_MAX}, MAX(${KARMA_SCORE_MIN}, karma_score + ?)),
        no_lifer_flag = CASE
          WHEN ? IS NOT NULL THEN ?
          ELSE no_lifer_flag
        END,
        communicative_rank = CASE
          WHEN ? IS NOT NULL THEN ?
          ELSE communicative_rank
        END,
        command_spammer_flag = CASE
          WHEN ? IS NOT NULL THEN ?
          ELSE command_spammer_flag
        END,
        command_ratio = CASE
          WHEN ? IS NOT NULL THEN ?
          ELSE command_ratio
        END,
        total_flags = CASE WHEN ? > 0 THEN total_flags + 1 ELSE total_flags END,
        last_active_at = datetime('now')
    WHERE username = ?
    RETURNING bot_score, karma_score, no_lifer_flag, command_spammer_flag, communicative_rank
  `);
  const result = stmt.get(
    botDelta,
    karmaDelta,
    noLiferFlag === null ? null : (noLiferFlag ? 1 : 0),
    noLiferFlag === null ? null : (noLiferFlag ? 1 : 0),
    communicativeRank,
    communicativeRank,
    commandSpammerFlag === null ? null : (commandSpammerFlag ? 1 : 0),
    commandSpammerFlag === null ? null : (commandSpammerFlag ? 1 : 0),
    commandRatio,
    commandRatio,
    botDelta,
    username
  ) as {
    bot_score: number;
    karma_score: number;
    no_lifer_flag: number;
    command_spammer_flag: number;
    communicative_rank: string;
  } | undefined;

  if (!result) {
    return { botScore: 0, karmaScore: 0, noLiferFlag: false, commandSpammerFlag: false, communicativeRank: 'neutral' };
  }

  return {
    botScore: result.bot_score,
    karmaScore: result.karma_score,
    noLiferFlag: !!result.no_lifer_flag,
    commandSpammerFlag: !!result.command_spammer_flag,
    communicativeRank: result.communicative_rank as CommunicativeRank,
  };
}

export function updateUserSocialMetrics(
  username: string,
  avgMessageLength: number,
  replyRatio: number,
  uniqueRecipients: number,
  messagesPerMinute: number,
  commandRatio: number = 0
): void {
  const stmt = getStmt('updateUserSocialMetrics', `
    UPDATE user_scores
    SET avg_message_length = ?,
        reply_ratio = ?,
        unique_recipients = ?,
        messages_per_minute = ?,
        command_ratio = ?,
        last_active_at = datetime('now')
    WHERE username = ?
  `);
  stmt.run(avgMessageLength, replyRatio, uniqueRecipients, messagesPerMinute, commandRatio, username);
}

export function getUser(username: string): TrackedUser | null {
  const stmt = getStmt('getUser', `SELECT * FROM user_scores WHERE username = ?`);
  const row = stmt.get(username) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapUserRow(row);
}

export function getTopUsers(limit: number = 50, offset: number = 0): TrackedUser[] {
  const stmt = getStmt('getTopUsers', `
    SELECT * FROM user_scores ORDER BY bot_score DESC LIMIT ? OFFSET ?
  `);
  const rows = stmt.all(limit, offset) as Record<string, unknown>[];
  return rows.map(mapUserRow);
}

export function getUsersByCategory(
  category: 'bot' | 'no_lifer' | 'command_spammer' | 'communicative',
  limit: number = 50
): TrackedUser[] {
  let sql = '';
  switch (category) {
    case 'bot':
      sql = `SELECT * FROM user_scores WHERE bot_score > 300 ORDER BY bot_score DESC LIMIT ?`;
      break;
    case 'no_lifer':
      sql = `SELECT * FROM user_scores WHERE no_lifer_flag = 1 ORDER BY messages_per_minute DESC LIMIT ?`;
      break;
    case 'command_spammer':
      sql = `SELECT * FROM user_scores WHERE command_spammer_flag = 1 ORDER BY command_ratio DESC LIMIT ?`;
      break;
    case 'communicative':
      sql = `SELECT * FROM user_scores WHERE communicative_rank IN ('talkative', 'socialite', 'regular') ORDER BY karma_score ASC LIMIT ?`;
      break;
  }
  const stmt = getStmt(`getUsersByCategory_${category}`, sql);
  const rows = stmt.all(limit) as Record<string, unknown>[];
  return rows.map(mapUserRow);
}

export function getAllUsers(): TrackedUser[] {
  const stmt = getStmt('getAllUsers', `SELECT * FROM user_scores ORDER BY bot_score DESC, karma_score ASC`);
  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(mapUserRow);
}

export function getUserCount(): number {
  const stmt = getStmt('getUserCount', `SELECT COUNT(*) as count FROM user_scores`);
  const result = stmt.get() as { count: number };
  return result.count;
}

// =========================
// Detection Event Operations
// =========================

export function insertEvent(event: DetectionEvent): void {
  const stmt = getStmt('insertEvent', `
    INSERT INTO detection_events (username, detector_type, score_delta, details)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(event.username, event.detectorType, event.scoreDelta, event.details);
}

export function getRecentEvents(limit: number = 100): DetectionEvent[] {
  const stmt = getStmt('getRecentEvents', `
    SELECT * FROM detection_events ORDER BY created_at DESC LIMIT ?
  `);
  return stmt.all(limit) as DetectionEvent[];
}

export function getEventsByUser(username: string, limit: number = 50): DetectionEvent[] {
  const stmt = getStmt('getEventsByUser', `
    SELECT * FROM detection_events WHERE username = ? ORDER BY created_at DESC LIMIT ?
  `);
  return stmt.all(username, limit) as DetectionEvent[];
}

// =========================
// Message History Operations
// =========================

export function insertMessageHistory(
  username: string,
  message: string,
  normalized: string,
  timestamp: number,
  isReply: boolean,
  replyTo: string | null,
  wordCount: number
): void {
  const stmt = getStmt('insertMessageHistory', `
    INSERT INTO message_history (username, message, normalized, timestamp, is_reply, reply_to, word_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(username, message, normalized, timestamp, isReply ? 1 : 0, replyTo, wordCount);

  // Keep only the last 100 messages per user
  const trimStmt = getStmt('trimMessageHistory', `
    DELETE FROM message_history
    WHERE id NOT IN (
      SELECT id FROM message_history WHERE username = ? ORDER BY timestamp DESC LIMIT 100
    )
  `);
  trimStmt.run(username);
}

export function getMessageHistory(
  username: string,
  limit: number = 50
): { message: string; normalized: string; timestamp: number; isReply: boolean; replyTo: string | null; wordCount: number }[] {
  const stmt = getStmt('getMessageHistory', `
    SELECT message, normalized, timestamp, is_reply as isReply, reply_to as replyTo, word_count as wordCount
    FROM message_history
    WHERE username = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(username, limit) as any[];
}

// =========================
// Relationship Operations
// =========================

export function upsertRelationship(sourceUser: string, targetUser: string): void {
  const stmt = getStmt('upsertRelationship', `
    INSERT INTO user_relationships (source_user, target_user, reply_count, last_reply_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(source_user, target_user) DO UPDATE SET
      reply_count = reply_count + 1,
      last_reply_at = datetime('now')
  `);
  stmt.run(sourceUser, targetUser);
}

export function getRelationships(username: string): { targetUser: string; replyCount: number; lastReplyAt: string }[] {
  const stmt = getStmt('getRelationships', `
    SELECT target_user as targetUser, reply_count as replyCount, last_reply_at as lastReplyAt
    FROM user_relationships
    WHERE source_user = ?
    ORDER BY reply_count DESC
  `);
  return stmt.all(username) as any[];
}

// ==================
// Session Operations
// ==================

export function startSession(channel: string): number {
  const stmt = getStmt('startSession', `
    INSERT INTO sessions (channel) VALUES (?) RETURNING id
  `);
  const result = stmt.get(channel) as { id: number };
  return result.id;
}

export function endSession(id: number, totalUsers: number, totalFlags: number): void {
  const stmt = getStmt('endSession', `
    UPDATE sessions SET ended_at = datetime('now'), total_users = ?, total_flags = ? WHERE id = ?
  `);
  stmt.run(totalUsers, totalFlags, id);
}

// =======
// Helpers
// =======

function mapUserRow(row: Record<string, unknown>): TrackedUser {
  const botScore = (row.bot_score as number | undefined) ?? (row.score as number) ?? 0;
  return {
    username: row.username as string,
    displayName: (row.display_name as string) || (row.username as string),
    score: botScore, // legacy field maps to bot_score
    botScore,
    karmaScore: (row.karma_score as number | undefined) ?? 0,
    isSubscriber: !!(row.is_subscriber as number),
    isMod: !!(row.is_mod as number),
    isVip: !!(row.is_vip as number),
    subMonths: row.sub_months as number,
    firstSeen: row.first_seen as string,
    lastSeen: row.last_seen as string,
    totalMessages: row.total_messages as number,
    totalFlags: row.total_flags as number,
    noLiferFlag: !!(row.no_lifer_flag as number | undefined),
    commandSpammerFlag: !!(row.command_spammer_flag as number | undefined),
    commandRatio: (row.command_ratio as number | undefined) ?? 0,
    communicativeRank: (row.communicative_rank as CommunicativeRank | undefined) ?? 'neutral',
    avgMessageLength: (row.avg_message_length as number | undefined) ?? 0,
    replyRatio: (row.reply_ratio as number | undefined) ?? 0,
    uniqueRecipients: (row.unique_recipients as number | undefined) ?? 0,
    messagesPerMinute: (row.messages_per_minute as number | undefined) ?? 0,
  };
}

// =====================
// Score Export
// =====================

/**
 * Export all user scores for the active channel to a text file.
 */
export function exportScoresToFile(): string {
  const users = getAllUsers();
  const channel = getCurrentChannel();
  const filePath = path.join(getChannelsDir(), `${channel}_scores.txt`);

  const lines: string[] = [];
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('  BrightModHub — User Scores Export');
  lines.push(`  Channel: #${channel}`);
  lines.push(`  Exported: ${new Date().toLocaleString('de-DE')}`);
  lines.push(`  Total Users: ${users.length}`);
  lines.push('═══════════════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('  Bot    | Karma  | No-Lifer | Rank        | User');
  lines.push('  -------|--------|----------|-------------|-------------------');

  for (const user of users) {
    const botStr = String(user.botScore).padStart(4, ' ');
    const karmaStr = String(user.karmaScore).padStart(4, ' ');
    const noLiferStr = user.noLiferFlag ? 'YES' : 'no ';
    const rankStr = user.communicativeRank.padEnd(11, ' ');
    lines.push(
      `  ${botStr} | ${karmaStr} | ${noLiferStr}      | ${rankStr} | ${user.displayName} (@${user.username})`
    );
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────────────');
  lines.push('  Bot thresholds: >100 suspicious, >300 likely_bot, >700 confirmed_bot');
  lines.push('  Karma: <-50 trusted, >50 flagged');
  lines.push('───────────────────────────────────────────────────────────────────────');

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  return filePath;
}

/**
 * Get all sessions for the active channel ordered by most recent first.
 */
export function getSessions(): {
  id: number;
  channel: string;
  startedAt: string;
  endedAt: string | null;
  totalUsers: number;
  totalFlags: number;
}[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT id, channel, started_at as startedAt, ended_at as endedAt,
           total_users as totalUsers, total_flags as totalFlags
    FROM sessions
    ORDER BY started_at DESC
    LIMIT 50
  `);
  return stmt.all() as any[];
}

/**
 * Delete all tracked data for the active channel.
 */
export function clearAllData(): void {
  const database = getDatabase();
  database.exec(`
    DELETE FROM detection_events;
    DELETE FROM user_scores;
    DELETE FROM sessions;
    DELETE FROM message_history;
    DELETE FROM user_relationships;
  `);
}

export function closeDatabase(): void {
  // Handled by channel-manager closeAllChannelDatabases()
}

export { listChannels };
