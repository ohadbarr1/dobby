import Database from 'better-sqlite3';
import path from 'path';
import logger from '../utils/logger';

const DB_PATH = path.join('data', 'dobby.db');

let db: Database.Database;

export function initDb(): void {
  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      for_whom    TEXT    NOT NULL,
      datetime    TEXT    NOT NULL,
      message     TEXT    NOT NULL,
      sent        INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  logger.info('Database initialized');
}

function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDb() first');
  return db;
}

export interface Reminder {
  id: number;
  for_whom: string;
  datetime: string;
  message: string;
  sent: number;
  created_at: string;
}

export function addReminder(forWhom: string, datetime: string, message: string): number {
  const result = getDb()
    .prepare('INSERT INTO reminders (for_whom, datetime, message) VALUES (?, ?, ?)')
    .run(forWhom, datetime, message);
  return result.lastInsertRowid as number;
}

export function getPendingReminders(): Reminder[] {
  return getDb()
    .prepare("SELECT * FROM reminders WHERE sent = 0 AND datetime <= datetime('now') ORDER BY datetime")
    .all() as Reminder[];
}

export function markReminderSent(id: number): void {
  getDb().prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(id);
}
