import dotenv from 'dotenv';
dotenv.config();

interface Config {
  WHATSAPP_GROUP_ID: string;
  USER1_NAME: string;
  USER1_PHONE: string;
  USER2_NAME: string;
  USER2_PHONE: string;
  GROQ_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN_USER1: string;
  GOOGLE_CALENDAR_ID_USER1: string;
  GOOGLE_REFRESH_TOKEN_USER2: string;
  GOOGLE_CALENDAR_ID_USER2: string;
  BRIEFING_HOUR: string;
  BRIEFING_MINUTE: string;
  TIMEZONE: string;
}

const REQUIRED_KEYS: (keyof Config)[] = [
  'WHATSAPP_GROUP_ID',
  'USER1_NAME',
  'USER1_PHONE',
  'USER2_NAME',
  'USER2_PHONE',
  'GROQ_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN_USER1',
  'GOOGLE_CALENDAR_ID_USER1',
  'GOOGLE_REFRESH_TOKEN_USER2',
  'GOOGLE_CALENDAR_ID_USER2',
  'BRIEFING_HOUR',
  'BRIEFING_MINUTE',
  'TIMEZONE',
];

function loadConfig(): Config {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables:\n  ${missing.join('\n  ')}`);
  }

  return REQUIRED_KEYS.reduce((cfg, key) => {
    cfg[key] = process.env[key] as string;
    return cfg;
  }, {} as Config);
}

const config = loadConfig();

export default config;
