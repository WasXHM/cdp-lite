import { DataTypes } from 'sequelize';
import { defineModel, fieldColumns } from './common.js';

export const metadataColumns = { ...fieldColumns, metadataType: { type: DataTypes.STRING(20), allowNull: false, field: 'metadata_type' } };
export const MetadataModel = defineModel('Metadata', 'metadata', metadataColumns);
