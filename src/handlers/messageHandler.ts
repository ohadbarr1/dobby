import { parseIntent, SenderInfo } from '../ai/intentParser';
import { generateResponse } from '../ai/responseGenerator';
import { dispatch } from '../bot/dispatcher';
import config from '../utils/config';
import logger from '../utils/logger';

function getSender(phone: string): SenderInfo | null {
  if (phone === config.USER1_PHONE) {
    return { name: config.USER1_NAME, phone };
  }
  if (phone === config.USER2_PHONE) {
    return { name: config.USER2_NAME, phone };
  }
  return null;
}

export async function handleMessage(phone: string, message: string): Promise<string> {
  const sender = getSender(phone);
  if (!sender) {
    logger.warn(`Message from unknown phone: ${phone}`);
    return '';
  }

  const intent = await parseIntent(message, sender);

  // CHITCHAT replies directly — no dispatch needed
  if (intent.intent === 'CHITCHAT') {
    return intent.reply;
  }

  const result = await dispatch(intent, sender);
  return generateResponse(intent, result);
}
