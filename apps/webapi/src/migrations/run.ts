import { database } from '../config/database.js';
import { up } from './001-initial.js';

export async function migrate() {
  await database.authenticate();
  await database.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL)');
  const [rows] = await database.query("SELECT name FROM schema_migrations WHERE name = '001-initial'");
  if (rows.length === 0) {
    await up(database.getQueryInterface());
    await database.query("INSERT INTO schema_migrations (name, applied_at) VALUES ('001-initial', UTC_TIMESTAMP())");
  }
}
if (process.argv[1]?.endsWith('/run.ts')) {
  try {
    await migrate();
    console.info('数据库迁移完成');
  } catch (error) {
    console.error('数据库迁移失败：', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally { await database.close(); }
}
