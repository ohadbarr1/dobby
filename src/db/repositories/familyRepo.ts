import { getPool } from '../database';
import { Family } from '../../types/family';

function rowToFamily(row: any): Family {
  return {
    id: row.id,
    name: row.name,
    whatsappGroupId: row.whatsapp_group_id,
    timezone: row.timezone,
    briefingHour: row.briefing_hour,
    briefingMinute: row.briefing_minute,
    aiMode: row.ai_mode,
    createdAt: row.created_at,
  };
}

export async function getFamilyByGroupId(groupId: string): Promise<Family | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM families WHERE whatsapp_group_id = $1',
    [groupId]
  );
  return rows.length > 0 ? rowToFamily(rows[0]) : null;
}

export async function getAllFamilies(): Promise<Family[]> {
  const { rows } = await getPool().query('SELECT * FROM families');
  return rows.map(rowToFamily);
}

export async function createFamily(data: {
  name: string;
  whatsappGroupId: string;
  timezone?: string;
}): Promise<Family> {
  const { rows } = await getPool().query(
    `INSERT INTO families (name, whatsapp_group_id, timezone)
     VALUES ($1, $2, $3) RETURNING *`,
    [data.name, data.whatsappGroupId, data.timezone || 'Asia/Jerusalem']
  );
  return rowToFamily(rows[0]);
}

export async function updateFamily(
  id: number,
  data: Partial<{ name: string; timezone: string; briefingHour: number; briefingMinute: number; aiMode: boolean }>
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.name !== undefined) { sets.push(`name = $${idx++}`); values.push(data.name); }
  if (data.timezone !== undefined) { sets.push(`timezone = $${idx++}`); values.push(data.timezone); }
  if (data.briefingHour !== undefined) { sets.push(`briefing_hour = $${idx++}`); values.push(data.briefingHour); }
  if (data.briefingMinute !== undefined) { sets.push(`briefing_minute = $${idx++}`); values.push(data.briefingMinute); }
  if (data.aiMode !== undefined) { sets.push(`ai_mode = $${idx++}`); values.push(data.aiMode); }

  if (sets.length === 0) return;
  values.push(id);
  await getPool().query(`UPDATE families SET ${sets.join(', ')} WHERE id = $${idx}`, values);
}
