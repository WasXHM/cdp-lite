import { database } from '../config/database.js';
import { setAdminUser } from '../services/auth.js';

try {
  await database.authenticate();
  const user = await setAdminUser({
    username: process.env.AUTH_ADMIN_USERNAME || 'admin',
    password: process.env.AUTH_ADMIN_PASSWORD || '',
    displayName: process.env.AUTH_ADMIN_DISPLAY_NAME || '系统管理员',
  });
  console.info(`管理员账号已创建或重置：${user.username}`);
} catch (error) {
  console.error('管理员账号创建失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await database.close();
}
