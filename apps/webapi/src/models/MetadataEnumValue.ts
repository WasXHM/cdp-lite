import { defineModel, foreignKey, valueColumns } from './common.js';

export const metadataValueColumns = { ...valueColumns, metadataId: foreignKey('metadata', 'metadata_id') };
export const MetadataEnumValueModel = defineModel('MetadataEnumValue', 'metadata_enum_values', metadataValueColumns);
