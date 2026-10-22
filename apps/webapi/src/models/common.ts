import { DataTypes, Model, type ModelAttributes } from 'sequelize';
import { database } from '../config/database.js';

export type Row = { id: string; [key: string]: unknown };
export const baseColumns = {
  id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.STRING(1000), allowNull: false, defaultValue: '' },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ENABLED' },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
  updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
};
export const fieldColumns = {
  ...baseColumns,
  fieldName: { type: DataTypes.STRING(64), allowNull: false, field: 'field_name' },
  dataType: { type: DataTypes.STRING(20), allowNull: false, field: 'data_type' },
  displayType: { type: DataTypes.STRING(20), allowNull: false, field: 'display_type' },
  isEnum: { type: DataTypes.BOOLEAN, allowNull: false, field: 'is_enum' },
};
export const valueColumns = {
  id: baseColumns.id, label: { type: DataTypes.STRING(100), allowNull: false },
  value: { type: DataTypes.STRING(100), allowNull: false },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
  status: baseColumns.status, createdAt: baseColumns.createdAt, updatedAt: baseColumns.updatedAt,
};
export function foreignKey(table: string, field: string) {
  return { type: DataTypes.UUID, allowNull: false, field, references: { model: table, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'RESTRICT' };
}
export function defineModel(name: string, tableName: string, columns: ModelAttributes) {
  return database.define<Model<Row>>(name, columns, { tableName });
}
