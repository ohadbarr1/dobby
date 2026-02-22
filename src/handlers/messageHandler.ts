import { parseIntent, SenderInfo } from '../ai/intentParser';
import { generateResponse } from '../ai/responseGenerator';
import { dispatch } from '../bot/dispatcher';
import { FamilyContext } from '../types/family';
import logger from '../utils/logger';

export async function handleMessage(ctx: FamilyContext, message: string): Promise<string> {
  const sender: SenderInfo = { name: ctx.member.name, phone: ctx.member.phone };
  const memberNames = ctx.allMembers.map((m) => m.name);

  const intent = await parseIntent(message, sender, memberNames, ctx.family.timezone);

  // CHITCHAT replies directly — no dispatch needed
  if (intent.intent === 'CHITCHAT') {
    return intent.reply;
  }

  const result = await dispatch(intent, ctx);
  return generateResponse(intent, result);
}
