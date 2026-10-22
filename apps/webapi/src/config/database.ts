import { Sequelize } from 'sequelize';
import { env } from './env.js';

export const database = new Sequelize(env.DATABASE_NAME, env.DATABASE_USER, env.DATABASE_PASSWORD, {
  dialect: 'mysql', host: env.DATABASE_HOST, port: env.DATABASE_PORT, timezone: '+00:00',
  logging: false, define: { underscored: true, charset: 'utf8mb4', collate: 'utf8mb4_bin' },
  pool: { max: 5, min: 0, acquire: 15000 },
});
