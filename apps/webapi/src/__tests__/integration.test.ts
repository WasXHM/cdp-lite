import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { randomUUID } from 'node:crypto';
import type { Audience, AudienceRules, Dimension, EnumValue, EventModel, EventRule, Metadata, Metric } from '@cdp/contracts';

const enabled = process.env.CDP_INTEGRATION === '1';
describe.skipIf(!enabled)('MySQL 8 API 集成验收', () => {
  let api: ReturnType<typeof supertest>;
  let database: (typeof import('../config/database.js'))['database'];
  const cleanups: string[] = [];
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  let tag: Metadata;
  let age: Metadata;
  let event: EventModel;
  let otherEvent: EventModel;
  let dimension: Dimension;
  let metric: Metric;
  let enumValue: EnumValue;
  let dimensionValue: EnumValue;
  let audience: Audience;
  let rules: AudienceRules;
  const create = async <T>(path: string, body: object): Promise<T> => {
    const response = await api.post(`/api/v1${path}`).send(body).expect(201);
    cleanups.push(`${path}/${response.body.data.id}`);
    return response.body.data as T;
  };
  const field = { name: '测试字段', dataType: 'String', displayType: 'SELECT', isEnum: true };
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_NAME = 'cdp_lite_test';
    process.env.DATABASE_PORT = process.env.CDP_TEST_DATABASE_PORT || '3307';
    process.env.DATABASE_HOST = '127.0.0.1';
    process.env.DATABASE_USER = 'cdp_lite';
    process.env.DATABASE_PASSWORD = 'change_me';
    database = (await import('../config/database.js')).database;
    await (await import('../migrations/run.js')).migrate();
    api = supertest((await import('../app.js')).createApp().callback());
    tag = await create('/metadata', { ...field, metadataType: 'TAG', fieldName: `tag_${suffix}` });
    enumValue = await create(`/metadata/${tag.id}/enum-values`, { label: '金卡', value: 'GOLD' });
    age = await create('/metadata', { ...field, metadataType: 'ATTRIBUTE', fieldName: `age_${suffix}`, dataType: 'Number', displayType: 'NUMBER', isEnum: false });
    event = await create('/event-models', { name: '购买测试', eventCode: `purchase_${suffix}` });
    otherEvent = await create('/event-models', { name: '其他事件', eventCode: `other_${suffix}` });
    dimension = await create(`/event-models/${event.id}/dimensions`, { ...field, fieldName: 'category' });
    dimensionValue = await create(`/event-models/${event.id}/dimensions/${dimension.id}/values`, { label: '数码', value: 'DIGITAL' });
    metric = await create(`/event-models/${event.id}/metrics`, { name: '金额', fieldName: 'amount', dataType: 'Number' });
    rules = [[
      { metadataType: 'TAG', metadataId: tag.id, operator: 'EQ', value: 'GOLD' },
      { metadataType: 'ATTRIBUTE', metadataId: age.id, operator: 'GTE', value: 25 },
      { metadataType: 'EVENT', eventId: event.id, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 30 }, dimensionFilters: [{ dimensionId: dimension.id, operator: 'EQ', value: 'DIGITAL' }], aggregation: { type: 'SUM', metricId: metric.id }, operator: 'GT', value: 1000 },
    ], [{ metadataType: 'ATTRIBUTE', metadataId: age.id, operator: 'BETWEEN', value: [18, 20] }]];
    audience = await create('/audiences', { name: '集成人群', audienceCode: `audience_${suffix}`, rules });
  }, 60000);
  afterAll(async () => {
    if (api) for (const path of cleanups.reverse()) await api.delete(`/api/v1${path}`);
    await database?.close();
  });
  it('保存后重新读取，二维数组与值类型完全一致', async () => {
    const response = await api.get(`/api/v1/audiences/${audience.id}`).expect(200);
    expect(response.body.data.rules).toEqual(rules);
    expect(response.body.data.revision).toBe(1);
    expect(response.body.data.schemaVersion).toBe(1);
    expect(response.body.data.ruleCount).toBe(4);
  });
  it('列表分页不暴露完整规则', async () => {
    const response = await api.get(`/api/v1/audiences?keyword=${suffix}&pageSize=1`).expect(200);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.data[0].rules).toBeUndefined();
  });
  it('错误包含请求标识与字段详情，限制分页和输入字段', async () => {
    const response = await api.get('/api/v1/metadata?pageSize=101').expect(400);
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
    expect(response.body.error.details[0].path).toBe('pageSize');
    await api.post('/api/v1/metadata').send({ ...field, metadataType: 'TAG', fieldName: 'bad', injection: true }).expect(400);
  });
  it('跨维度与指标字段编码唯一', async () => {
    await api.post(`/api/v1/event-models/${event.id}/metrics`).send({ name: '重复', fieldName: 'category' }).expect(409);
  });
  it('数据库约束拒绝重复技术编码', async () => {
    await api.post('/api/v1/metadata').send({ ...field, metadataType: 'TAG', fieldName: tag.fieldName }).expect(409);
  });
  it('子资源不能通过其他行为模型的路径修改', async () => {
    await api.patch(`/api/v1/event-models/${otherEvent.id}/dimensions/${dimension.id}`).send({ name: '跨模型' }).expect(404);
    await api.delete(`/api/v1/event-models/${otherEvent.id}/dimensions/${dimension.id}/values/${dimensionValue.id}`).expect(404);
    await api.patch(`/api/v1/event-models/${otherEvent.id}/metrics/${metric.id}`).send({ name: '跨模型' }).expect(404);
  });
  it('服务端拒绝跨模型维度与指标引用', async () => {
    const invalid = structuredClone(rules);
    (invalid[0][2] as EventRule).eventId = otherEvent.id;
    const response = await api.post('/api/v1/audiences/validate-rules').send({ rules: invalid }).expect(422);
    expect(response.body.error.details.map((issue: { path: string }) => issue.path)).toContain('rules[0][2].aggregation.metricId');
  });
  it('拒绝非法操作符、空枚举、时间、COUNT 指标和倒序边界', async () => {
    const invalidRules = [
      [[{ metadataType: 'ATTRIBUTE', metadataId: age.id, operator: 'CONTAINS', value: 1 }]],
      [[{ metadataType: 'TAG', metadataId: tag.id, operator: 'IN', value: [] }]],
      [[{ metadataType: 'TAG', metadataId: tag.id, operator: 'EQ', value: 'MISSING' }]],
      [[{ ...rules[0][2], timeRange: { type: 'RELATIVE', unit: 'DAY', value: 0 } }]],
      [[{ ...rules[0][2], aggregation: { type: 'COUNT', metricId: metric.id } }]],
      [[{ metadataType: 'ATTRIBUTE', metadataId: age.id, operator: 'BETWEEN', value: [30, 20] }]],
    ];
    for (const invalid of invalidRules) await api.post('/api/v1/audiences/validate-rules').send({ rules: invalid }).expect(422);
    await api.patch(`/api/v1/audiences/${audience.id}`).send({ revision: 1, rules: invalidRules[2] }).expect(422);
    expect((await api.get(`/api/v1/audiences/${audience.id}`)).body.data.revision).toBe(1);
  });
  it('所有被引用资源均拒绝物理删除', async () => {
    for (const path of [
      `/metadata/${tag.id}`, `/metadata/${age.id}`, `/metadata/${tag.id}/enum-values/${enumValue.id}`,
      `/event-models/${event.id}`, `/event-models/${event.id}/dimensions/${dimension.id}`,
      `/event-models/${event.id}/dimensions/${dimension.id}/values/${dimensionValue.id}`, `/event-models/${event.id}/metrics/${metric.id}`,
    ]) expect((await api.delete(`/api/v1${path}`).expect(409)).body.error.code).toBe('RESOURCE_REFERENCED');
  });
  it('引用中的枚举编码不可修改，但展示名可以修改', async () => {
    await api.patch(`/api/v1/metadata/${tag.id}/enum-values/${enumValue.id}`).send({ value: 'NEW' }).expect(409);
    await api.patch(`/api/v1/metadata/${tag.id}/enum-values/${enumValue.id}`).send({ label: '新名称' }).expect(200);
    await api.patch(`/api/v1/metadata/${tag.id}`).send({ dataType: 'Number' }).expect(409);
  });
  it('停用后旧引用保留，新规则校验失败', async () => {
    await api.patch(`/api/v1/metadata/${tag.id}`).send({ status: 'DISABLED' }).expect(200);
    expect((await api.get(`/api/v1/audiences/${audience.id}`)).body.data.rules).toEqual(rules);
    await api.post('/api/v1/audiences/validate-rules').send({ rules }).expect(422);
    const catalog = await api.get('/api/v1/rule-catalog?type=TAG').expect(200);
    expect(catalog.body.data.some((row: { id: string }) => row.id === tag.id)).toBe(false);
    await api.patch(`/api/v1/metadata/${tag.id}`).send({ status: 'ENABLED' }).expect(200);
  });
  it('复制生成独立 ID、唯一编码和草稿状态', async () => {
    const copied = await api.post(`/api/v1/audiences/${audience.id}/copy`).send({}).expect(201);
    cleanups.push(`/audiences/${copied.body.data.id}`);
    expect(copied.body.data.id).not.toBe(audience.id);
    expect(copied.body.data.audienceCode).not.toBe(audience.audienceCode);
    expect(copied.body.data.rules).toEqual(rules);
    expect(copied.body.data.status).toBe('DRAFT');
    await api.patch(`/api/v1/audiences/${copied.body.data.id}`).send({ revision: 1, name: '副本重命名' }).expect(200);
    expect((await api.get(`/api/v1/audiences/${audience.id}`)).body.data.name).toBe('集成人群');
  });
  it('并发修改仅允许一个相同 revision 的请求成功', async () => {
    const responses = await Promise.all([
      api.patch(`/api/v1/audiences/${audience.id}`).send({ revision: 1, name: '并发 A' }),
      api.patch(`/api/v1/audiences/${audience.id}`).send({ revision: 1, name: '并发 B' }),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await api.get(`/api/v1/audiences/${audience.id}`)).body.data.revision).toBe(2);
  });
  it('并发新增引用与删除操作不会产生悬空引用', async () => {
    const target = await create<Metadata>('/metadata', { ...field, metadataType: 'TAG', fieldName: `race_${suffix}`, isEnum: false, displayType: 'TEXT' });
    const body = { name: '引用竞态', audienceCode: `race_${suffix}`, rules: [[{ metadataType: 'TAG', metadataId: target.id, operator: 'EQ', value: 'x' }]] };
    const [save, remove] = await Promise.all([api.post('/api/v1/audiences').send(body), api.delete(`/api/v1/metadata/${target.id}`)]);
    if (save.status === 201) { cleanups.push(`/audiences/${save.body.data.id}`); expect(remove.status).toBe(409); }
    else { expect(save.status).toBe(422); expect(remove.status).toBe(204); }
  });
  it('数值枚举以 number 往返，部分更新不丢失类型', async () => {
    const numeric = await create<Metadata>('/metadata', { ...field, metadataType: 'ATTRIBUTE', fieldName: `numeric_${suffix}`, dataType: 'Number' });
    const option = await create<EnumValue>(`/metadata/${numeric.id}/enum-values`, { label: '一级', value: 1 });
    expect(option.value).toBe(1);
    const updated = await api.patch(`/api/v1/metadata/${numeric.id}/enum-values/${option.id}`).send({ label: '一等级' }).expect(200);
    expect(updated.body.data.value).toBe(1);
    const detail = await api.get(`/api/v1/metadata/${numeric.id}`).expect(200);
    expect(detail.body.data.enumValues[0].value).toBe(1);
  });
  it('限制跨来源写入', async () => {
    await api.post('/api/v1/audiences/validate-rules').set('Origin', 'https://untrusted.example').send({ rules }).expect(403);
  });
});
