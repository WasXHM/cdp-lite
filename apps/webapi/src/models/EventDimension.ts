import { defineModel, fieldColumns, foreignKey } from './common.js';

export const dimensionColumns = { ...fieldColumns, eventModelId: foreignKey('event_models', 'event_model_id') };
export const EventDimensionModel = defineModel('EventDimension', 'event_dimensions', dimensionColumns);
