import { getPool } from '../database';

export interface Reminder {
  id: number;
  familyId: number;
  forWhom: string;
  datetime: Date;
  message: string;
  sent: boolean;
  createdAt: Date;
}

export interface PendingReminder extends Reminder {
  whatsappGroupId: string;
}

export async function addReminder(
  familyId: number,
  forWhom: string,
  datetime: string,
  message: string
): Promise<number> {
  const { rows } = await getPool().query(
    `INSERT INTO reminders (family_id, for_whom, datetime, message)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [familyId, forWhom, datetime, message]
  );
  return rows[0].id;
}

export async function getPendingReminders(): Promise<PendingReminder[]> {
  const { rows } = await getPool().query(
    `SELECT r.*, f.whatsapp_group_id
     FROM reminders r
     JOIN families f ON f.id = r.family_id
     WHERE r.sent = false AND r.datetime <= NOW()
     ORDER BY r.datetime`
  );
  return rows.map((row) => ({
    id: row.id,
    familyId: row.family_id,
    forWhom: row.for_whom,
    datetime: row.datetime,
    message: row.message,
    sent: row.sent,
    createdAt: row.created_at,
    whatsappGroupId: row.whatsapp_group_id,
  }));
}

export async function markReminderSent(id: number): Promise<void> {
  await getPool().query('UPDATE reminders SET sent = true WHERE id = $1', [id]);
}
