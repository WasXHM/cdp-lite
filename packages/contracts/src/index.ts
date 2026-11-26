import { z } from 'zod';

export const statusSchema = z.enum(['ENABLED', 'DISABLED']);
export const dataTypeSchema = z.enum(['String', 'Number', 'Boolean', 'Date', 'DateTime']);
export const displayTypeSchema = z.enum(['TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DATE', 'DATETIME']);
export const operatorSchema = z.enum(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'NOT_IN', 'BETWEEN', 'CONTAINS', 'NOT_CONTAINS', 'IS_NULL', 'IS_NOT_NULL']);
export type Operator = z.infer<typeof operatorSchema>;
export type DataType = z.infer<typeof dataTypeSchema>;
export const operators: Record<DataType, Operator[]> = {
  String: ['EQ', 'NE', 'IN', 'NOT_IN', 'CONTAINS', 'NOT_CONTAINS', 'IS_NULL', 'IS_NOT_NULL'],
  Number: ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'IS_NULL', 'IS_NOT_NULL'],
  Boolean: ['EQ', 'NE', 'IS_NULL', 'IS_NOT_NULL'],
  Date: ['EQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL'],
  DateTime: ['EQ', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL'],
};
export const operatorLabels: Record<Operator, string> = {
  EQ: '等于', NE: '不等于', GT: '大于', GTE: '大于等于', LT: '小于', LTE: '小于等于',
  IN: '属于任意值', NOT_IN: '不属于', BETWEEN: '介于', CONTAINS: '包含', NOT_CONTAINS: '不包含',
  IS_NULL: '为空', IS_NOT_NULL: '不为空',
};
export const displayTypes: Record<DataType, z.infer<typeof displayTypeSchema>[]> = {
  String: ['TEXT', 'SELECT', 'MULTI_SELECT'], Number: ['NUMBER', 'SELECT', 'MULTI_SELECT'],
  Boolean: ['BOOLEAN'], Date: ['DATE'], DateTime: ['DATETIME'],
};
export const codeSchema = z.string().trim().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, '编码需以英文字母开头，仅含字母、数字和下划线');
const nameSchema = z.string().trim().min(1, '名称不能为空').max(100);
const baseShape = { name: nameSchema, description: z.string().max(1000).default(''), status: statusSchema.default('ENABLED') };
export const fieldSchema = z.object({
  ...baseShape, fieldName: codeSchema, dataType: dataTypeSchema,
  displayType: displayTypeSchema, isEnum: z.boolean().default(false),
}).strict();
export const metadataSchema = fieldSchema.extend({ metadataType: z.enum(['TAG', 'ATTRIBUTE']) });
export const eventSchema = z.object({ ...baseShape, eventCode: codeSchema }).strict();
export const metricSchema = z.object({ ...baseShape, fieldName: codeSchema, dataType: z.literal('Number').default('Number') }).strict();
export const enumSchema = z.object({
  label: nameSchema, value: z.union([z.string().trim().min(1).max(100), z.number().finite()]),
  sortOrder: z.number().int().min(0).max(100000).default(0), status: statusSchema.default('ENABLED'),
}).strict();
const scalarSchema = z.union([z.string().max(1000), z.number().finite(), z.boolean()]);
const ruleValueSchema = z.union([scalarSchema, z.array(scalarSchema).max(100), z.null()]);
export const timeRangeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RELATIVE'), unit: z.literal('DAY'), value: z.number().int().positive().max(36500) }).strict(),
  z.object({ type: z.literal('ABSOLUTE'), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }).strict(),
]).refine(value => value.type !== 'ABSOLUTE' || Date.parse(value.start) < Date.parse(value.end), '开始时间必须早于结束时间');
const simpleShape = { metadataId: z.string().uuid(), operator: operatorSchema, value: ruleValueSchema };
export const ruleSchema = z.discriminatedUnion('metadataType', [
  z.object({ metadataType: z.literal('TAG'), ...simpleShape }).strict(),
  z.object({ metadataType: z.literal('ATTRIBUTE'), ...simpleShape }).strict(),
  z.object({
    metadataType: z.literal('EVENT'), eventId: z.string().uuid(), timeRange: timeRangeSchema,
    dimensionFilters: z.array(z.object({ dimensionId: z.string().uuid(), operator: operatorSchema, value: ruleValueSchema }).strict()).max(30),
    aggregation: z.object({ type: z.enum(['COUNT', 'SUM', 'AVG', 'MAX', 'MIN']), metricId: z.string().uuid().nullable() }).strict(),
    operator: z.enum(['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN']),
    value: z.union([z.number().finite(), z.tuple([z.number().finite(), z.number().finite()])]),
  }).strict(),
]);
export const rulesSchema = z.array(z.array(ruleSchema).min(1, '规则组至少需要一条规则').max(50)).min(1, '至少需要一个规则组').max(20);
export const audienceSchema = z.object({
  name: nameSchema, audienceCode: codeSchema, description: z.string().max(1000).default(''),
  status: z.enum(['DRAFT', 'CONFIGURED', 'DISABLED']).default('CONFIGURED'),
  rules: rulesSchema, schemaVersion: z.literal(1).default(1),
}).strict();
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100).optional(), status: z.enum(['ENABLED', 'DISABLED', 'DRAFT', 'CONFIGURED']).optional(),
  type: z.enum(['TAG', 'ATTRIBUTE', 'EVENT']).optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('updatedAt'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
}).strict();

export const aiAudienceResourceTypeSchema = z.enum(['TAG', 'ATTRIBUTE', 'EVENT', 'DIMENSION', 'METRIC']);
export const aiAudienceParameterSourceSchema = z.enum(['USER_EXPLICIT', 'METADATA_DEFINED', 'AI_DERIVED']);
export const aiAudienceResourceRefSchema = z.object({
  resourceType: aiAudienceResourceTypeSchema,
  resourceId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
}).strict();
export const aiAudienceClarificationSchema = z.object({
  key: z.string().trim().min(1).max(64),
  sourceText: z.string().trim().min(1).max(300),
  resourceType: aiAudienceResourceTypeSchema,
  resourceId: z.string().uuid(),
}).strict();
export const aiAudienceGenerateRequestSchema = z.object({
  prompt: z.string().trim().min(1, '请输入人群特点').max(1000, '人群描述不能超过 1000 个字符'),
  clarifications: z.array(aiAudienceClarificationSchema).max(20).default([]),
}).strict();
export const usernameSchema = z.string().trim().toLowerCase().min(3, '用户名至少 3 个字符').max(64, '用户名不能超过 64 个字符')
  .regex(/^[a-z0-9][a-z0-9._-]*$/, '用户名只能包含小写字母、数字、点、下划线和连字符');
export const authLoginInputSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, '请输入密码').max(256, '密码不能超过 256 个字符'),
}).strict();
export const userRoleSchema = z.enum(['ADMIN', 'USER']);
export const authUserSchema = z.object({
  id: z.string().uuid(), username: usernameSchema, displayName: z.string().trim().min(1).max(100), role: userRoleSchema,
}).strict();
const userPasswordSchema = z.string().min(12, '密码至少 12 个字符').max(256, '密码不能超过 256 个字符');
export const managedUserSchema = authUserSchema.extend({
  status: statusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export const createUserInputSchema = z.object({
  username: usernameSchema,
  password: userPasswordSchema,
  displayName: z.string().trim().min(1, '显示名称不能为空').max(100),
  role: userRoleSchema.default('USER'),
  status: statusSchema.default('ENABLED'),
}).strict();
export const updateUserInputSchema = z.object({
  username: usernameSchema.optional(),
  password: userPasswordSchema.optional(),
  displayName: z.string().trim().min(1, '显示名称不能为空').max(100).optional(),
  role: userRoleSchema.optional(),
  status: statusSchema.optional(),
}).strict().refine(value => Object.keys(value).length > 0, '至少需要修改一个字段');
export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(100).optional(),
  role: userRoleSchema.optional(),
  status: statusSchema.optional(),
}).strict();
export const aiAudienceSignalSchema = aiAudienceResourceRefSchema.extend({
  role: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(300),
});
export const aiAudienceParameterSchema = z.object({
  path: z.string().regex(/^rules\[\d+\]\[\d+\](?:\.[A-Za-z][A-Za-z0-9]*|\[\d+\])*$/).max(200),
  label: z.string().trim().min(1).max(100),
  value: z.union([ruleValueSchema, timeRangeSchema]),
  displayValue: z.string().trim().min(1).max(200),
  source: aiAudienceParameterSourceSchema,
  explanation: z.string().trim().min(1).max(300),
}).strict();
export const aiAudienceDerivationSchema = z.object({
  concept: z.string().trim().min(1).max(100),
  suggestedDefinition: z.string().trim().min(1).max(500),
  signals: z.array(aiAudienceSignalSchema).min(1).max(10),
}).strict();
const aiRulePathSchema = z.string().regex(/^rules\[\d+\]\[\d+\]$/).max(64);
const aiCandidateSchema = aiAudienceResourceRefSchema.extend({ description: z.string().trim().max(300).default('') });
const aiMappingBase = {
  key: z.string().trim().min(1).max(64),
  sourceText: z.string().trim().min(1).max(300),
  explanation: z.string().trim().min(1).max(500),
};
export const aiAudienceMappingSchema = z.discriminatedUnion('status', [
  z.object({
    ...aiMappingBase, status: z.literal('MAPPED'), resource: aiAudienceResourceRefSchema,
    rulePaths: z.array(aiRulePathSchema).min(1).max(20), parameters: z.array(aiAudienceParameterSchema).max(30).default([]),
    derivation: z.null().default(null), candidates: z.array(aiCandidateSchema).max(0).default([]),
  }).strict(),
  z.object({
    ...aiMappingBase, status: z.literal('DERIVED'), resource: z.null(),
    rulePaths: z.array(aiRulePathSchema).min(1).max(20), parameters: z.array(aiAudienceParameterSchema).min(1).max(30),
    derivation: aiAudienceDerivationSchema, candidates: z.array(aiCandidateSchema).max(0).default([]),
  }).strict(),
  z.object({
    ...aiMappingBase, status: z.literal('NEEDS_CONFIRMATION'), resource: z.null(), rulePaths: z.array(aiRulePathSchema).max(0).default([]),
    parameters: z.array(aiAudienceParameterSchema).max(0).default([]), derivation: z.null().default(null),
    candidates: z.array(aiCandidateSchema).min(1).max(5),
  }).strict(),
  z.object({
    ...aiMappingBase, status: z.literal('UNMAPPED'), resource: z.null(), rulePaths: z.array(aiRulePathSchema).max(0).default([]),
    parameters: z.array(aiAudienceParameterSchema).max(0).default([]), derivation: z.null().default(null),
    candidates: z.array(aiCandidateSchema).max(0).default([]),
  }).strict(),
]);
export const aiAudienceGenerateResultSchema = z.object({
  requestId: z.string().uuid(),
  catalogRevision: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  summary: z.string().trim().min(1).max(1000),
  rules: rulesSchema.nullable(),
  mappings: z.array(aiAudienceMappingSchema).min(1).max(100),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
  requiresConfirmation: z.boolean(),
  hasUnmappedSegments: z.boolean(),
}).strict().superRefine((result, context) => {
  const requiresConfirmation = result.mappings.some(mapping => mapping.status === 'NEEDS_CONFIRMATION');
  const hasUnmappedSegments = result.mappings.some(mapping => mapping.status === 'UNMAPPED');
  const hasRules = result.mappings.some(mapping => mapping.status === 'MAPPED' || mapping.status === 'DERIVED');
  if (result.requiresConfirmation !== requiresConfirmation)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['requiresConfirmation'], message: '确认状态与映射结果不一致' });
  if (result.hasUnmappedSegments !== hasUnmappedSegments)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['hasUnmappedSegments'], message: '未映射状态与映射结果不一致' });
  if ((result.rules !== null) !== hasRules)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['rules'], message: '规则草稿与映射结果不一致' });
});
export type ListQuery = z.infer<typeof listQuerySchema>;
export type AudienceRule = z.infer<typeof ruleSchema>;
export type AudienceRules = z.infer<typeof rulesSchema>;
export type EventRule = Extract<AudienceRule, { metadataType: 'EVENT' }>;
export type SimpleRule = Exclude<AudienceRule, EventRule>;
export type RuleValue = z.infer<typeof ruleValueSchema>;
export type FieldInput = z.infer<typeof fieldSchema>;
export type MetadataInput = z.infer<typeof metadataSchema>;
export type AudienceInput = z.infer<typeof audienceSchema>;
export type Entity = { id: string; createdAt: string; updatedAt: string };
export type EnumValue = z.infer<typeof enumSchema> & Entity;
export type Metadata = MetadataInput & Entity & { enumValues?: EnumValue[] };
export type Dimension = FieldInput & Entity & { eventModelId: string; enumValues?: EnumValue[] };
export type Metric = z.infer<typeof metricSchema> & Entity & { eventModelId: string };
export type EventModel = z.infer<typeof eventSchema> & Entity & { dimensions?: Dimension[]; metrics?: Metric[] };
export type Audience = AudienceInput & Entity & { revision: number; ruleCount: number };
export type AudienceSummary = Omit<Audience, 'rules'>;
export type Field = FieldInput & { id: string; enumValues?: EnumValue[] };
export type Catalog = { metadata: Metadata[]; events: EventModel[] };
export type ValidationIssue = { path: string; message: string };
export type ListResponse<T> = { data: T[]; pagination: { page: number; pageSize: number; total: number } };
export type ApiErrorBody = { error: { code: string; message: string; details: ValidationIssue[]; requestId: string } };
export type AiAudienceResourceType = z.infer<typeof aiAudienceResourceTypeSchema>;
export type AiAudienceResourceRef = z.infer<typeof aiAudienceResourceRefSchema>;
export type AiAudienceClarification = z.infer<typeof aiAudienceClarificationSchema>;
export type AiAudienceGenerateRequest = z.infer<typeof aiAudienceGenerateRequestSchema>;
export type AuthLoginInput = z.infer<typeof authLoginInputSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type ManagedUser = z.infer<typeof managedUserSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type AiAudienceSignal = z.infer<typeof aiAudienceSignalSchema>;
export type AiAudienceParameter = z.infer<typeof aiAudienceParameterSchema>;
export type AiAudienceMapping = z.infer<typeof aiAudienceMappingSchema>;
export type AiAudienceGenerateResult = z.infer<typeof aiAudienceGenerateResultSchema>;

export function fieldIssues(field: FieldInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!displayTypes[field.dataType].includes(field.displayType))
    issues.push({ path: 'displayType', message: '展示类型与数据类型不兼容' });
  if (field.isEnum !== ['SELECT', 'MULTI_SELECT'].includes(field.displayType))
    issues.push({ path: 'isEnum', message: '枚举字段必须使用下拉展示，非枚举字段不能使用下拉展示' });
  return issues;
}

export function validScalar(dataType: DataType, value: unknown): boolean {
  if (dataType === 'Number') return typeof value === 'number' && Number.isFinite(value);
  if (dataType === 'Boolean') return typeof value === 'boolean';
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (dataType === 'Date') {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  if (dataType === 'DateTime') return z.string().datetime({ offset: true }).safeParse(value).success;
  return true;
}

export function conditionIssues(field: Field, operator: Operator, value: RuleValue, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (suffix: string, message: string) => issues.push({ path: `${path}.${suffix}`, message });
  if (!operators[field.dataType].includes(operator)) add('operator', '操作符与数据类型不兼容');
  if (operator === 'IS_NULL' || operator === 'IS_NOT_NULL') {
    if (value !== null) add('value', '空值操作符必须保存 null');
    return issues;
  }
  const arrayOperator = ['IN', 'NOT_IN', 'BETWEEN'].includes(operator);
  if (arrayOperator ? !Array.isArray(value) || !value.length : Array.isArray(value))
    add('value', arrayOperator ? '请填写非空值列表' : '该操作符只接受一个值');
  const values = Array.isArray(value) ? value : [value];
  if (values.some(item => !validScalar(field.dataType, item))) add('value', '值不能为空，且必须符合字段的数据类型');
  if (operator === 'BETWEEN' && (values.length !== 2 || values[0] === null || values[1] === null || compare(values[0], field.dataType) > compare(values[1], field.dataType)))
    add('value', '区间需要两个有序边界');
  if (field.isEnum && values.some(item => !field.enumValues?.some(option => option.value === item && option.status === 'ENABLED')))
    add('value', '枚举值不存在、已停用或不属于当前字段');
  return issues;
}

function compare(value: string | number | boolean, type: DataType): string | number {
  return type === 'DateTime' ? Date.parse(String(value)) : typeof value === 'boolean' ? Number(value) : value;
}

export function validateRules(input: unknown, catalog: Catalog): ValidationIssue[] {
  const parsed = rulesSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map(issue => ({
    path: `rules${issue.path.map(part => typeof part === 'number' ? `[${part}]` : `.${part}`).join('')}`, message: issue.message,
  }));
  const issues: ValidationIssue[] = [];
  parsed.data.forEach((group, groupIndex) => group.forEach((rule, ruleIndex) => {
    const path = `rules[${groupIndex}][${ruleIndex}]`;
    const checkEnabled = (target: { status: string } | undefined, suffix: string) => {
      if (!target || target.status !== 'ENABLED') issues.push({ path: `${path}.${suffix}`, message: '引用对象不存在或已停用，请重新选择' });
      return target?.status === 'ENABLED';
    };
    if (rule.metadataType !== 'EVENT') {
      const field = catalog.metadata.find(item => item.id === rule.metadataId && item.metadataType === rule.metadataType);
      if (checkEnabled(field, 'metadataId') && field) issues.push(...conditionIssues(field, rule.operator, rule.value, path));
      return;
    }
    const event = catalog.events.find(item => item.id === rule.eventId);
    if (!checkEnabled(event, 'eventId') || !event) return;
    rule.dimensionFilters.forEach((filter, filterIndex) => {
      const dimension = event.dimensions?.find(item => item.id === filter.dimensionId);
      if (checkEnabled(dimension, `dimensionFilters[${filterIndex}].dimensionId`) && dimension)
        issues.push(...conditionIssues(dimension, filter.operator, filter.value, `${path}.dimensionFilters[${filterIndex}]`));
    });
    if (rule.aggregation.type === 'COUNT') {
      if (rule.aggregation.metricId !== null) issues.push({ path: `${path}.aggregation.metricId`, message: 'COUNT 不允许关联业务指标' });
      const values = Array.isArray(rule.value) ? rule.value : [rule.value];
      if (values.some(value => value < 0 || !Number.isInteger(value))) issues.push({ path: `${path}.value`, message: '事件次数必须为非负整数' });
    } else {
      const metric = event.metrics?.find(item => item.id === rule.aggregation.metricId && item.dataType === 'Number');
      checkEnabled(metric, 'aggregation.metricId');
    }
    const numericField: Field = { id: '', name: '', fieldName: '', description: '', status: 'ENABLED', dataType: 'Number', displayType: 'NUMBER', isEnum: false };
    issues.push(...conditionIssues(numericField, rule.operator, rule.value, path));
  }));
  return issues;
}

export function referenced(rules: AudienceRules, kind: 'metadata' | 'events' | 'dimensions' | 'metrics' | 'metadataValues' | 'dimensionValues', id: string, ownerId?: string, value?: string | number): boolean {
  const containsValue = (actual: RuleValue) => Array.isArray(actual) ? actual.includes(value as string | number) : actual === value;
  return rules.some(group => group.some(rule => {
    if (rule.metadataType !== 'EVENT')
      return kind === 'metadata' ? rule.metadataId === id : kind === 'metadataValues' && rule.metadataId === ownerId && containsValue(rule.value);
    if (kind === 'events') return rule.eventId === id;
    if (kind === 'metrics') return rule.aggregation.metricId === id;
    if (kind === 'dimensions') return rule.dimensionFilters.some(filter => filter.dimensionId === id);
    if (kind === 'dimensionValues') return rule.dimensionFilters.some(filter => filter.dimensionId === ownerId && containsValue(filter.value));
    return false;
  }));
}
