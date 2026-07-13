// ==========================================
// BrightModHub — Channel Manager
// ==========================================
// Manages per-channel SQLite databases and configuration files.
// Each monitored Twitch channel gets its own isolated DB in data/channels/.

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { ChannelConfig } from '../types';
import { getChannelConfig } from './channel-config';

const DATA_DIR = path.join(process.cwd(), 'data');
const CHANNELS_DIR = path.join(DATA_DIR, 'channels');
const LEGACY_DB_PATH = path.join(DATA_DIR, 'brightmod.db');

let activeChannel: string | null = null;
const dbCache = new Map<string, Database.Database>();

function sanitizeChannelName(channel: string): string {
  return channel
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 64);
}

export function getChannelsDir(): string {
  if (!fs.existsSync(CHANNELS_DIR)) {
    fs.mkdirSync(CHANNELS_DIR, { recursive: true });
  }
  return CHANNELS_DIR;
}

function getDbPath(channel: string): string {
  const name = sanitizeChannelName(channel);
  return path.join(getChannelsDir(), `${name}.db`);
}

/**
 * Migrate the legacy single-database file into the new per-channel layout.
 */
export function migrateLegacyDatabase(defaultChannel: string = 'brightmodhub'): void {
  if (!fs.existsSync(LEGACY_DB_PATH)) {
    return;
  }

  const targetPath = getDbPath(defaultChannel);
  if (fs.existsSync(targetPath)) {
    console.log(`[ChannelManager] Target ${targetPath} already exists. Keeping legacy DB at ${LEGACY_DB_PATH}.`);
    return;
  }

  try {
    fs.mkdirSync(CHANNELS_DIR, { recursive: true });
    fs.copyFileSync(LEGACY_DB_PATH, targetPath);
    fs.unlinkSync(LEGACY_DB_PATH);
    console.log(`[ChannelManager] Migrated legacy DB to ${targetPath}`);
  } catch (err) {
    console.error('[ChannelManager] Failed to migrate legacy DB:', err);
  }
}

function isBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build'
  );
}

/**
 * Open a database for a specific channel. Caches connections.
 * During Next.js build, returns an in-memory database to avoid polluting data/.
 */
export function openChannelDatabase(channel: string): Database.Database {
  const name = sanitizeChannelName(channel);

  if (dbCache.has(name)) {
    return dbCache.get(name)!;
  }

  if (isBuildPhase()) {
    const db = new Database(':memory:');
    dbCache.set(name, db);
    return db;
  }

  const dbPath = getDbPath(name);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  dbCache.set(name, db);
  return db;
}

/**
 * Close a channel database connection.
 */
export function closeChannelDatabase(channel: string): void {
  const name = sanitizeChannelName(channel);
  const db = dbCache.get(name);
  if (db) {
    db.close();
    dbCache.delete(name);
  }
}

/**
 * Close all channel database connections.
 */
export function closeAllChannelDatabases(): void {
  for (const [name, db] of dbCache) {
    db.close();
    dbCache.delete(name);
  }
}

/**
 * Set the active channel. Opens its database and loads its config.
 */
export function setActiveChannel(channel: string): Database.Database {
  const name = sanitizeChannelName(channel);

  if (activeChannel && activeChannel !== name) {
    // Optional: close previous channel DB to free resources
    // closeChannelDatabase(activeChannel);
  }

  activeChannel = name;
  const db = openChannelDatabase(name);
  // Ensure config file exists
  getChannelConfig(name);
  return db;
}

/**
 * Get the currently active channel name.
 */
export function getActiveChannel(): string | null {
  return activeChannel;
}

/**
 * Get the database for the currently active channel.
 * Falls back to the default channel if none is active.
 */
export function getActiveDatabase(defaultChannel: string = 'brightmodhub'): Database.Database {
  const channel = activeChannel || defaultChannel;
  return openChannelDatabase(channel);
}

/**
 * Get the database for a specific channel.
 */
export function getDatabaseForChannel(channel: string): Database.Database {
  return openChannelDatabase(channel);
}

/**
 * Get the config for the currently active channel.
 */
export function getActiveChannelConfig(defaultChannel: string = 'brightmodhub'): ChannelConfig {
  const channel = activeChannel || defaultChannel;
  return getChannelConfig(channel);
}

/**
 * List all channels that have a database file.
 */
export function listChannels(): string[] {
  if (!fs.existsSync(CHANNELS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(CHANNELS_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => f.replace(/\.db$/, ''));
}
