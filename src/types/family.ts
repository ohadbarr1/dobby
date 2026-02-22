export interface Family {
  id: number;
  name: string;
  whatsappGroupId: string;
  timezone: string;
  briefingHour: number;
  briefingMinute: number;
  aiMode: boolean;
  createdAt: Date;
}

export interface FamilyMember {
  id: number;
  familyId: number;
  name: string;
  phone: string;
  googleRefreshToken: string | null;
  googleCalendarId: string | null;
  role: 'admin' | 'member';
  createdAt: Date;
}

export interface FamilyContext {
  family: Family;
  member: FamilyMember;
  allMembers: FamilyMember[];
}
