import { DataTypes } from 'sequelize';
import { baseColumns, defineModel } from './common.js';

export const eventColumns = { ...baseColumns, eventCode: { type: DataTypes.STRING(64), allowNull: false, field: 'event_code' } };
export const EventModel = defineModel('Event', 'event_models', eventColumns);
