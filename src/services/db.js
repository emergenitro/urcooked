import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(process.env.DB_DIR || './db');
const DB_PATH = path.join(DB_DIR, 'roasts.db');

let db;

export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS roasts (
      id           TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      roast_text   TEXT NOT NULL,
      preview_line TEXT NOT NULL,
      cooked_score INTEGER,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_username_created
      ON roasts (username, created_at DESC);

    CREATE TABLE IF NOT EXISTS battles (
      id           TEXT PRIMARY KEY,
      user1        TEXT NOT NULL,
      user2        TEXT NOT NULL,
      winner       TEXT,
      roast_text   TEXT NOT NULL,
      preview_line TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_battle_users
      ON battles (user1, user2, created_at DESC);
  `);

  try { db.exec('ALTER TABLE roasts ADD COLUMN cooked_score INTEGER'); } catch {}

  console.log(`[db] sqlite ready at ${DB_PATH}`);
  return db;
}

export function saveRoast({ id, username, roastText, previewLine, cookedScore }) {
  const stmt = db.prepare(`
    INSERT INTO roasts (id, username, roast_text, preview_line, cooked_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, username, roastText, previewLine, cookedScore ?? null, Date.now());
}

export function getRoast(id) {
  return db
    .prepare('SELECT * FROM roasts WHERE id = ?')
    .get(id);
}

/**
 * Find a recent roast for this username (case-insensitive) within the TTL.
 * Returns null if no fresh roast exists. Used as a cheap cache to avoid
 * re-roasting the same person every 5 seconds.
 */
export function findRecentByUsername(username, ttlMs = 60 * 60 * 1000) {
  const cutoff = Date.now() - ttlMs;
  return db
    .prepare(`
      SELECT * FROM roasts
      WHERE LOWER(username) = LOWER(?)
        AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(username, cutoff);
}

export function saveBattle({ id, user1, user2, winner, roastText, previewLine }) {
  db.prepare(`
    INSERT INTO battles (id, user1, user2, winner, roast_text, preview_line, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, user1, user2, winner ?? null, roastText, previewLine, Date.now());
}

export function getBattle(id) {
  return db.prepare('SELECT * FROM battles WHERE id = ?').get(id);
}

export function findRecentBattle(user1, user2, ttlMs = 30 * 60 * 1000) {
  const cutoff = Date.now() - ttlMs;
  const u1 = user1.toLowerCase();
  const u2 = user2.toLowerCase();
  return db
    .prepare(`
      SELECT * FROM battles
      WHERE (
        (LOWER(user1) = ? AND LOWER(user2) = ?) OR
        (LOWER(user1) = ? AND LOWER(user2) = ?)
      ) AND created_at >= ?
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(u1, u2, u2, u1, cutoff);
}
