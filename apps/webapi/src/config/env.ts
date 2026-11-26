import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')] });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_HOST: z.literal('127.0.0.1').default('127.0.0.1'),
  DATABASE_HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_PORT: z.coerce.number().int().positive().default(3306),
  DATABASE_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/).default('cdp_lite'),
  DATABASE_USER: z.string().min(1).default('cdp_lite'),
  DATABASE_PASSWORD: z.string().default('change_me'),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  AUTH_LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),
  AI_RULE_GENERATION_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  AI_PROVIDER: z.enum(['disabled', 'openai-compatible']).default('disabled'),
  AI_MODEL: z.string().default(''),
  AI_API_KEY: z.string().default(''),
  AI_BASE_URL: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(256).max(16000).default(3000),
  AI_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(1000).default(10),
  AI_MAX_CONCURRENT: z.coerce.number().int().min(1).max(20).default(2),
  AI_DERIVATION_DENY_FIELD_NAMES: z.string().default('gender,age,city'),
});
export const env = envSchema.parse(process.env);
