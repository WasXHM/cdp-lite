import { z } from 'zod';
import {
  aiAudienceMappingSchema, operatorSchema, rulesSchema, timeRangeSchema, type AiAudienceGenerateResult,
  type AiAudienceMapping, type AiAudienceParameter, type AudienceRule, type AudienceRules, type RuleValue,
} from '@cdp/contracts';
import { referencedByRule, resolveCatalogValue, resourceRef, type CatalogSnapshot } from './catalog.js';

const aliasSchema = z.string().trim().min(1).max(32);
const providerScalarSchema = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
const providerRuleValueSchema = z.union([providerScalarSchema, z.array(providerScalarSchema).max(100), z.null()]);
const providerRuleSchema = z.discriminatedUnion('metadataType', [
  z.object({ metadataType: z.literal('TAG'), metadataId: aliasSchema, operator: operatorSchema, value: providerRuleValueSchema }).strict(),
  z.object({ metadataType: z.literal('ATTRIBUTE'), metadataId: aliasSchema, operator: operatorSchema, value: providerRuleValueSchema }).strict(),
  z.object({
    metadataType: z.literal('EVENT'), eventId: aliasSchema, timeRange: timeRangeSchema,
    dimensionFilters: z.array(z.object({ dimensionId: aliasSchema, operator: operatorSchema, value: providerRuleValueSchema }).strict()).max(30),
    aggregation: z.object({ type: z.enum(['COUNT', 'SUM', 'AVG', 'MAX', 'MIN']), metricId: aliasSchema.nullable() }).strict(),
    operator: z.enum(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN']),
    value: z.union([z.number().finite(), z.tuple([z.number().finite(), z.number().finite()])]),
  }).strict(),
]);
const providerRulesSchema = z.array(z.array(providerRuleSchema).min(1).max(50)).min(1).max(20);
const providerParameterSchema = z.object({
  path: z.string().regex(/^rules\[\d+\]\[\d+\](?:\.[A-Za-z][A-Za-z0-9]*|\[\d+\])*$/).max(200),
  label: z.string().trim().min(1).max(100), displayValue: z.string().trim().min(1).max(200),
  source: z.enum(['USER_EXPLICIT', 'METADATA_DEFINED', 'AI_DERIVED']), explanation: z.string().trim().min(1).max(300),
}).strict();
const providerMappingBase = {
  key: z.string().trim().min(1).max(64), sourceText: z.string().trim().min(1).max(300),
  rulePaths: z.array(z.string().regex(/^rules\[\d+\]\[\d+\]$/)).max(20),
  explanation: z.string().trim().min(1).max(500), parameters: z.array(providerParameterSchema).max(30),
  candidateAliases: z.array(aliasSchema).max(5),
};
const providerMappingSchema = z.discriminatedUnion('status', [
  z.object({ ...providerMappingBase, status: z.literal('MAPPED'), resourceAlias: aliasSchema, derivation: z.null() }).strict(),
  z.object({
    ...providerMappingBase, status: z.literal('DERIVED'), resourceAlias: z.null(),
    derivation: z.object({
      concept: z.string().trim().min(1).max(100), suggestedDefinition: z.string().trim().min(1).max(500),
      signals: z.array(z.object({ resourceAlias: aliasSchema, role: z.string().trim().min(1).max(100), reason: z.string().trim().min(1).max(300) }).strict()).min(1).max(10),
    }).strict(),
  }).strict(),
  z.object({ ...providerMappingBase, status: z.literal('NEEDS_CONFIRMATION'), resourceAlias: z.null(), derivation: z.null() }).strict(),
  z.object({ ...providerMappingBase, status: z.literal('UNMAPPED'), resourceAlias: z.null(), derivation: z.null() }).strict(),
]);
export const providerGenerateOutputSchema = z.object({
  summary: z.string().trim().min(1).max(1000), rules: providerRulesSchema.nullable(),
  mappings: z.array(providerMappingSchema).min(1).max(100), warnings: z.array(z.string().trim().min(1).max(500)).max(20),
}).strict().superRefine((output, context) => {
  output.mappings.forEach((mapping, index) => {
    const issue = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: ['mappings', index], message });
    if ((mapping.status === 'MAPPED' || mapping.status === 'DERIVED') && mapping.rulePaths.length === 0) issue('已生成映射必须关联规则路径');
    if (mapping.status === 'DERIVED' && mapping.parameters.length === 0) issue('推导映射必须说明参数来源');
    if ((mapping.status === 'NEEDS_CONFIRMATION' || mapping.status === 'UNMAPPED') && (mapping.rulePaths.length || mapping.parameters.length))
      issue('未生成规则的映射不能关联规则或参数');
    if (mapping.status === 'NEEDS_CONFIRMATION' && mapping.candidateAliases.length === 0) issue('待确认映射必须提供候选项');
    if (mapping.status !== 'NEEDS_CONFIRMATION' && mapping.candidateAliases.length) issue('只有待确认映射可以提供候选项');
  });
});
export type ProviderGenerateOutput = z.infer<typeof providerGenerateOutputSchema>;

function resolveRules(input: z.infer<typeof providerRulesSchema> | null, snapshot: CatalogSnapshot): AudienceRules | null {
  if (input === null) return null;
  const rules = input.map(group => group.map((rule): AudienceRule => {
    if (rule.metadataType !== 'EVENT') {
      const entry = snapshot.resourceByAlias.get(rule.metadataId);
      if (!entry || entry.resourceType !== rule.metadataType) throw new Error(`INVALID_METADATA_ALIAS:${rule.metadataId}`);
      return { ...rule, metadataId: entry.resource.id, value: resolveCatalogValue(snapshot, rule.metadataId, rule.value as RuleValue) };
    }
    const eventEntry = snapshot.resourceByAlias.get(rule.eventId);
    if (!eventEntry || eventEntry.resourceType !== 'EVENT') throw new Error(`INVALID_EVENT_ALIAS:${rule.eventId}`);
    const dimensionFilters = rule.dimensionFilters.map(filter => {
      const dimensionEntry = snapshot.resourceByAlias.get(filter.dimensionId);
      if (!dimensionEntry || dimensionEntry.resourceType !== 'DIMENSION' || dimensionEntry.resource.eventModelId !== eventEntry.resource.id)
        throw new Error(`INVALID_DIMENSION_ALIAS:${filter.dimensionId}`);
      return { ...filter, dimensionId: dimensionEntry.resource.id, value: resolveCatalogValue(snapshot, filter.dimensionId, filter.value as RuleValue) };
    });
    let metricId: string | null = null;
    if (rule.aggregation.type !== 'COUNT') {
      const metricEntry = rule.aggregation.metricId ? snapshot.resourceByAlias.get(rule.aggregation.metricId) : undefined;
      if (!metricEntry || metricEntry.resourceType !== 'METRIC' || metricEntry.resource.eventModelId !== eventEntry.resource.id)
        throw new Error(`INVALID_METRIC_ALIAS:${String(rule.aggregation.metricId)}`);
      metricId = metricEntry.resource.id;
    } else if (rule.aggregation.metricId !== null) throw new Error('COUNT_WITH_METRIC');
    return { ...rule, eventId: eventEntry.resource.id, dimensionFilters, aggregation: { ...rule.aggregation, metricId } };
  }));
  return rulesSchema.parse(rules);
}

function ruleAtPath(rules: AudienceRules | null, path: string): AudienceRule {
  const match = /^rules\[(\d+)\]\[(\d+)\]$/.exec(path);
  const rule = match && rules?.[Number(match[1])]?.[Number(match[2])];
  if (!rule) throw new Error(`INVALID_RULE_PATH:${path}`);
  return rule;
}

function valueAtPath(rules: AudienceRules | null, path: string): AiAudienceParameter['value'] {
  const tokens: Array<string | number> = [];
  for (const match of path.matchAll(/([A-Za-z][A-Za-z0-9]*)|\[(\d+)\]/g)) tokens.push(match[1] ?? Number(match[2]));
  let value: unknown = { rules };
  for (const token of tokens) {
    if (value === null || typeof value !== 'object') throw new Error(`INVALID_PARAMETER_PATH:${path}`);
    value = (value as Record<string | number, unknown>)[token];
  }
  const parsed = z.union([providerRuleValueSchema, timeRangeSchema]).safeParse(value);
  if (!parsed.success) throw new Error(`INVALID_PARAMETER_VALUE:${path}`);
  return parsed.data as AiAudienceParameter['value'];
}

function description(snapshot: CatalogSnapshot, alias: string): string {
  const entry = snapshot.resourceByAlias.get(alias);
  return entry?.resource.description || '';
}

function resolveParameters(parameters: z.infer<typeof providerParameterSchema>[], rules: AudienceRules | null): AiAudienceParameter[] {
  return parameters.map(parameter => ({ ...parameter, value: valueAtPath(rules, parameter.path) }));
}

function ensureReferences(mapping: AiAudienceMapping, rules: AudienceRules | null, snapshot: CatalogSnapshot, denyFieldNames: Set<string>) {
  const pathRules = mapping.rulePaths.map(path => ruleAtPath(rules, path));
  if (mapping.status === 'MAPPED' && !pathRules.some(rule => referencedByRule(mapping.resource, rule)))
    throw new Error(`MAPPING_RESOURCE_NOT_REFERENCED:${mapping.key}`);
  if (mapping.status !== 'DERIVED') return;
  for (const signal of mapping.derivation.signals) {
    if (!pathRules.some(rule => referencedByRule(signal, rule))) throw new Error(`DERIVED_SIGNAL_NOT_REFERENCED:${mapping.key}`);
    const alias = snapshot.aliasByResourceId.get(signal.resourceId);
    const entry = alias ? snapshot.resourceByAlias.get(alias) : undefined;
    const fieldName = entry?.resource && 'fieldName' in entry.resource ? String(entry.resource.fieldName).toLowerCase() : '';
    if (fieldName && denyFieldNames.has(fieldName)) throw new Error(`DERIVED_SIGNAL_DENIED:${mapping.key}`);
  }
}

export function resolveProviderOutput(
  input: unknown,
  snapshot: CatalogSnapshot,
  denyFieldNames: Set<string>,
): Pick<AiAudienceGenerateResult, 'summary' | 'rules' | 'mappings' | 'warnings' | 'requiresConfirmation' | 'hasUnmappedSegments'> {
  const providerOutput = providerGenerateOutputSchema.parse(input);
  const rules = resolveRules(providerOutput.rules, snapshot);
  const keys = new Set<string>();
  const mappings = providerOutput.mappings.map(mapping => {
    if (keys.has(mapping.key)) throw new Error(`DUPLICATE_MAPPING_KEY:${mapping.key}`);
    keys.add(mapping.key);
    const common = {
      key: mapping.key, sourceText: mapping.sourceText, rulePaths: mapping.rulePaths, explanation: mapping.explanation,
      parameters: resolveParameters(mapping.parameters, rules),
    };
    let resolved: AiAudienceMapping;
    if (mapping.status === 'MAPPED') {
      resolved = aiAudienceMappingSchema.parse({
        ...common, status: mapping.status, resource: resourceRef(snapshot, mapping.resourceAlias), derivation: null, candidates: [],
      });
    } else if (mapping.status === 'DERIVED') {
      resolved = aiAudienceMappingSchema.parse({
        ...common, status: mapping.status, resource: null, candidates: [],
        derivation: {
          concept: mapping.derivation.concept, suggestedDefinition: mapping.derivation.suggestedDefinition,
          signals: mapping.derivation.signals.map(signal => ({ ...resourceRef(snapshot, signal.resourceAlias), role: signal.role, reason: signal.reason })),
        },
      });
    } else if (mapping.status === 'NEEDS_CONFIRMATION') {
      resolved = aiAudienceMappingSchema.parse({
        ...common, status: mapping.status, resource: null, derivation: null,
        candidates: mapping.candidateAliases.map(alias => ({ ...resourceRef(snapshot, alias), description: description(snapshot, alias) })),
      });
    } else {
      resolved = aiAudienceMappingSchema.parse({ ...common, status: mapping.status, resource: null, derivation: null, candidates: [] });
    }
    ensureReferences(resolved, rules, snapshot, denyFieldNames);
    return resolved;
  });
  const requiresConfirmation = mappings.some(mapping => mapping.status === 'NEEDS_CONFIRMATION');
  const hasUnmappedSegments = mappings.some(mapping => mapping.status === 'UNMAPPED');
  return { summary: providerOutput.summary, rules, mappings, warnings: providerOutput.warnings, requiresConfirmation, hasUnmappedSegments };
}
