import { DataTypes } from 'sequelize';
import { baseColumns, defineModel } from './common.js';

export const userColumns = {
  id: baseColumns.id,
  username: { type: DataTypes.STRING(64), allowNull: false },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false, field: 'password_hash' },
  displayName: { type: DataTypes.STRING(100), allowNull: false, field: 'display_name' },
  role: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'USER' },
  status: baseColumns.status,
  createdAt: baseColumns.createdAt,
  updatedAt: baseColumns.updatedAt,
};

export const UserModel = defineModel('User', 'users', userColumns);
