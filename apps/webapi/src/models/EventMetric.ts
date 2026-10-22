import { DataTypes } from 'sequelize';
import { baseColumns, defineModel, foreignKey } from './common.js';

export const metricColumns = {
  ...baseColumns, eventModelId: foreignKey('event_models', 'event_model_id'),
  fieldName: { type: DataTypes.STRING(64), allowNull: false, field: 'field_name' },
  dataType: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'Number', field: 'data_type' },
};
export const EventMetricModel = defineModel('EventMetric', 'event_metrics', metricColumns);
