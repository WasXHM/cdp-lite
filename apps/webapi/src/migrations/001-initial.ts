import { DataTypes, type ModelAttributes, type QueryInterface } from 'sequelize';
import { metadataColumns } from '../models/Metadata.js';
import { metadataValueColumns } from '../models/MetadataEnumValue.js';
import { eventColumns } from '../models/EventModel.js';
import { dimensionColumns } from '../models/EventDimension.js';
import { dimensionValueColumns } from '../models/EventDimensionValue.js';
import { metricColumns } from '../models/EventMetric.js';
import { audienceColumns } from '../models/Audience.js';

const tables: [string, ModelAttributes, string[]][] = [
  ['metadata', metadataColumns, ['metadata_type', 'field_name']],
  ['metadata_enum_values', metadataValueColumns, ['metadata_id', 'value']],
  ['event_models', eventColumns, ['event_code']],
  ['event_dimensions', dimensionColumns, ['event_model_id', 'field_name']],
  ['event_dimension_values', dimensionValueColumns, ['dimension_id', 'value']],
  ['event_metrics', metricColumns, ['event_model_id', 'field_name']],
  ['audiences', audienceColumns, ['audience_code']],
];
export async function up(query: QueryInterface) {
  for (const [table, attributes, uniqueFields] of tables) {
    const columns = Object.fromEntries(Object.entries(attributes).map(([key, attribute]) => {
      const definition = typeof attribute === 'object' && 'type' in attribute ? attribute : { type: attribute };
      return [definition.field || key, definition];
    }));
    await query.createTable(table, columns, { charset: 'utf8mb4', collate: 'utf8mb4_bin' });
    const indexes = await query.showIndex(table) as { name: string }[];
    if (!indexes.some(index => index.name === `${table}_code_unique`))
      await query.addIndex(table, uniqueFields, { unique: true, name: `${table}_code_unique` });
  }
  await query.createTable('system_locks', { id: { type: DataTypes.INTEGER, primaryKey: true, allowNull: false } });
  await query.sequelize.query('INSERT IGNORE INTO system_locks (id) VALUES (1)');
}
