import { createApp } from './app.js';
import { database } from './config/database.js';
import { env } from './config/env.js';

try {
  await database.authenticate();
  await database.query('SELECT id FROM system_locks LIMIT 1');
  const server = createApp().listen(env.API_PORT, env.API_HOST, () => {
    console.info(`CDP Lite API: http://${env.API_HOST}:${env.API_PORT}/api/v1（本地演示管理员模式）`);
  });
  const shutdown = () => {
    server.close(() => { void database.close().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
} catch (error) {
  console.error('API 启动失败，请检查 MySQL 配置并执行 pnpm db:migrate。', error instanceof Error ? error.message : error);
  await database.close();
  process.exitCode = 1;
}
