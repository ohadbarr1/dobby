import { getPool } from '../database';
import { FamilyMember } from '../../types/family';

function rowToMember(row: any): FamilyMember {
  return {
    id: row.id,
    familyId: row.family_id,
    name: row.name,
    phone: row.phone,
    googleRefreshToken: row.google_refresh_token,
    googleCalendarId: row.google_calendar_id,
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function getMemberByPhone(familyId: number, phone: string): Promise<FamilyMember | null> {
  const { rows } = await getPool().query(
    'SELECT * FROM family_members WHERE family_id = $1 AND phone = $2',
    [familyId, phone]
  );
  return rows.length > 0 ? rowToMember(rows[0]) : null;
}

export async function getMembersByFamilyId(familyId: number): Promise<FamilyMember[]> {
  const { rows } = await getPool().query(
    'SELECT * FROM family_members WHERE family_id = $1 ORDER BY created_at',
    [familyId]
  );
  return rows.map(rowToMember);
}

export async function createMember(data: {
  familyId: number;
  name: string;
  phone: string;
  role?: 'admin' | 'member';
}): Promise<FamilyMember> {
  const { rows } = await getPool().query(
    `INSERT INTO family_members (family_id, name, phone, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.familyId, data.name, data.phone, data.role || 'member']
  );
  return rowToMember(rows[0]);
}

export async function updateMemberCalendar(
  memberId: number,
  refreshToken: string,
  calendarId: string
): Promise<void> {
  await getPool().query(
    'UPDATE family_members SET google_refresh_token = $1, google_calendar_id = $2 WHERE id = $3',
    [refreshToken, calendarId, memberId]
  );
}
