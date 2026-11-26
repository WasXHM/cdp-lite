import type { ProviderCatalog } from './catalog.js';
import { AI_RULE_SYSTEM_PROMPT, buildProviderUserInput } from './prompt.js';

export type ProviderClarification = { key: string; sourceText: string; resourceAlias: string };
export type ProviderGenerationInput = {
  prompt: string;
  clarifications: ProviderClarification[];
  catalog: ProviderCatalog;
  repairIssues?: string[];
};

export interface AiRuleGenerationProvider {
  generate(input: ProviderGenerationInput, signal: AbortSignal): Promise<unknown>;
}

export class AiProviderError extends Error {
  constructor(public kind: 'UNAVAILABLE' | 'INVALID_RESPONSE', message: string) { super(message); }
}

export class DisabledAiProvider implements AiRuleGenerationProvider {
  async generate(): Promise<never> { throw new AiProviderError('UNAVAILABLE', 'AI Provider 未配置'); }
}

export class OpenAiCompatibleProvider implements AiRuleGenerationProvider {
  private endpoint: string;

  constructor(private options: { baseUrl: string; apiKey: string; model: string; maxOutputTokens: number }) {
    const baseUrl = options.baseUrl.replace(/\/$/, '');
    this.endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  }

  async generate(input: ProviderGenerationInput, signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST', signal,
        headers: { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0.2,
          max_tokens: this.options.maxOutputTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: AI_RULE_SYSTEM_PROMPT },
            { role: 'user', content: buildProviderUserInput(input) },
          ],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      throw new AiProviderError('UNAVAILABLE', '无法连接 AI Provider');
    }
    if (!response.ok) throw new AiProviderError('UNAVAILABLE', `AI Provider 返回 HTTP ${response.status}`);

    let body: { choices?: Array<{ message?: { content?: unknown } }> } | null;
    try {
      body = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    } catch {
      throw new AiProviderError('INVALID_RESPONSE', 'AI Provider 响应不是有效 JSON');
    }
    const content = body?.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || !content.trim()) throw new AiProviderError('INVALID_RESPONSE', 'AI Provider 未返回结构化内容');
    try { return JSON.parse(content) as unknown; }
    catch { throw new AiProviderError('INVALID_RESPONSE', 'AI Provider 返回内容不是有效 JSON'); }
  }
}
