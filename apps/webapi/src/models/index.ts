import { MetadataModel } from './Metadata.js';
import { MetadataEnumValueModel } from './MetadataEnumValue.js';
import { EventModel } from './EventModel.js';
import { EventDimensionModel } from './EventDimension.js';
import { EventDimensionValueModel } from './EventDimensionValue.js';
import { EventMetricModel } from './EventMetric.js';
import { AudienceModel } from './Audience.js';

export const models = {
  metadata: MetadataModel, metadataValues: MetadataEnumValueModel, events: EventModel,
  dimensions: EventDimensionModel, dimensionValues: EventDimensionValueModel, metrics: EventMetricModel, audiences: AudienceModel,
};
export type Resource = keyof typeof models;
