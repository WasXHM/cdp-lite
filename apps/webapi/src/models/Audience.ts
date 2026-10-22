import { DataTypes } from 'sequelize';
import { baseColumns, defineModel } from './common.js';

export const audienceColumns = {
  ...baseColumns, audienceCode: { type: DataTypes.STRING(64), allowNull: false, field: 'audience_code' },
  rules: { type: DataTypes.JSON, allowNull: false, field: 'rules_json' },
  schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
};
export const AudienceModel = defineModel('Audience', 'audiences', audienceColumns);
