import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { stringify } from 'yaml';
import { aiAudienceGenerateRequestSchema, aiAudienceGenerateResultSchema, audienceSchema, authLoginInputSchema, authUserSchema, createUserInputSchema, enumSchema, eventSchema, fieldSchema, managedUserSchema, metadataSchema, metricSchema, rulesSchema, updateUserInputSchema } from '@cdp/contracts';

const entity = { id: z.string().uuid(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() };
const enumValue = enumSchema.extend(entity);
const dimension = fieldSchema.extend({ ...entity, eventModelId: z.string().uuid(), enumValues: z.array(enumValue).optional() });
const metric = metricSchema.extend({ ...entity, eventModelId: z.string().uuid() });
const audience = audienceSchema.extend({ ...entity, revision: z.number().int().positive(), ruleCount: z.number().int().nonnegative() });
const sourceSchemas = {
  MetadataInput: metadataSchema, MetadataPatch: metadataSchema.partial(),
  Metadata: metadataSchema.extend({ ...entity, enumValues: z.array(enumValue).optional() }),
  EnumInput: enumSchema, EnumPatch: enumSchema.partial(), EnumValue: enumValue,
  EventInput: eventSchema, EventPatch: eventSchema.partial(),
  EventModel: eventSchema.extend({ ...entity, dimensions: z.array(dimension).optional(), metrics: z.array(metric).optional() }),
  DimensionInput: fieldSchema, DimensionPatch: fieldSchema.partial(), Dimension: dimension,
  MetricInput: metricSchema, MetricPatch: metricSchema.partial(), Metric: metric,
  AudienceInput: audienceSchema, AudiencePatch: audienceSchema.partial().extend({ revision: z.number().int().positive() }).strict(),
  Audience: audience, AudienceSummary: audience.omit({ rules: true }),
  Rules: rulesSchema,
  AiAudienceGenerateRequest: aiAudienceGenerateRequestSchema,
  AiAudienceGenerateResult: aiAudienceGenerateResultSchema,
  AuthLoginInput: authLoginInputSchema,
  AuthUser: authUserSchema,
  CreateUserInput: createUserInputSchema,
  UpdateUserInput: updateUserInputSchema,
  ManagedUser: managedUserSchema,
  Error: z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.array(z.object({ path: z.string(), message: z.string() })), requestId: z.string().uuid() }) }),
  Pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().min(1).max(100), total: z.number().int().nonnegative() }),
};
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ 'application/json': { schema } });
const body = (schema: object) => ({ required: true, content: json(schema) });
const success = (schema: object) => ({ description: '成功', content: json({ type: 'object', required: ['data'], properties: { data: schema } }) });
const failure = { $ref: '#/components/responses/Error' };
const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
  { name: 'keyword', in: 'query', schema: { type: 'string', maxLength: 100 } },
  { name: 'status', in: 'query', schema: { type: 'string', enum: ['ENABLED', 'DISABLED', 'DRAFT', 'CONFIGURED'] } },
  { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['name', 'createdAt', 'updatedAt'], default: 'updatedAt' } },
  { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'], default: 'DESC' } },
];
const pathParams = (path: string) => [...path.matchAll(/\{(\w+)\}/g)].map(match => ({ name: match[1], in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }));
const listResponse = (name: string) => ({
  description: '分页列表', content: json({ type: 'object', required: ['data', 'pagination'], properties: { data: { type: 'array', items: ref(name) }, pagination: ref('Pagination') } }),
});
const paths: Record<string, unknown> = {};
paths['/auth/login'] = {
  post: {
    summary: '用户名密码登录', tags: ['身份认证'], security: [], requestBody: body(ref('AuthLoginInput')),
    responses: { 200: success(ref('AuthUser')), default: failure },
  },
};
paths['/auth/me'] = {
  get: { summary: '读取当前登录用户', tags: ['身份认证'], responses: { 200: success(ref('AuthUser')), default: failure } },
};
paths['/auth/logout'] = {
  post: { summary: '注销当前会话', tags: ['身份认证'], security: [], responses: { 204: { description: '注销成功，无响应体' }, default: failure } },
};
paths['/users'] = {
  get: {
    summary: '用户列表（仅系统管理员）', tags: ['用户管理'],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
      { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
      { name: 'keyword', in: 'query', schema: { type: 'string', maxLength: 100 } },
      { name: 'role', in: 'query', schema: { type: 'string', enum: ['ADMIN', 'USER'] } },
      { name: 'status', in: 'query', schema: { type: 'string', enum: ['ENABLED', 'DISABLED'] } },
    ],
    responses: { 200: listResponse('ManagedUser'), default: failure },
  },
  post: {
    summary: '创建用户（仅系统管理员）', tags: ['用户管理'], requestBody: body(ref('CreateUserInput')),
    responses: { 201: success(ref('ManagedUser')), default: failure },
  },
};
paths['/users/{id}'] = {
  parameters: pathParams('/users/{id}'),
  patch: {
    summary: '更新用户或重置密码（仅系统管理员）', tags: ['用户管理'], requestBody: body(ref('UpdateUserInput')),
    responses: { 200: success(ref('ManagedUser')), default: failure },
  },
  delete: {
    summary: '删除用户（仅系统管理员）', tags: ['用户管理'],
    description: '不能删除当前登录用户；系统必须始终保留至少一个已启用的系统管理员。',
    responses: { 204: { description: '删除成功，无响应体' }, default: failure },
  },
};
const resources = [
  { path: '/metadata', name: 'Metadata', input: 'Metadata', title: '标签 / 属性', id: 'id', detail: true },
  { path: '/metadata/{id}/enum-values', name: 'EnumValue', input: 'Enum', title: '元数据枚举值', id: 'valueId', detail: false },
  { path: '/event-models', name: 'EventModel', input: 'Event', title: '行为模型', id: 'id', detail: true },
  { path: '/event-models/{id}/dimensions', name: 'Dimension', input: 'Dimension', title: '行为维度', id: 'dimensionId', detail: false },
  { path: '/event-models/{id}/dimensions/{dimensionId}/values', name: 'EnumValue', input: 'Enum', title: '维度枚举值', id: 'valueId', detail: false },
  { path: '/event-models/{id}/metrics', name: 'Metric', input: 'Metric', title: '行为指标', id: 'metricId', detail: false },
  { path: '/audiences', name: 'Audience', input: 'Audience', title: '人群', id: 'id', detail: true },
];
for (const resource of resources) {
  const listName = resource.name === 'Audience' ? 'AudienceSummary' : resource.name;
  const metadataType = resource.name === 'Metadata' ? [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['TAG', 'ATTRIBUTE'] } }] : [];
  paths[resource.path] = {
    parameters: pathParams(resource.path),
    get: { summary: `${resource.title}列表`, tags: [resource.title], parameters: [...pageParams, ...metadataType], responses: { 200: listResponse(listName), default: failure } },
    post: { summary: `创建${resource.title}`, tags: [resource.title], requestBody: body(ref(`${resource.input}Input`)), responses: { 201: success(ref(resource.name)), default: failure } },
  };
  const itemPath = `${resource.path}/{${resource.id}}`;
  paths[itemPath] = {
    parameters: pathParams(itemPath),
    ...(resource.detail ? { get: { summary: `${resource.title}详情`, tags: [resource.title], responses: { 200: success(ref(resource.name)), default: failure } } } : {}),
    patch: {
      summary: `部分更新${resource.title}`, tags: [resource.title],
      description: '编码、数据类型、枚举开关、所属父级不可改变；人群更新必须携带当前 revision。枚举值编码仅在未被引用时可修改。',
      requestBody: body(ref(`${resource.input}Patch`)), responses: { 200: success(ref(resource.name)), default: failure },
    },
    delete: { summary: `删除${resource.title}`, tags: [resource.title], description: '被引用资源返回 409；删除未引用父级时事务内删除其子资源。', responses: { 204: { description: '删除成功，无响应体' }, default: failure } },
  };
}
paths['/audiences/validate-rules'] = {
  post: { summary: '规则预校验', tags: ['人群'], requestBody: body({ type: 'object', additionalProperties: false, required: ['rules'], properties: { rules: ref('Rules') } }), responses: { 200: success({ type: 'object', properties: { valid: { const: true } } }), default: failure } },
};
paths['/audiences/generate-rules'] = {
  post: {
    summary: '根据人群特点生成直接映射或推导型规则草稿', tags: ['人群'],
    description: '仅使用启用元数据生成建议规则，不查询用户明细、不计算人群、不持久化。',
    requestBody: body(ref('AiAudienceGenerateRequest')),
    responses: { 200: success(ref('AiAudienceGenerateResult')), default: failure },
  },
};
paths['/audiences/{id}/copy'] = {
  parameters: pathParams('/audiences/{id}/copy'),
  post: { summary: '复制人群为独立草稿', tags: ['人群'], requestBody: { ...body({ type: 'object', additionalProperties: false }), required: false }, responses: { 201: success(ref('Audience')), default: failure } },
};
paths['/rule-catalog'] = {
  get: { summary: '启用的规则选项（不加载全部事件子资源）', parameters: [...pageParams, { name: 'type', in: 'query', required: true, schema: { type: 'string', enum: ['TAG', 'ATTRIBUTE', 'EVENT'] } }], responses: { 200: { description: '启用对象分页列表', content: json({ type: 'object', properties: { data: { type: 'array', items: { oneOf: [ref('Metadata'), ref('EventModel')] } }, pagination: ref('Pagination') } }) }, default: failure } },
};
function toSchema2020(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toSchema2020);
  if (!value || typeof value !== 'object') return value;
  const source = value as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(source).map(([key, entry]) => [key, toSchema2020(entry)]));
  if (Array.isArray(source.items)) {
    result.prefixItems = result.items;
    result.items = source.additionalItems === undefined ? true : toSchema2020(source.additionalItems);
    delete result.additionalItems;
  }
  return result;
}
const schemas = Object.fromEntries(Object.entries(sourceSchemas).map(([name, schema]) => {
  const converted = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' });
  delete converted.$schema;
  return [name, toSchema2020(converted)];
}));
const spec = {
  openapi: '3.1.0',
  info: {
    title: 'CDP Lite API', version: '1.3.0',
    description: '使用用户名密码和服务端会话进行身份认证。支持 AI 生成可审阅规则草稿，但只保存用户最终确认的规则，不执行人群计算。时间统一 UTC ISO 8601。',
  },
  servers: [{ url: 'http://localhost:3000/api/v1', description: '本地开发' }],
  security: [{ cookieAuth: [] }],
  paths,
  components: {
    securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'cdp_session' } },
    schemas,
    responses: { Error: { description: '统一错误；details.path 指向字段或具体规则', content: json(ref('Error')) } },
  },
};
await writeFile(new URL('../../../../docs/openapi.yaml', import.meta.url), stringify(spec), 'utf8');
console.info('已从共享 Zod 契约生成 docs/openapi.yaml');
