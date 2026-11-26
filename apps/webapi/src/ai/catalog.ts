import { createHash } from 'node:crypto';
import { operators, type AiAudienceResourceRef, type AiAudienceResourceType, type AudienceRule, type Catalog, type Dimension, type EventModel, type Metadata, type Metric, type RuleValue } from '@cdp/contracts';

type CatalogResource =
  | { resourceType: 'TAG' | 'ATTRIBUTE'; resource: Metadata }
  | { resourceType: 'EVENT'; resource: EventModel }
  | { resourceType: 'DIMENSION'; resource: Dimension }
  | { resourceType: 'METRIC'; resource: Metric };

export type ProviderCatalog = {
  metadata: Array<{
    alias: string; type: 'TAG' | 'ATTRIBUTE'; name: string; description: string; dataType: string;
    allowedOperators: string[]; values: Array<{ alias: string; label: string }>;
  }>;
  events: Array<{
    alias: string; name: string; description: string;
    dimensions: Array<{ alias: string; name: string; description: string; dataType: string; allowedOperators: string[]; values: Array<{ alias: string; label: string }> }>;
    metrics: Array<{ alias: string; name: string; description: string; dataType: 'Number' }>;
  }>;
};

export type CatalogSnapshot = {
  catalog: Catalog;
  providerCatalog: ProviderCatalog;
  revision: string;
  resourceByAlias: Map<string, CatalogResource>;
  aliasByResourceId: Map<string, string>;
  enumValueByAlias: Map<string, string | number>;
};

const byId = <T extends { id: string }>(left: T, right: T) => left.id.localeCompare(right.id);
const enabled = <T extends { id: string; status: string }>(items: T[] | undefined) => (items || []).filter(item => item.status === 'ENABLED').sort(byId);

export function normalizeEnabledCatalog(catalog: Catalog): Catalog {
  return {
    metadata: enabled(catalog.metadata).map(item => ({ ...item, enumValues: enabled(item.enumValues) })),
    events: enabled(catalog.events).map(event => ({
      ...event,
      dimensions: enabled(event.dimensions).map(dimension => ({ ...dimension, enumValues: enabled(dimension.enumValues) })),
      metrics: enabled(event.metrics),
    })),
  };
}

export function buildCatalogSnapshot(input: Catalog): CatalogSnapshot {
  const catalog = normalizeEnabledCatalog(input);
  const resourceByAlias = new Map<string, CatalogResource>();
  const aliasByResourceId = new Map<string, string>();
  const enumValueByAlias = new Map<string, string | number>();
  let tagIndex = 0;
  let attributeIndex = 0;
  const metadata = catalog.metadata.map(item => {
    const alias = item.metadataType === 'TAG' ? `T${++tagIndex}` : `A${++attributeIndex}`;
    resourceByAlias.set(alias, { resourceType: item.metadataType, resource: item });
    aliasByResourceId.set(item.id, alias);
    const values = (item.enumValues || []).map((value, valueIndex) => {
      const valueAlias = `${alias}.V${valueIndex + 1}`;
      enumValueByAlias.set(valueAlias, value.value);
      return { alias: valueAlias, label: value.label };
    });
    return {
      alias, type: item.metadataType, name: item.name, description: item.description, dataType: item.dataType,
      allowedOperators: operators[item.dataType], values,
    };
  });
  const events = catalog.events.map((event, eventIndex) => {
    const alias = `E${eventIndex + 1}`;
    resourceByAlias.set(alias, { resourceType: 'EVENT', resource: event });
    aliasByResourceId.set(event.id, alias);
    const dimensions = (event.dimensions || []).map((dimension, dimensionIndex) => {
      const dimensionAlias = `${alias}.D${dimensionIndex + 1}`;
      resourceByAlias.set(dimensionAlias, { resourceType: 'DIMENSION', resource: dimension });
      aliasByResourceId.set(dimension.id, dimensionAlias);
      const values = (dimension.enumValues || []).map((value, valueIndex) => {
        const valueAlias = `${dimensionAlias}.V${valueIndex + 1}`;
        enumValueByAlias.set(valueAlias, value.value);
        return { alias: valueAlias, label: value.label };
      });
      return {
        alias: dimensionAlias, name: dimension.name, description: dimension.description, dataType: dimension.dataType,
        allowedOperators: operators[dimension.dataType], values,
      };
    });
    const metrics = (event.metrics || []).map((metric, metricIndex) => {
      const metricAlias = `${alias}.M${metricIndex + 1}`;
      resourceByAlias.set(metricAlias, { resourceType: 'METRIC', resource: metric });
      aliasByResourceId.set(metric.id, metricAlias);
      return { alias: metricAlias, name: metric.name, description: metric.description, dataType: 'Number' as const };
    });
    return { alias, name: event.name, description: event.description, dimensions, metrics };
  });
  const providerCatalog = { metadata, events };
  const digest = createHash('sha256').update(JSON.stringify(providerCatalog)).digest('hex');
  return { catalog, providerCatalog, revision: `sha256:${digest}`, resourceByAlias, aliasByResourceId, enumValueByAlias };
}

export function resourceRef(snapshot: CatalogSnapshot, alias: string): AiAudienceResourceRef {
  const entry = snapshot.resourceByAlias.get(alias);
  if (!entry) throw new Error(`UNKNOWN_RESOURCE_ALIAS:${alias}`);
  return { resourceType: entry.resourceType, resourceId: entry.resource.id, name: entry.resource.name };
}

export function resourceAlias(snapshot: CatalogSnapshot, resourceType: AiAudienceResourceType, resourceId: string): string | null {
  const alias = snapshot.aliasByResourceId.get(resourceId);
  const entry = alias ? snapshot.resourceByAlias.get(alias) : undefined;
  return entry?.resourceType === resourceType ? alias! : null;
}

export function resolveCatalogValue(snapshot: CatalogSnapshot, ownerAlias: string, value: RuleValue): RuleValue {
  const owner = snapshot.resourceByAlias.get(ownerAlias);
  if (!owner || (owner.resourceType !== 'TAG' && owner.resourceType !== 'ATTRIBUTE' && owner.resourceType !== 'DIMENSION')) return value;
  if (!owner.resource.isEnum) return value;
  const resolveOne = (item: string | number | boolean): string | number | boolean => {
    if (typeof item !== 'string' || !snapshot.enumValueByAlias.has(item)) throw new Error(`UNKNOWN_ENUM_ALIAS:${String(item)}`);
    return snapshot.enumValueByAlias.get(item)!;
  };
  if (value === null) return null;
  return Array.isArray(value) ? value.map(resolveOne) : resolveOne(value);
}

export function referencedByRule(resource: AiAudienceResourceRef, rule: AudienceRule): boolean {
  if (rule.metadataType !== 'EVENT') return (resource.resourceType === 'TAG' || resource.resourceType === 'ATTRIBUTE') && rule.metadataId === resource.resourceId;
  if (resource.resourceType === 'EVENT') return rule.eventId === resource.resourceId;
  if (resource.resourceType === 'DIMENSION') return rule.dimensionFilters.some(filter => filter.dimensionId === resource.resourceId);
  if (resource.resourceType === 'METRIC') return rule.aggregation.metricId === resource.resourceId;
  return false;
}
