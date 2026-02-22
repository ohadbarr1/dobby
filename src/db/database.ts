import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import config from '../utils/config';
import logger from '../utils/logger';

let pool: Pool;

export async function initDb(): Promise<void> {
  pool = new Pool({ connectionString: config.DATABASE_URL });

  const client = await pool.connect();
  try {
    await runMigrations(client);
    logger.info('Database initialized');
  } finally {
    client.release();
  }
}

async function runMigrations(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      'SELECT 1 FROM _migrations WHERE name = $1',
      [file]
    );
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    logger.info(`Applied migration: ${file}`);
  }
}

export function getPool(): Pool {
  if (!pool) throw new Error('Database not initialized — call initDb() first');
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database pool closed');
  }
}
