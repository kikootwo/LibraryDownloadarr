import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  plexToken?: string;
  plexId?: string;
  serverUrl?: string;
  isAdmin: boolean;
  createdAt: number;
  lastLogin?: number;
}

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  email: string;
  isAdmin: boolean;
  createdAt: number;
  lastLogin?: number;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export interface Settings {
  key: string;
  value: string;
  updatedAt: number;
}

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    // Use DELETE mode instead of WAL for Docker compatibility
    // WAL requires shared memory files that may not work with bind mounts
    this.db.pragma('journal_mode = DELETE');
    this.initializeTables();
    logger.info(`Database initialized at ${dbPath}`);
  }

  private initializeTables(): void {
    // Admin users table (local authentication)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        is_admin INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_login INTEGER
      )
    `);

    // Plex users table (OAuth authenticated users)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plex_users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT,
        plex_token TEXT,
        plex_id TEXT UNIQUE,
        server_url TEXT,
        is_admin INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        last_login INTEGER
      )
    `);

    // Migration: Add server_url column if it doesn't exist
    const hasServerUrl = this.db.prepare(`
      SELECT COUNT(*) as count FROM pragma_table_info('plex_users') WHERE name='server_url'
    `).get() as { count: number };

    if (hasServerUrl.count === 0) {
      logger.info('Adding server_url column to plex_users table');
      this.db.exec('ALTER TABLE plex_users ADD COLUMN server_url TEXT');
    }

    // Migrate sessions table if it has the old FOREIGN KEY constraint
    // Check if sessions table exists with FOREIGN KEY
    const hasOldSchema = this.db.prepare(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='sessions' AND sql LIKE '%FOREIGN KEY%'
    `).get();

    if (hasOldSchema) {
      logger.info('Migrating sessions table to remove FOREIGN KEY constraint');
      // Drop old table and recreate without constraint
      this.db.exec('DROP TABLE IF EXISTS sessions');
    }

    // Sessions table (no FOREIGN KEY since we have both admin_users and plex_users)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Download logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS download_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        media_title TEXT NOT NULL,
        media_key TEXT NOT NULL,
        file_size INTEGER,
        downloaded_at INTEGER NOT NULL
      )
    `);

    logger.info('Database tables initialized');
  }

  // Admin user operations
  createAdminUser(user: Omit<AdminUser, 'id' | 'createdAt'>): AdminUser {
    const id = this.generateId();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, email, is_admin, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, user.username, user.passwordHash, user.email, user.isAdmin ? 1 : 0, createdAt);

    return { ...user, id, createdAt };
  }

  getAdminUserByUsername(username: string): AdminUser | undefined {
    const stmt = this.db.prepare('SELECT * FROM admin_users WHERE username = ?');
    const row = stmt.get(username) as any;
    return row ? this.mapAdminUser(row) : undefined;
  }

  getAdminUserById(id: string): AdminUser | undefined {
    const stmt = this.db.prepare('SELECT * FROM admin_users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapAdminUser(row) : undefined;
  }

  hasAdminUser(): boolean {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE is_admin = 1');
    const result = stmt.get() as { count: number };
    return result.count > 0;
  }

  updateAdminLastLogin(id: string): void {
    const stmt = this.db.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?');
    stmt.run(Date.now(), id);
  }

  // Plex user operations
  createOrUpdatePlexUser(plexUser: Omit<User, 'id' | 'createdAt' | 'isAdmin'>): User {
    const existing = this.getPlexUserByPlexId(plexUser.plexId!);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE plex_users
        SET username = ?, email = ?, plex_token = ?, server_url = ?, last_login = ?
        WHERE plex_id = ?
      `);
      stmt.run(plexUser.username, plexUser.email, plexUser.plexToken, plexUser.serverUrl, Date.now(), plexUser.plexId);
      return { ...existing, ...plexUser, lastLogin: Date.now() };
    }

    const id = this.generateId();
    const createdAt = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO plex_users (id, username, email, plex_token, plex_id, server_url, created_at, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, plexUser.username, plexUser.email, plexUser.plexToken, plexUser.plexId, plexUser.serverUrl, createdAt, createdAt);

    return { id, ...plexUser, isAdmin: false, createdAt, lastLogin: createdAt };
  }

  getPlexUserByPlexId(plexId: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM plex_users WHERE plex_id = ?');
    const row = stmt.get(plexId) as any;
    return row ? this.mapPlexUser(row) : undefined;
  }

  getPlexUserById(id: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM plex_users WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapPlexUser(row) : undefined;
  }

  // Session operations
  createSession(userId: string, expiresIn: number = 24 * 60 * 60 * 1000): Session {
    const id = this.generateId();
    const token = this.generateToken();
    const createdAt = Date.now();
    const expiresAt = createdAt + expiresIn;

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, token, expiresAt, createdAt);

    return { id, userId, token, expiresAt, createdAt };
  }

  getSessionByToken(token: string): Session | undefined {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE token = ? AND expires_at > ?');
    const row = stmt.get(token, Date.now()) as any;
    return row ? this.mapSession(row) : undefined;
  }

  deleteSession(token: string): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  }

  cleanupExpiredSessions(): void {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    const result = stmt.run(Date.now());
    if (result.changes > 0) {
      logger.info(`Cleaned up ${result.changes} expired sessions`);
    }
  }

  // Settings operations
  getSetting(key: string): string | undefined {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?
    `);
    const now = Date.now();
    stmt.run(key, value, now, value, now);
  }

  // Download logs
  logDownload(userId: string, mediaTitle: string, mediaKey: string, fileSize?: number): void {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO download_logs (id, user_id, media_title, media_key, file_size, downloaded_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, mediaTitle, mediaKey, fileSize, Date.now());
  }

  getDownloadHistory(userId: string, limit: number = 50): any[] {
    const stmt = this.db.prepare(`
      SELECT * FROM download_logs
      WHERE user_id = ?
      ORDER BY downloaded_at DESC
      LIMIT ?
    `);
    return stmt.all(userId, limit) as any[];
  }

  getAllDownloadHistory(limit: number = 100): any[] {
    const stmt = this.db.prepare(`
      SELECT dl.*,
             COALESCE(au.username, pu.username) as username
      FROM download_logs dl
      LEFT JOIN admin_users au ON dl.user_id = au.id
      LEFT JOIN plex_users pu ON dl.user_id = pu.id
      ORDER BY dl.downloaded_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as any[];
  }

  getDownloadStats(userId?: string): any {
    let query = 'SELECT COUNT(*) as count, SUM(file_size) as total_size FROM download_logs';
    const params: any[] = [];

    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }

    const stmt = this.db.prepare(query);
    return stmt.get(...params);
  }

  // Utility methods
  private mapAdminUser(row: any): AdminUser {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      email: row.email,
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
      lastLogin: row.last_login,
    };
  }

  private mapPlexUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      plexToken: row.plex_token,
      plexId: row.plex_id,
      serverUrl: row.server_url,
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
      lastLogin: row.last_login,
    };
  }

  private mapSession(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateToken(): string {
    return `${Math.random().toString(36).substr(2)}${Math.random().toString(36).substr(2)}${Date.now().toString(36)}`;
  }

  close(): void {
    this.db.close();
  }
}
