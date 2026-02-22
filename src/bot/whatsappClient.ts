import { Client, LocalAuth, Message } from 'whatsapp-web.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
import { handleMessage } from '../handlers/messageHandler';
import config from '../utils/config';
import logger from '../utils/logger';

let client: Client;
const botMessageIds = new Set<string>(); // track messages sent by the bot

export function getClient(): Client {
  if (!client) throw new Error('WhatsApp client not initialized');
  return client;
}

export async function sendToGroup(text: string): Promise<void> {
  const sent = await getClient().sendMessage(config.WHATSAPP_GROUP_ID, text);
  botMessageIds.add(sent.id._serialized);
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

  client.on('ready', () => {
    logger.info('✅ WhatsApp client is ready');
  });

  client.on('auth_failure', (msg) => {
    logger.error(`WhatsApp auth failure: ${msg}`);
  });

  client.on('disconnected', (reason) => {
    logger.warn(`WhatsApp disconnected: ${reason}`);
  });

  client.on('message_create', async (msg: Message) => {
    try {
      const chat = await msg.getChat();
      if (chat.id._serialized !== config.WHATSAPP_GROUP_ID) return;

      // Skip messages the bot itself sent (prevents loops)
      if (botMessageIds.has(msg.id._serialized)) return;

      // For own messages use USER1_PHONE, for others get from contact
      const phone = msg.fromMe
        ? config.USER1_PHONE
        : (await msg.getContact()).number;

      logger.info(`[${phone}${msg.fromMe ? ' (me)' : ''}] ${msg.body}`);

      const response = await handleMessage(phone, msg.body);
      if (response) {
        const sent = await msg.reply(response);
        botMessageIds.add(sent.id._serialized);
        // Clean up old IDs to prevent memory leak
        if (botMessageIds.size > 1000) botMessageIds.clear();
      }
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
    }
  });

  await client.initialize();
}
