import { describe, expect, it } from 'vitest';
import type { AudienceRules, EventRule } from '@cdp/contracts';
import { addGroup, addRule, changeEventModel, changeRuleType, createRule, removeRule } from './rules';

describe('规则编辑器纯函数', () => {
  it('编辑分组不修改原始数组', () => {
    const original: AudienceRules = [[createRule('TAG')]];
    const snapshot = structuredClone(original);
    const result = addRule(addGroup(original), 1, 'ATTRIBUTE');
    expect(result).toHaveLength(2);
    expect(original).toEqual(snapshot);
    expect(removeRule(result, 0, 0)[0]).toEqual([]);
  });
  it('切换规则类型清空旧专属字段', () => {
    const rules: AudienceRules = [[createRule('EVENT')]];
    expect(changeRuleType(rules, 0, 0, 'TAG')[0][0]).toEqual({ metadataType: 'TAG', metadataId: '', operator: 'EQ', value: null });
  });
  it('切换行为模型保留时间但清空维度、指标和比较值', () => {
    const rule: EventRule = { ...createRule('EVENT') as EventRule, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 30 }, eventId: 'old', dimensionFilters: [{ dimensionId: 'old-dimension', operator: 'EQ', value: 'x' }], aggregation: { type: 'SUM', metricId: 'old-metric' }, value: 500 };
    expect(changeEventModel(rule, 'new')).toEqual({ ...rule, eventId: 'new', dimensionFilters: [], aggregation: { type: 'COUNT', metricId: null }, operator: 'GTE', value: 1 });
    expect(rule.aggregation.metricId).toBe('old-metric');
  });
});
