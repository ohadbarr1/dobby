import dotenv from 'dotenv';
dotenv.config();

export interface GlobalConfig {
  DATABASE_URL: string;
  GROQ_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  LOG_LEVEL: string;
  NODE_ENV: string;
}

const REQUIRED_KEYS: (keyof GlobalConfig)[] = [
  'DATABASE_URL',
  'GROQ_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

function loadConfig(): GlobalConfig {
  const missing = REQUIRED_KEYS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables:\n  ${missing.join('\n  ')}`);
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    GROQ_API_KEY: process.env.GROQ_API_KEY!,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };
}

const config = loadConfig();

export default config;
