import { type ModelAttributes, type QueryInterface } from 'sequelize';
import { userColumns } from '../models/User.js';
import { authSessionColumns } from '../models/AuthSession.js';

function columns(attributes: ModelAttributes) {
  return Object.fromEntries(Object.entries(attributes).map(([key, attribute]) => {
    const definition = typeof attribute === 'object' && 'type' in attribute ? attribute : { type: attribute };
    return [definition.field || key, definition];
  }));
}

export async function up(query: QueryInterface) {
  await query.createTable('users', columns(userColumns), { charset: 'utf8mb4', collate: 'utf8mb4_bin' });
  await query.addIndex('users', ['username'], { unique: true, name: 'users_username_unique' });

  await query.createTable('auth_sessions', columns(authSessionColumns), { charset: 'utf8mb4', collate: 'utf8mb4_bin' });
  await query.addIndex('auth_sessions', ['token_hash'], { unique: true, name: 'auth_sessions_token_unique' });
  await query.addIndex('auth_sessions', ['user_id'], { name: 'auth_sessions_user' });
  await query.addIndex('auth_sessions', ['expires_at'], { name: 'auth_sessions_expiry' });
}
