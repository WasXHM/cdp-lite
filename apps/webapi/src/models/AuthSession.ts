import { DataTypes } from 'sequelize';
import { baseColumns, defineModel, foreignKey } from './common.js';

export const authSessionColumns = {
  id: baseColumns.id,
  userId: { ...foreignKey('users', 'user_id'), onDelete: 'CASCADE' },
  tokenHash: { type: DataTypes.CHAR(64), allowNull: false, field: 'token_hash' },
  expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
  createdAt: baseColumns.createdAt,
  updatedAt: baseColumns.updatedAt,
};

export const AuthSessionModel = defineModel('AuthSession', 'auth_sessions', authSessionColumns);
