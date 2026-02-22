import { getPool } from '../database';

export interface OpenTask {
  content: string;
  due: string | null;
}

export async function addTask(familyId: number, content: string, dueDate?: string): Promise<number> {
  const { rows } = await getPool().query(
    'INSERT INTO tasks (family_id, content, due_date) VALUES ($1, $2, $3) RETURNING id',
    [familyId, content, dueDate || null]
  );
  return rows[0].id;
}

export async function getOpenTasks(familyId: number): Promise<OpenTask[]> {
  const { rows } = await getPool().query(
    `SELECT content, due_date FROM tasks
     WHERE family_id = $1 AND completed = false
     ORDER BY COALESCE(due_date, '9999-12-31'::timestamptz), created_at`,
    [familyId]
  );
  return rows.map((r) => ({
    content: r.content,
    due: r.due_date ? new Date(r.due_date).toISOString().split('T')[0] : null,
  }));
}

export async function completeTask(familyId: number, content: string): Promise<boolean> {
  const { rowCount } = await getPool().query(
    `UPDATE tasks SET completed = true, completed_at = NOW()
     WHERE family_id = $1 AND LOWER(content) = LOWER($2) AND completed = false`,
    [familyId, content]
  );
  return (rowCount ?? 0) > 0;
}
