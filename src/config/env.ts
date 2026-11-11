import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 chars'),

  FRONTEND_URL: z.string().default('http://localhost:3000'),
  ELECTRON_ORIGIN: z.string().default('file://'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().transform(v => v ? Number(v) : 587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('PMAV System <noreply@pmav.local>'),

  // YouTube
  YOUTUBE_DATA_CLIENT_ID: z.string(),
  YOUTUBE_DATA_CLIENT_SECRET: z.string(),
  YOUTUBE_DATA_REDIRECT_URI: z.string(),

  YOUTUBE_ANALYTICS_CLIENT_ID: z.string(),
  YOUTUBE_ANALYTICS_CLIENT_SECRET: z.string(),
  YOUTUBE_ANALYTICS_REDIRECT_URI: z.string(),

  YOUTUBE_REPORTING_CLIENT_ID: z.string(),
  YOUTUBE_REPORTING_CLIENT_SECRET: z.string(),
  YOUTUBE_REPORTING_REDIRECT_URI: z.string(),

  // Google (AdSense / GA / Search Console)
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_ADSENSE_REDIRECT_URI: z.string(),
  GOOGLE_ANALYTICS_REDIRECT_URI: z.string(),
  GOOGLE_SEARCH_CONSOLE_REDIRECT_URI: z.string(),

  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  AUTH_RATE_LIMIT_MAX: z.string().default('5').transform(Number),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/pmav-backend.log'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof EnvSchema>;
