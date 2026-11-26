import { describe, expect, it } from 'vitest';
import { aiAudienceGenerateRequestSchema, aiAudienceGenerateResultSchema, type AudienceRules } from './index';

const eventId = '11111111-1111-4111-8111-111111111111';
const rules: AudienceRules = [[{
  metadataType: 'EVENT', eventId, timeRange: { type: 'RELATIVE', unit: 'DAY', value: 7 }, dimensionFilters: [],
  aggregation: { type: 'COUNT', metricId: null }, operator: 'GTE', value: 1,
}]];

describe('AI 圈人共享契约', () => {
  it('清理输入并拒绝客户端注入额外配置', () => {
    expect(aiAudienceGenerateRequestSchema.parse({ prompt: '  最近活跃用户  ' })).toEqual({ prompt: '最近活跃用户', clarifications: [] });
    expect(aiAudienceGenerateRequestSchema.safeParse({ prompt: '活跃用户', model: 'override' }).success).toBe(false);
  });

  it('接受带参数来源的推导型规则', () => {
    const result = aiAudienceGenerateResultSchema.parse({
      requestId: '22222222-2222-4222-8222-222222222222', catalogRevision: `sha256:${'a'.repeat(64)}`,
      summary: '最近 7 天至少购买 1 次', rules,
      mappings: [{
        key: 'activity', sourceText: '最近活跃用户', status: 'DERIVED', resource: null,
        rulePaths: ['rules[0][0]'], explanation: '使用近期购买作为活跃代理信号', candidates: [],
        derivation: {
          concept: '近期活跃', suggestedDefinition: '最近 7 天至少购买 1 次',
          signals: [{ resourceType: 'EVENT', resourceId: eventId, name: '商品购买', role: '近期参与', reason: '可观察真实业务互动' }],
        },
        parameters: [{
          path: 'rules[0][0].timeRange', label: '时间窗口', value: { type: 'RELATIVE', unit: 'DAY', value: 7 },
          displayValue: '最近 7 天', source: 'AI_DERIVED', explanation: '将最近几天解释为 7 天',
        }],
      }],
      warnings: [], requiresConfirmation: false, hasUnmappedSegments: false,
    });
    expect(result.mappings[0].status).toBe('DERIVED');
  });

  it('拒绝与映射状态不一致的规则结果', () => {
    expect(aiAudienceGenerateResultSchema.safeParse({
      requestId: '22222222-2222-4222-8222-222222222222', catalogRevision: `sha256:${'b'.repeat(64)}`,
      summary: '无法映射', rules,
      mappings: [{ key: 'missing', sourceText: '未知概念', status: 'UNMAPPED', resource: null, explanation: '没有相关信号' }],
      warnings: [], requiresConfirmation: false, hasUnmappedSegments: true,
    }).success).toBe(false);
  });
});
