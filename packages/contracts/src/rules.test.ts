import { describe, expect, it } from 'vitest';
import { conditionIssues, fieldIssues, referenced, validScalar, validateRules, type AudienceRules, type Catalog, type EventRule, type Field, type Metadata } from './index';

const ids = {
  tag: '11111111-1111-4111-8111-111111111111', event: '22222222-2222-4222-8222-222222222222',
  dimension: '33333333-3333-4333-8333-333333333333', metric: '44444444-4444-4444-8444-444444444444', other: '55555555-5555-4555-8555-555555555555',
};
const field: Field = { id: ids.tag, name: '年龄', fieldName: 'age', dataType: 'Number', displayType: 'NUMBER', isEnum: false, status: 'ENABLED', description: '' };
const catalog: Catalog = {
  metadata: [{ ...field, metadataType: 'ATTRIBUTE', createdAt: '', updatedAt: '' }],
  events: [{
    id: ids.event, name: '购买', eventCode: 'purchase', description: '', status: 'ENABLED', createdAt: '', updatedAt: '',
    dimensions: [{ ...field, id: ids.dimension, eventModelId: ids.event, createdAt: '', updatedAt: '' }],
    metrics: [{ id: ids.metric, eventModelId: ids.event, name: '金额', fieldName: 'amount', dataType: 'Number', description: '', status: 'ENABLED', createdAt: '', updatedAt: '' }],
  }],
};
const eventRule: EventRule = { metadataType: 'EVENT', eventId: ids.event, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 30 }, dimensionFilters: [], aggregation: { type: 'COUNT', metricId: null }, operator: 'GTE', value: 3 };
describe('规则结构与值语义', () => {
  it('接受混合 AND 条件与多个 OR 组', () => {
    expect(validateRules([[{ metadataType: 'ATTRIBUTE', metadataId: ids.tag, operator: 'GT', value: 25 }, eventRule], [eventRule]], catalog)).toEqual([]);
  });
  it.each([[], [[]], [[{ ...eventRule, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 0 } }]], [[{ ...eventRule, aggregation: { type: 'COUNT', metricId: ids.metric } }]], [[{ ...eventRule, aggregation: { type: 'SUM', metricId: ids.other } }]], [[{ ...eventRule, dimensionFilters: [{ dimensionId: ids.other, operator: 'EQ', value: 1 }] }]], [[{ ...eventRule, value: -1 }]], [[{ ...eventRule, value: 1.5 }]], [[{ ...eventRule, value: [10, 2], operator: 'BETWEEN' }]]].map(rules => ({ rules })))('拒绝不合法规则 %#', ({ rules }) => {
    expect(validateRules(rules, catalog).length).toBeGreaterThan(0);
  });
  it('拒绝反向绝对时间和缺少时区的时间', () => {
    for (const timeRange of [{ type: 'ABSOLUTE', start: '2026-10-21T00:00:00Z', end: '2026-10-20T00:00:00Z' }, { type: 'ABSOLUTE', start: '2026-10-20T00:00:00', end: '2026-10-21T00:00:00' }])
      expect(validateRules([[{ ...eventRule, timeRange }]], catalog).length).toBeGreaterThan(0);
  });
  it('相同时刻不受 ISO 时区字符串字典顺序影响', () => {
    const dateField = { ...field, dataType: 'DateTime' as const };
    expect(conditionIssues(dateField, 'BETWEEN', ['2026-01-01T10:00:00+08:00', '2026-01-01T03:00:00Z'], 'rules[0][0]')).toEqual([]);
  });
  it.each([
    ['EQ', '25'], ['IN', []], ['IN', 25], ['BETWEEN', [30, 20]], ['BETWEEN', [20]],
    ['CONTAINS', 2], ['IS_NULL', 1], ['EQ', [25]], ['EQ', null],
  ] as const)('拒绝数值字段不合法条件 %s %s', (operator, value) => {
    expect(conditionIssues(field, operator, value as never, 'rules[0][0]').length).toBeGreaterThan(0);
  });
  it('接受 false 和零，不把它们当作空值', () => {
    expect(conditionIssues(field, 'EQ', 0, 'rules[0][0]')).toEqual([]);
    expect(conditionIssues({ ...field, dataType: 'Boolean' }, 'EQ', false, 'rules[0][0]')).toEqual([]);
  });
  it('校验真实日期而非仅检查格式', () => {
    expect(validScalar('Date', '2026-02-30')).toBe(false);
    expect(validScalar('Date', '2024-02-29')).toBe(true);
  });
  it('校验字段展示类型与枚举配置', () => {
    expect(fieldIssues({ ...field, isEnum: true })).toHaveLength(1);
    expect(fieldIssues({ ...field, displayType: 'DATE' })).toHaveLength(1);
  });
  it('拒绝错误类型、停用引用及错误枚举编码', () => {
    const metadata: Metadata = { ...catalog.metadata[0], dataType: 'String', displayType: 'SELECT', isEnum: true, enumValues: [{ id: ids.other, value: 'GOLD', label: '金卡', sortOrder: 0, status: 'ENABLED', createdAt: '', updatedAt: '' }] };
    const rules: AudienceRules = [[{ metadataType: 'ATTRIBUTE', metadataId: ids.tag, operator: 'EQ', value: 'GOLD' }]];
    expect(validateRules(rules, { ...catalog, metadata: [metadata] })).toEqual([]);
    expect(validateRules(rules, { ...catalog, metadata: [{ ...metadata, status: 'DISABLED' }] })).not.toEqual([]);
    expect(validateRules(rules, { ...catalog, metadata: [{ ...metadata, enumValues: [] }] })).not.toEqual([]);
    expect(validateRules([[{ ...rules[0][0], metadataType: 'TAG' }]], catalog)).not.toEqual([]);
  });
  it('枚举引用定位到所有者，避免相同编码误伤其他字段', () => {
    const rules: AudienceRules = [[{ metadataType: 'TAG', metadataId: ids.tag, operator: 'IN', value: ['GOLD', 'SILVER'] }, { ...eventRule, dimensionFilters: [{ dimensionId: ids.dimension, operator: 'EQ', value: 'GOLD' }], aggregation: { type: 'SUM', metricId: ids.metric } }]];
    expect(referenced(rules, 'metadataValues', ids.other, ids.tag, 'GOLD')).toBe(true);
    expect(referenced(rules, 'metadataValues', ids.other, ids.dimension, 'GOLD')).toBe(false);
    expect(referenced(rules, 'dimensionValues', ids.other, ids.dimension, 'GOLD')).toBe(true);
    expect(referenced(rules, 'metrics', ids.metric)).toBe(true);
  });
});
