import { parseIntent, SenderInfo } from '../ai/intentParser';
import { generateResponse } from '../ai/responseGenerator';
import { dispatch } from '../bot/dispatcher';
import { parseCommand, isFlowTrigger, handleModeToggle } from '../ai/commandParser';
import { getActiveFlow, startFlow, advanceFlow } from '../ai/menuFlow';
import { FamilyContext } from '../types/family';
import logger from '../utils/logger';

export async function handleMessage(ctx: FamilyContext, message: string): Promise<string> {
  const phone = ctx.member.phone;

  // 1. Check for active menu flow — advance it
  const activeFlow = getActiveFlow(phone);
  if (activeFlow) {
    const result = await advanceFlow(phone, message, ctx);
    if (result.intent) {
      // Flow completed with an intent — dispatch it
      const actionResult = await dispatch(result.intent, ctx);
      return generateResponse(result.intent, actionResult);
    }
    // Flow returned a prompt or message
    return result.response || 'שגיאה בתהליך. שלחו 7 לתפריט.';
  }

  // 2. Check for flow trigger commands ("4"/"תזכורת", "5"/"אירוע")
  const flowType = isFlowTrigger(message);
  if (flowType) {
    return startFlow(phone, flowType);
  }

  // 3. Try keyword-based command parser
  const commandIntent = parseCommand(message, ctx);
  if (commandIntent) {
    // Handle mode toggle side-effect
    const toggleMsg = await handleModeToggle(commandIntent, ctx);
    if (toggleMsg) return toggleMsg;

    // CHITCHAT replies directly
    if (commandIntent.intent === 'CHITCHAT') {
      return commandIntent.reply;
    }

    const result = await dispatch(commandIntent, ctx);
    return generateResponse(commandIntent, result);
  }

  // 4. If AI mode is enabled, fall through to LLM-based parsing
  if (ctx.family.aiMode) {
    const sender: SenderInfo = { name: ctx.member.name, phone: ctx.member.phone };
    const memberNames = ctx.allMembers.map((m) => m.name);

    const intent = await parseIntent(message, sender, memberNames, ctx.family.timezone);

    if (intent.intent === 'CHITCHAT') {
      return intent.reply;
    }

    const result = await dispatch(intent, ctx);
    return generateResponse(intent, result);
  }

  // 5. Non-AI mode, no match — show fallback
  return 'לא הבנתי. שלחו 7 לתפריט';
}
