import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Transaction } from 'sequelize';
import {
  audienceSchema, enumSchema, eventSchema, fieldIssues, fieldSchema, metadataSchema, metricSchema, referenced,
  validScalar, validateRules, type AudienceRules, type Catalog, type Dimension, type EnumValue, type EventModel,
  type FieldInput, type ListQuery, type Metadata,
} from '@cdp/contracts';
import { database } from '../config/database.js';
import { repository } from '../repositories/resources.js';
import type { Resource } from '../models/index.js';
import type { Row } from '../models/common.js';
import { AppError } from '../errors/AppError.js';

const schemas = { metadata: metadataSchema, metadataValues: enumSchema, events: eventSchema, dimensions: fieldSchema, dimensionValues: enumSchema, metrics: metricSchema, audiences: audienceSchema };
type Scope = Record<string, string>;
async function required(resource: Resource, id: string, scope: Scope = {}, transaction?: Transaction) {
  const row = await repository.find(resource, id, transaction);
  if (!row || Object.entries(scope).some(([key, value]) => row[key] !== value)) throw new AppError(404, 'NOT_FOUND', '资源不存在或不属于当前父级');
  return row;
}
async function write<T>(action: (transaction: Transaction) => Promise<T>) {
  return database.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async transaction => {
    await repository.lock(transaction);
    return action(transaction);
  });
}
async function valueOwner(resource: Resource, scope: Scope, transaction?: Transaction) {
  if (resource === 'metadataValues') return required('metadata', scope.metadataId, {}, transaction);
  if (resource === 'dimensionValues') return required('dimensions', scope.dimensionId, {}, transaction);
  return null;
}
async function normalizeValues(resource: 'metadataValues' | 'dimensionValues', owner: Row, transaction?: Transaction): Promise<Row[]> {
  const key = resource === 'metadataValues' ? 'metadataId' : 'dimensionId';
  const rows = await repository.all(resource, { [key]: owner.id }, transaction);
  return rows.map((row): Row => ({ ...row, value: owner.dataType === 'Number' ? Number(row.value) : row.value })).sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));
}
async function detail(resource: Resource, id: string, scope: Scope = {}, transaction?: Transaction): Promise<Row> {
  const row = await required(resource, id, scope, transaction);
  if (resource === 'metadataValues' || resource === 'dimensionValues') {
    const owner = (await valueOwner(resource, { metadataId: String(row.metadataId || ''), dimensionId: String(row.dimensionId || '') }, transaction))!;
    if (owner.dataType === 'Number') row.value = Number(row.value);
  }
  if (resource === 'metadata' || resource === 'dimensions') row.enumValues = await normalizeValues(resource === 'metadata' ? 'metadataValues' : 'dimensionValues', row, transaction);
  if (resource === 'events') {
    const dimensions = await repository.all('dimensions', { eventModelId: id }, transaction);
    row.dimensions = await Promise.all(dimensions.map(dimension => detail('dimensions', dimension.id, {}, transaction)));
    row.metrics = await repository.all('metrics', { eventModelId: id }, transaction);
  }
  if (resource === 'audiences') row.ruleCount = (row.rules as AudienceRules).reduce((total, group) => total + group.length, 0);
  return row;
}
async function catalogFor(input: unknown, transaction?: Transaction): Promise<Catalog> {
  const parsed = audienceSchema.shape.rules.safeParse(input);
  if (!parsed.success) return { metadata: [], events: [] };
  const metadataIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const group of parsed.data) for (const rule of group) {
    if (rule.metadataType === 'EVENT') eventIds.add(rule.eventId);
    else metadataIds.add(rule.metadataId);
  }
  const metadata: Metadata[] = [];
  const events: EventModel[] = [];
  for (const id of metadataIds) if (await repository.find('metadata', id, transaction)) metadata.push(await detail('metadata', id, {}, transaction) as unknown as Metadata);
  for (const id of eventIds) if (await repository.find('events', id, transaction)) events.push(await detail('events', id, {}, transaction) as unknown as EventModel);
  return { metadata, events };
}
async function validate(input: unknown, transaction?: Transaction) {
  const issues = validateRules(input, await catalogFor(input, transaction));
  if (issues.length) throw new AppError(422, 'RULE_VALIDATION_FAILED', '规则校验未通过', issues);
  return { valid: true };
}
async function assertNotReferenced(resource: Resource, row: Row, transaction: Transaction) {
  if (resource === 'audiences') return;
  const audiences = await repository.all('audiences', {}, transaction);
  const ownerId = String(row.metadataId || row.dimensionId || '');
  let value = row.value as string | number;
  if (resource === 'metadataValues' || resource === 'dimensionValues') {
    const owner = await required(resource === 'metadataValues' ? 'metadata' : 'dimensions', ownerId, {}, transaction);
    if (owner.dataType === 'Number') value = Number(value);
  }
  const used = audiences.filter(audience => referenced(audience.rules as AudienceRules, resource, row.id, ownerId, value));
  if (used.length) throw new AppError(409, 'RESOURCE_REFERENCED', `已被 ${used.length} 个人群引用，请停用或先调整人群规则`);
}
async function checkParents(resource: Resource, scope: Scope, transaction?: Transaction) {
  if (scope.eventModelId) await required('events', scope.eventModelId, {}, transaction);
  const owner = await valueOwner(resource, scope, transaction);
  if (owner && !owner.isEnum) throw new AppError(422, 'NOT_ENUM', '当前字段未启用枚举值');
}
async function checkBusiness(resource: Resource, values: Record<string, unknown>, scope: Scope, transaction: Transaction, current?: Row) {
  if (resource === 'metadata' || resource === 'dimensions') {
    const issues = fieldIssues(values as FieldInput);
    if (issues.length) throw new AppError(422, 'FIELD_VALIDATION_FAILED', '字段配置不兼容', issues);
  }
  if (resource === 'dimensions' || resource === 'metrics') {
    const siblings = [
      ...await repository.all('dimensions', { eventModelId: scope.eventModelId }, transaction),
      ...await repository.all('metrics', { eventModelId: scope.eventModelId }, transaction),
    ];
    if (siblings.some(row => row.id !== current?.id && row.fieldName === values.fieldName))
      throw new AppError(409, 'CODE_CONFLICT', '同一行为模型的维度、指标字段名称不能重复');
  }
  if (resource === 'metadataValues' || resource === 'dimensionValues') {
    const owner = (await valueOwner(resource, scope, transaction))!;
    if (!validScalar(owner.dataType as FieldInput['dataType'], values.value))
      throw new AppError(422, 'ENUM_TYPE_INVALID', '枚举值编码必须匹配所属字段的数据类型');
    if (current && String(current.value) !== String(values.value)) await assertNotReferenced(resource, current, transaction);
    values.value = String(values.value);
  }
  if (resource === 'audiences') await validate(values.rules, transaction);
}
export const resourceService = {
  detail, validate,
  async list(resource: Resource, query: ListQuery, scope: Scope = {}) {
    await checkParents(resource, scope);
    if (resource === 'metadataValues' || resource === 'dimensionValues') {
      const owner = (await valueOwner(resource, scope))!;
      const all = await normalizeValues(resource, owner);
      const filtered = all.filter(row => !query.status || row.status === query.status);
      return { data: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), pagination: { page: query.page, pageSize: query.pageSize, total: filtered.length } };
    }
    const result = await repository.list(resource, query, { ...scope, ...(resource === 'metadata' && query.type ? { metadataType: query.type } : {}) });
    if (resource === 'audiences') result.data = result.data.map(row => {
      const { rules, ...rest } = row;
      return { ...rest, ruleCount: (rules as AudienceRules).reduce((total, group) => total + group.length, 0) } as Row;
    });
    return result;
  },
  create(resource: Resource, input: unknown, scope: Scope = {}) {
    return write(async transaction => {
      await checkParents(resource, scope, transaction);
      const values: Record<string, unknown> = schemas[resource].parse(input);
      await checkBusiness(resource, values, scope, transaction);
      const row = await repository.create(resource, { ...values, ...scope }, transaction);
      return detail(resource, row.id, scope, transaction);
    });
  },
  update(resource: Resource, id: string, input: unknown, scope: Scope = {}) {
    return write(async transaction => {
      await checkParents(resource, scope, transaction);
      const current = await required(resource, id, scope, transaction);
      const patchSchema = resource === 'audiences' ? audienceSchema.partial().extend({ revision: z.number().int().positive() }).strict() : schemas[resource].partial();
      const patch = patchSchema.parse(input) as Record<string, unknown>;
      const immutable = ['fieldName', 'dataType', 'metadataType', 'isEnum', 'eventCode', 'audienceCode', 'schemaVersion'];
      for (const key of immutable) if (key in patch && patch[key] !== current[key])
        throw new AppError(409, 'IMMUTABLE_FIELD', '技术编码、数据类型和枚举语义创建后不可修改', [{ path: key, message: '请创建新字段以调整此配置' }]);
      if (resource === 'audiences' && patch.revision !== current.revision) throw new AppError(409, 'REVISION_CONFLICT', '人群已被其他页面修改，请刷新后重试');
      const values = { ...current, ...patch };
      if ((resource === 'metadataValues' || resource === 'dimensionValues') && !('value' in patch)) {
        const owner = (await valueOwner(resource, scope, transaction))!;
        if (owner.dataType === 'Number') values.value = Number(values.value);
      }
      await checkBusiness(resource, values, scope, transaction, current);
      if (resource === 'audiences') patch.revision = Number(current.revision) + 1;
      if ('value' in patch) patch.value = values.value;
      await repository.update(resource, id, patch, transaction);
      return detail(resource, id, scope, transaction);
    });
  },
  remove(resource: Resource, id: string, scope: Scope = {}) {
    return write(async transaction => {
      await checkParents(resource, scope, transaction);
      const row = await required(resource, id, scope, transaction);
      await assertNotReferenced(resource, row, transaction);
      if (resource === 'events') {
        for (const dimension of await repository.all('dimensions', { eventModelId: id }, transaction)) {
          for (const value of await repository.all('dimensionValues', { dimensionId: dimension.id }, transaction)) await repository.remove('dimensionValues', value.id, transaction);
          await repository.remove('dimensions', dimension.id, transaction);
        }
        for (const metric of await repository.all('metrics', { eventModelId: id }, transaction)) await repository.remove('metrics', metric.id, transaction);
      }
      if (resource === 'metadata' || resource === 'dimensions') {
        const child = resource === 'metadata' ? 'metadataValues' : 'dimensionValues';
        const key = resource === 'metadata' ? 'metadataId' : 'dimensionId';
        for (const value of await repository.all(child, { [key]: id }, transaction)) await repository.remove(child, value.id, transaction);
      }
      await repository.remove(resource, id, transaction);
    });
  },
  copy(id: string) {
    return write(async transaction => {
      const source = await required('audiences', id, {}, transaction);
      await validate(source.rules, transaction);
      const values = audienceSchema.parse({
        name: `${String(source.name).slice(0, 94)} 副本`, audienceCode: `copy_${randomUUID().replaceAll('-', '')}`,
        description: source.description, rules: source.rules, status: 'DRAFT', schemaVersion: 1,
      });
      const row = await repository.create('audiences', values, transaction);
      return detail('audiences', row.id, {}, transaction);
    });
  },
  async catalog(type: 'TAG' | 'ATTRIBUTE' | 'EVENT', query: ListQuery) {
    return repository.list(type === 'EVENT' ? 'events' : 'metadata', { ...query, status: 'ENABLED' }, type === 'EVENT' ? {} : { metadataType: type });
  },
  async dimensionScope(eventId: string, dimensionId: string) {
    await required('dimensions', dimensionId, { eventModelId: eventId });
    return { dimensionId };
  },
};

export type CatalogField = Metadata | Dimension;
export type CatalogValue = EnumValue;
