import type { AudienceRule, AudienceRules, EventRule } from '@cdp/contracts';

export function createRule(type: AudienceRule['metadataType']): AudienceRule {
  return type === 'EVENT'
    ? { metadataType: 'EVENT', eventId: '', timeRange: { type: 'RELATIVE', unit: 'DAY', value: 0 }, dimensionFilters: [], aggregation: { type: 'COUNT', metricId: null }, operator: 'GTE', value: 1 }
    : { metadataType: type, metadataId: '', operator: 'EQ', value: null };
}
export const addGroup = (rules: AudienceRules): AudienceRules => [...rules, []];
export const removeGroup = (rules: AudienceRules, index: number): AudienceRules => rules.filter((_, position) => position !== index);
export const addRule = (rules: AudienceRules, groupIndex: number, type: AudienceRule['metadataType']): AudienceRules => rules.map((group, index) => index === groupIndex ? [...group, createRule(type)] : group);
export const removeRule = (rules: AudienceRules, groupIndex: number, ruleIndex: number): AudienceRules => rules.map((group, index) => index === groupIndex ? group.filter((_, position) => position !== ruleIndex) : group);
export const updateRule = (rules: AudienceRules, groupIndex: number, ruleIndex: number, rule: AudienceRule): AudienceRules => rules.map((group, index) => index === groupIndex ? group.map((current, position) => position === ruleIndex ? rule : current) : group);
export const changeRuleType = (rules: AudienceRules, groupIndex: number, ruleIndex: number, type: AudienceRule['metadataType']) => updateRule(rules, groupIndex, ruleIndex, createRule(type));
export const changeEventModel = (rule: EventRule, eventId: string): EventRule => ({ ...rule, eventId, dimensionFilters: [], aggregation: { type: 'COUNT', metricId: null }, operator: 'GTE', value: 1 });
