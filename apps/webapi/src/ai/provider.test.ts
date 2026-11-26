import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerGenerateOutputSchema } from './output';
import { OpenAiCompatibleProvider, type ProviderGenerationInput } from './provider';

const generatedOutput = {
  summary: '将“最近几天的活跃用户”作为抽象活跃概念处理，暂按近 7 天定义。',
  rules: [[{ metadataType: 'ATTRIBUTE', metadataId: 'A10', operator: 'GTE', value: 'NOW-7D' }]],
  mappings: [{
    key: 'recent_active_users',
    sourceText: '最近几天的活跃用户',
    status: 'DERIVED',
    resourceAlias: null,
    rulePaths: ['rules[0][0]'],
    explanation: '使用最近活跃时间作为代理定义。',
    derivation: {
      concept: '最近几天的活跃用户',
      suggestedDefinition: '最近一次有效行为发生在当前时间前 7 天内的用户。',
      signals: [{ resourceAlias: 'A10', role: 'recent_activity_recency', reason: '记录用户最近一次有效行为时间。' }],
    },
    parameters: [{
      path: 'rules[0][0].value', label: '活跃时间窗口起点', displayValue: '当前时间前 7 天',
      source: 'AI_DERIVED', explanation: '暂以近 7 天作为窗口。',
    }],
    candidateAliases: [],
  }],
  warnings: ['建议确认时间窗口。'],
};

const input: ProviderGenerationInput = {
  prompt: '最近几天的活跃用户',
  clarifications: [],
  catalog: { metadata: [], events: [] },
};

afterEach(() => vi.unstubAllGlobals());

describe('OpenAI-compatible Provider', () => {
  it('只读取一次响应体并保留嵌套 JSON 结构', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: JSON.stringify(generatedOutput) } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleProvider({
      baseUrl: 'https://provider.example/v1', apiKey: 'test-key', model: 'test-model', maxOutputTokens: 3000,
    });

    const result = await provider.generate(input, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual(generatedOutput);
    expect(providerGenerateOutputSchema.parse(result)).toEqual(generatedOutput);
  });
});
