import { database } from '../config/database.js';
import { up as initial } from './001-initial.js';
import { up as auth } from './002-auth.js';
import { up as userRoles } from './003-user-roles.js';

const migrations = [
  ['001-initial', initial],
  ['002-auth', auth],
  ['003-user-roles', userRoles],
] as const;

export async function migrate() {
  await database.authenticate();
  await database.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME NOT NULL)');
  for (const [name, up] of migrations) {
    const [rows] = await database.query('SELECT name FROM schema_migrations WHERE name = ?', { replacements: [name] });
    if (rows.length > 0) continue;
    await up(database.getQueryInterface());
    await database.query('INSERT INTO schema_migrations (name, applied_at) VALUES (?, UTC_TIMESTAMP())', { replacements: [name] });
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
