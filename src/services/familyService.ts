import * as familyRepo from '../db/repositories/familyRepo';
import * as memberRepo from '../db/repositories/memberRepo';
import { FamilyContext } from '../types/family';

export async function getFamilyContext(
  groupId: string,
  phone: string
): Promise<FamilyContext | null> {
  const family = await familyRepo.getFamilyByGroupId(groupId);
  if (!family) return null;

  const allMembers = await memberRepo.getMembersByFamilyId(family.id);
  const member = allMembers.find((m) => m.phone === phone);
  if (!member) return null;

  return { family, member, allMembers };
}

export async function getFamilyContextByPhone(
  phone: string
): Promise<FamilyContext | null> {
  const member = await memberRepo.getMemberByPhoneGlobal(phone);
  if (!member) return null;

  const family = await familyRepo.getFamilyById(member.familyId);
  if (!family) return null;

  const allMembers = await memberRepo.getMembersByFamilyId(family.id);
  return { family, member, allMembers };
}
