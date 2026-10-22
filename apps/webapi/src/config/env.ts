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
});
export const env = envSchema.parse(process.env);
