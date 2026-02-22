import { Client, LocalAuth, Message } from 'whatsapp-web.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
import { handleMessage } from '../handlers/messageHandler';
import config from '../utils/config';
import logger from '../utils/logger';

let client: Client;
let botReplyInProgress = false; // prevents loop: bot reply → triggers message_create → bot replies again

export function getClient(): Client {
  if (!client) throw new Error('WhatsApp client not initialized');
  return client;
}

export async function sendToGroup(text: string): Promise<void> {
  botReplyInProgress = true;
  try {
    await getClient().sendMessage(config.WHATSAPP_GROUP_ID, text);
  } finally {
    setTimeout(() => { botReplyInProgress = false; }, 2000);
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

  client.on('ready', () => {
    logger.info('\u{2705} WhatsApp client is ready');
  });

  client.on('auth_failure', (msg) => {
    logger.error(`WhatsApp auth failure: ${msg}`);
  });

  client.on('disconnected', (reason) => {
    logger.warn(`WhatsApp disconnected: ${reason}`);
  });

  client.on('message_create', async (msg: Message) => {
    try {
      // Skip if the bot is currently sending a reply
      if (botReplyInProgress) return;

      const chat = await msg.getChat();
      if (chat.id._serialized !== config.WHATSAPP_GROUP_ID) return;

      // For own messages use USER1_PHONE, for others get from contact
      const phone = msg.fromMe
        ? config.USER1_PHONE
        : (await msg.getContact()).number;

      logger.info(`[${phone}${msg.fromMe ? ' (me)' : ''}] ${msg.body}`);

      const response = await handleMessage(phone, msg.body);
      if (response) {
        botReplyInProgress = true;
        try {
          await msg.reply(response);
        } finally {
          // Keep the flag on for 2 seconds so the bot's reply message_create event is ignored
          setTimeout(() => { botReplyInProgress = false; }, 2000);
        }
      }
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
    }
  });

  await client.initialize();
}
