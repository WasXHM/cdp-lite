import { describe, expect, it } from 'vitest';
import type { AiRuleGenerationProvider, ProviderGenerationInput } from '../ai/provider';
import type { Catalog } from '@cdp/contracts';
import { AppError } from '../errors/AppError';
import { AiAudienceService } from './aiAudience';

const eventId = '11111111-1111-4111-8111-111111111111';
const ageId = '22222222-2222-4222-8222-222222222222';
const catalog: Catalog = {
  metadata: [{ id: ageId, metadataType: 'ATTRIBUTE', name: '年龄', fieldName: 'age', description: '用户年龄', dataType: 'Number', displayType: 'NUMBER', isEnum: false, status: 'ENABLED', createdAt: '', updatedAt: '' }],
  events: [{ id: eventId, name: '商品购买', eventCode: 'purchase', description: '用户完成商品购买，可观察近期交易参与', status: 'ENABLED', createdAt: '', updatedAt: '', dimensions: [], metrics: [] }],
};

const derivedOutput = {
  summary: '最近 7 天至少购买 1 次',
  rules: [[{
    metadataType: 'EVENT', eventId: 'E1', timeRange: { type: 'RELATIVE', unit: 'DAY', value: 7 }, dimensionFilters: [],
    aggregation: { type: 'COUNT', metricId: null }, operator: 'GTE', value: 1,
  }]],
  mappings: [{
    key: 'activity', sourceText: '最近几天的活跃用户', status: 'DERIVED', resourceAlias: null,
    rulePaths: ['rules[0][0]'], explanation: '没有活跃度字段，使用近期购买作为代理信号', candidateAliases: [],
    derivation: { concept: '近期活跃', suggestedDefinition: '最近 7 天至少购买 1 次', signals: [{ resourceAlias: 'E1', role: '近期参与', reason: '购买是实际业务互动' }] },
    parameters: [{ path: 'rules[0][0].timeRange', label: '时间窗口', displayValue: '最近 7 天', source: 'AI_DERIVED', explanation: '将最近几天解释为 7 天' }],
  }],
  warnings: ['该阈值为启发式建议'],
};

class SequenceProvider implements AiRuleGenerationProvider {
  calls: ProviderGenerationInput[] = [];
  constructor(private outputs: unknown[]) {}
  async generate(input: ProviderGenerationInput): Promise<unknown> {
    this.calls.push(input);
    return this.outputs[Math.min(this.calls.length - 1, this.outputs.length - 1)];
  }
}

const context = { requestId: '33333333-3333-4333-8333-333333333333', actorKey: 'test:127.0.0.1' };
const createService = (provider: AiRuleGenerationProvider, overrides: ConstructorParameters<typeof AiAudienceService>[0] = {}) => new AiAudienceService({
  provider, loadCatalog: async () => structuredClone(catalog), enabled: true, providerConfigured: true,
  rateLimitPerMinute: 20, maxConcurrent: 2, denyFieldNames: ['age'], ...overrides,
});

describe('AI 人群生成服务', () => {
  it('把推导规则别名解析为真实 ID，并保留参数来源', async () => {
    const provider = new SequenceProvider([derivedOutput]);
    const result = await createService(provider).generate({ prompt: '最近几天的活跃用户' }, context);
    expect(result.rules?.[0][0]).toMatchObject({ metadataType: 'EVENT', eventId, value: 1 });
    expect(result.mappings[0]).toMatchObject({ status: 'DERIVED', parameters: [{ source: 'AI_DERIVED', value: { type: 'RELATIVE', unit: 'DAY', value: 7 } }] });
    expect(provider.calls[0].catalog.events[0].alias).toBe('E1');
  });

  it('第一次输出非法时只修复一次', async () => {
    const provider = new SequenceProvider([{ invalid: true }, derivedOutput]);
    const result = await createService(provider).generate({ prompt: '最近几天的活跃用户' }, { ...context, actorKey: 'repair' });
    expect(result.rules).not.toBeNull();
    expect(provider.calls).toHaveLength(2);
    expect(provider.calls[1].repairIssues?.length).toBeGreaterThan(0);
  });

  it('拒绝用敏感字段隐式推导抽象概念', async () => {
    const output = {
      summary: '年龄大于 30 岁视为高价值',
      rules: [[{ metadataType: 'ATTRIBUTE', metadataId: 'A1', operator: 'GT', value: 30 }]],
      mappings: [{
        key: 'value', sourceText: '高价值用户', status: 'DERIVED', resourceAlias: null, rulePaths: ['rules[0][0]'],
        explanation: '使用年龄代理价值', candidateAliases: [],
        derivation: { concept: '高价值', suggestedDefinition: '年龄大于 30 岁', signals: [{ resourceAlias: 'A1', role: '代理', reason: '年龄' }] },
        parameters: [{ path: 'rules[0][0].value', label: '年龄', displayValue: '30', source: 'AI_DERIVED', explanation: '推导阈值' }],
      }], warnings: [],
    };
    await expect(createService(new SequenceProvider([output])).generate({ prompt: '高价值用户' }, { ...context, actorKey: 'deny' }))
      .rejects.toMatchObject({ code: 'AI_OUTPUT_INVALID' });
  });

  it('限制每分钟请求并识别功能未启用', async () => {
    const service = createService(new SequenceProvider([derivedOutput]), { rateLimitPerMinute: 1 });
    await service.generate({ prompt: '最近几天的活跃用户' }, { ...context, actorKey: 'limited' });
    await expect(service.generate({ prompt: '最近几天的活跃用户' }, { ...context, actorKey: 'limited' })).rejects.toMatchObject({ code: 'AI_RATE_LIMITED' });
    await expect(new AiAudienceService({ enabled: false }).generate({ prompt: '活跃用户' }, context)).rejects.toMatchObject({ code: 'AI_FEATURE_DISABLED' });
  });

  it('将 Provider 超时映射为稳定错误码', async () => {
    const provider: AiRuleGenerationProvider = { generate: (_input, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true })) };
    await expect(createService(provider, { timeoutMs: 5 }).generate({ prompt: '活跃用户' }, { ...context, actorKey: 'timeout' }))
      .rejects.toMatchObject({ code: 'AI_PROVIDER_TIMEOUT' });
  });

  it('对错误输入返回专用错误码', async () => {
    try { await createService(new SequenceProvider([derivedOutput])).generate({ prompt: '', model: 'override' }, { ...context, actorKey: 'invalid' }); }
    catch (error) { expect(error).toBeInstanceOf(AppError); expect((error as AppError).code).toBe('AI_PROMPT_INVALID'); }
  });
});
