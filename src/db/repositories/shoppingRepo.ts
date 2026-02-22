import { getPool } from '../database';

export async function addItems(familyId: number, items: string[]): Promise<void> {
  const pool = getPool();
  for (const item of items) {
    await pool.query(
      'INSERT INTO shopping_items (family_id, name) VALUES ($1, $2)',
      [familyId, item]
    );
  }
}

export async function completeItems(familyId: number, items: string[]): Promise<number> {
  let completed = 0;
  const pool = getPool();
  for (const item of items) {
    const { rowCount } = await pool.query(
      `UPDATE shopping_items
       SET completed = true, completed_at = NOW()
       WHERE family_id = $1 AND LOWER(name) = LOWER($2) AND completed = false`,
      [familyId, item]
    );
    if (rowCount && rowCount > 0) completed++;
  }
  return completed;
}

export async function getActiveItems(familyId: number): Promise<string[]> {
  const { rows } = await getPool().query(
    'SELECT name FROM shopping_items WHERE family_id = $1 AND completed = false ORDER BY created_at',
    [familyId]
  );
  return rows.map((r) => r.name);
}
