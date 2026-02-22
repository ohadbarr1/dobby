import { Client, LocalAuth, Message } from 'whatsapp-web.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
import { handleMessage } from '../handlers/messageHandler';
import { getFamilyContext } from '../services/familyService';
import logger from '../utils/logger';

let client: Client;
const botMessageIds = new Set<string>();

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
      // Skip messages the bot itself sent
      if (botMessageIds.has(msg.id._serialized)) return;

      const chat = await msg.getChat();
      const groupId = chat.id._serialized;

      // Determine sender phone
      let phone: string;
      if (msg.fromMe) {
        // The human whose WhatsApp session the bot runs on
        phone = client.info.wid.user;
      } else {
        phone = (await msg.getContact()).number;
      }

      // Look up family and member from the database
      const ctx = await getFamilyContext(groupId, phone);
      if (!ctx) return; // Not a registered family/member — ignore

      logger.info(`[${ctx.family.name}/${ctx.member.name}] ${msg.body}`);

      const response = await handleMessage(ctx, msg.body);
      if (response) {
        const sent = await msg.reply(response);
        botMessageIds.add(sent.id._serialized);
        setTimeout(() => botMessageIds.delete(sent.id._serialized), 30_000);
      }
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
    }
  });

  await client.initialize();
}
