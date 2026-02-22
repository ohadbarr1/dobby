import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { handleMessage } from '../handlers/messageHandler';
import config from '../utils/config';
import logger from '../utils/logger';

let client: Client;

export function getClient(): Client {
  if (!client) throw new Error('WhatsApp client not initialized');
  return client;
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

  client.on('message', async (msg: Message) => {
    try {
      if (msg.from !== config.WHATSAPP_GROUP_ID) return;
      if (msg.fromMe) return;

      const contact = await msg.getContact();
      const phone = contact.number;
      logger.info(`[${phone}] ${msg.body}`);

      const response = await handleMessage(phone, msg.body);
      if (response) await msg.reply(response);
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
    }
  });

  await client.initialize();
}
