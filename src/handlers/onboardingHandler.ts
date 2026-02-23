import * as familyRepo from '../db/repositories/familyRepo';
import * as memberRepo from '../db/repositories/memberRepo';
import logger from '../utils/logger';

const REGISTER_PHRASES = ['הוסף את דובי', 'הוסיפו את דובי', 'דובי'];
const JOIN_PHRASES = ['אני פה', 'אני כאן'];

/**
 * Handle messages from unregistered groups/members.
 * Returns a reply string if handled, or null to silently ignore.
 */
export async function handleOnboarding(
  groupId: string,
  phone: string,
  message: string,
  groupName: string
): Promise<string | null> {
  const trimmed = message.trim();

  const family = await familyRepo.getFamilyByGroupId(groupId);

  if (family) {
    // Group is registered but sender is not a member — check for join phrase
    if (JOIN_PHRASES.some((p) => trimmed === p)) {
      const existing = await memberRepo.getMemberByPhone(family.id, phone);
      if (existing) {
        return `${existing.name}, כבר רשומים במשפחה! \u{1F44D}`;
      }

      const contact = await getContactName(phone);
      const member = await memberRepo.createMember({
        familyId: family.id,
        name: contact,
        phone,
      });
      logger.info(`New member "${member.name}" joined family ${family.id}`);
      return `\u{1F389} ברוכים הבאים! הוספתי את ${member.name} למשפחה.`;
    }

    return null;
  }

  // Group is not registered — check for registration phrase
  if (REGISTER_PHRASES.some((p) => trimmed === p)) {
    const newFamily = await familyRepo.createFamily({
      name: groupName || `משפחה ${phone}`,
      whatsappGroupId: groupId,
    });

    const contact = await getContactName(phone);
    await memberRepo.createMember({
      familyId: newFamily.id,
      name: contact,
      phone,
      role: 'admin',
    });

    logger.info(`New family "${newFamily.name}" registered by ${contact} (${phone})`);
    return `\u{1F9E6} שלום! אני דובי, העוזר המשפחתי שלכם! נרשמתם בהצלחה.\n\n\u{1F465} כדי להוסיף בני משפחה, בקשו מהם לשלוח: "אני פה" בקבוצה.\n\n\u{2753} לתפריט מלא שלחו: 7 או "עזרה"`;
  }

  return null;
}

/** Extract a display name from a phone number (placeholder — uses phone as name) */
function getContactName(phone: string): Promise<string> {
  // WhatsApp contact names aren't reliably available here.
  // Use the phone number as a placeholder — users can update via API later.
  return Promise.resolve(phone);
}
