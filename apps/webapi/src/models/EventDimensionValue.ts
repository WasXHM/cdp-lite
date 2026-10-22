import { defineModel, foreignKey, valueColumns } from './common.js';

export const dimensionValueColumns = { ...valueColumns, dimensionId: foreignKey('event_dimensions', 'dimension_id') };
export const EventDimensionValueModel = defineModel('EventDimensionValue', 'event_dimension_values', dimensionValueColumns);
