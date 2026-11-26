import { MetadataModel } from './Metadata.js';
import { MetadataEnumValueModel } from './MetadataEnumValue.js';
import { EventModel } from './EventModel.js';
import { EventDimensionModel } from './EventDimension.js';
import { EventDimensionValueModel } from './EventDimensionValue.js';
import { EventMetricModel } from './EventMetric.js';
import { AudienceModel } from './Audience.js';
import { UserModel } from './User.js';
import { AuthSessionModel } from './AuthSession.js';

UserModel.hasMany(AuthSessionModel, { as: 'sessions', foreignKey: 'userId' });
AuthSessionModel.belongsTo(UserModel, { as: 'user', foreignKey: 'userId' });

export const models = {
  metadata: MetadataModel, metadataValues: MetadataEnumValueModel, events: EventModel,
  dimensions: EventDimensionModel, dimensionValues: EventDimensionValueModel, metrics: EventMetricModel, audiences: AudienceModel,
};
export type Resource = keyof typeof models;
export { UserModel, AuthSessionModel };
