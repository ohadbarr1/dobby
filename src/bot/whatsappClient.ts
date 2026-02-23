import { Client, LocalAuth, Message, MessageMedia } from 'whatsapp-web.js';
import path from 'path';
import fs from 'fs';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
import { handleMessage } from '../handlers/messageHandler';
import { getFamilyContext, getFamilyContextByPhone } from '../services/familyService';
import { handleOnboarding } from '../handlers/onboardingHandler';
import logger from '../utils/logger';

let client: Client;
const botMessageIds = new Set<string>();
const processingChats = new Set<string>();

export function getClient(): Client {
  if (!client) throw new Error('WhatsApp client not initialized');
  return client;
}

export async function sendToGroup(groupId: string, text: string): Promise<void> {
  const sent = await getClient().sendMessage(groupId, text);
  botMessageIds.add(sent.id._serialized);
  setTimeout(() => botMessageIds.delete(sent.id._serialized), 30_000);
}

export async function destroyClient(): Promise<void> {
  if (client) {
    await client.destroy();
    logger.info('WhatsApp client destroyed');
  }
}

export async function startBot(): Promise<void> {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    logger.info('Scan the QR code below with WhatsApp:');
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    logger.info('WhatsApp authenticated');
  });

  client.on('ready', async () => {
    logger.info('\u{2705} WhatsApp client is ready');

    // Set Dobby's WhatsApp profile
    try {
      await client.setDisplayName('Dobby \u{1F9E6}');
      await client.setStatus('\u{1F9E6} \u05D3\u05D5\u05D1\u05D9 - \u05D4\u05E2\u05D5\u05D6\u05E8 \u05D4\u05DE\u05E9\u05E4\u05D7\u05EA\u05D9 | \u05E9\u05DC\u05D7\u05D5 7 \u05DC\u05EA\u05E4\u05E8\u05D9\u05D8');

      const picPath = path.resolve('assets/dobby-profile.png');
      if (fs.existsSync(picPath)) {
        const media = MessageMedia.fromFilePath(picPath);
        await client.setProfilePicture(media);
        logger.info('Dobby profile picture set');
      }
    } catch (err) {
      logger.warn(`Failed to set Dobby profile: ${(err as Error).message}`);
    }
  });

  client.on('auth_failure', (msg) => {
    logger.error(`WhatsApp auth failure: ${msg}`);
  });

  client.on('disconnected', (reason) => {
    logger.warn(`WhatsApp disconnected: ${reason}`);
  });

  // Handle incoming messages from others (DMs and groups)
  client.on('message', async (msg: Message) => {
    try {
      await processMessage(msg);
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
    }
  });

  // Handle messages sent by the bot's own WhatsApp account (for group self-messages)
  client.on('message_create', async (msg: Message) => {
    try {
      if (!msg.fromMe) return; // Already handled by 'message' event
      if (botMessageIds.has(msg.id._serialized)) return; // Bot reply — skip

      await processMessage(msg);
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
    }
  });

  await client.initialize();
}

async function processMessage(msg: Message): Promise<void> {
  const chat = await msg.getChat();
  const chatId = chat.id._serialized;

  // Prevent re-entry: if we're already processing a message in this chat, skip
  if (processingChats.has(chatId)) return;
  processingChats.add(chatId);

  try {
    // Determine sender phone
    let phone: string;
    if (msg.fromMe) {
      phone = client.info.wid.user;
    } else {
      phone = (await msg.getContact()).number;
    }

    // Look up family and member from the database
    const isGroup = chat.isGroup;
    const ctx = isGroup
      ? await getFamilyContext(chatId, phone)
      : await getFamilyContextByPhone(phone);
    if (!ctx) {
      // Not a registered family/member — try onboarding flow
      if (isGroup) {
        const reply = await handleOnboarding(chatId, phone, msg.body, chat.name || '');
        if (reply) {
          const sent = await msg.reply(reply);
          botMessageIds.add(sent.id._serialized);
          setTimeout(() => botMessageIds.delete(sent.id._serialized), 30_000);
        }
      }
      return;
    }

    logger.info(`[${ctx.family.name}/${ctx.member.name}] ${msg.body}`);

    const response = await handleMessage(ctx, msg.body);
    if (response) {
      const sent = isGroup
        ? await msg.reply(response)
        : await client.sendMessage(chatId, response);
      botMessageIds.add(sent.id._serialized);
      setTimeout(() => botMessageIds.delete(sent.id._serialized), 30_000);
    }
  } finally {
    processingChats.delete(chatId);
  }
}
