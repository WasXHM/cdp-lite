import { z } from 'zod';
import {
  aiAudienceGenerateRequestSchema, aiAudienceGenerateResultSchema, validateRules,
  type AiAudienceGenerateRequest, type AiAudienceGenerateResult, type Catalog, type EventModel, type Metadata,
} from '@cdp/contracts';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { repository } from '../repositories/resources.js';
import { resourceService } from './resources.js';
import { buildCatalogSnapshot, resourceAlias } from '../ai/catalog.js';
import { AiProviderError, DisabledAiProvider, OpenAiCompatibleProvider, type AiRuleGenerationProvider } from '../ai/provider.js';
import { resolveProviderOutput } from '../ai/output.js';

type GenerateContext = { requestId: string; actorKey: string; signal?: AbortSignal };
type CatalogLoader = () => Promise<Catalog>;
type AiAudienceServiceOptions = {
  provider?: AiRuleGenerationProvider;
  loadCatalog?: CatalogLoader;
  enabled?: boolean;
  providerConfigured?: boolean;
  timeoutMs?: number;
  rateLimitPerMinute?: number;
  maxConcurrent?: number;
  denyFieldNames?: string[];
};

class AiRateLimiter {
  private requests = new Map<string, number[]>();
  private concurrent = new Map<string, number>();

  constructor(private limit: number, private maxConcurrent: number) {}

  enter(key: string) {
    const now = Date.now();
    const recent = (this.requests.get(key) || []).filter(timestamp => timestamp > now - 60000);
    if (recent.length >= this.limit || (this.concurrent.get(key) || 0) >= this.maxConcurrent)
      throw new AppError(429, 'AI_RATE_LIMITED', 'AI 圈人请求较多，请稍后再试');
    recent.push(now);
    this.requests.set(key, recent);
    this.concurrent.set(key, (this.concurrent.get(key) || 0) + 1);
  }

  leave(key: string) {
    const next = Math.max(0, (this.concurrent.get(key) || 1) - 1);
    if (next) this.concurrent.set(key, next);
    else this.concurrent.delete(key);
  }
}

async function loadEnabledCatalog(): Promise<Catalog> {
  const metadataRows = await repository.all('metadata', { status: 'ENABLED' });
  const eventRows = await repository.all('events', { status: 'ENABLED' });
  const [metadata, events] = await Promise.all([
    Promise.all(metadataRows.map(row => resourceService.detail('metadata', row.id) as Promise<unknown>)),
    Promise.all(eventRows.map(row => resourceService.detail('events', row.id) as Promise<unknown>)),
  ]);
  return { metadata: metadata as Metadata[], events: events as EventModel[] };
}

function defaultProvider(): { provider: AiRuleGenerationProvider; configured: boolean } {
  const complete = env.AI_PROVIDER === 'openai-compatible' && !!env.AI_MODEL && !!env.AI_API_KEY && !!env.AI_BASE_URL;
  if (env.AI_RULE_GENERATION_ENABLED && !complete) throw new Error('AI 圈人已启用，但 AI_PROVIDER、AI_MODEL、AI_API_KEY 或 AI_BASE_URL 配置不完整');
  if (!complete)
    return { provider: new DisabledAiProvider(), configured: false };
  try { new URL(env.AI_BASE_URL); }
  catch { throw new Error('AI_BASE_URL 必须是有效 URL'); }
  return {
    provider: new OpenAiCompatibleProvider({
      baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL, maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    }),
    configured: true,
  };
}

function repairIssues(error: unknown): string[] {
  if (error instanceof z.ZodError) return error.issues.slice(0, 20).map(issue => `${issue.path.join('.')}: ${issue.message}`);
  if (error instanceof Error) return [error.message.slice(0, 300)];
  return ['输出无法通过结构或语义校验'];
}

export class AiAudienceService {
  private provider: AiRuleGenerationProvider;
  private loadCatalog: CatalogLoader;
  private enabled: boolean;
  private providerConfigured: boolean;
  private timeoutMs: number;
  private limiter: AiRateLimiter;
  private denyFieldNames: Set<string>;

  constructor(options: AiAudienceServiceOptions = {}) {
    const defaults = options.provider ? { provider: options.provider, configured: true } : defaultProvider();
    this.provider = options.provider || defaults.provider;
    this.loadCatalog = options.loadCatalog || loadEnabledCatalog;
    this.enabled = options.enabled ?? env.AI_RULE_GENERATION_ENABLED;
    this.providerConfigured = options.providerConfigured ?? (options.provider ? true : defaults.configured);
    this.timeoutMs = options.timeoutMs ?? env.AI_TIMEOUT_MS;
    this.limiter = new AiRateLimiter(options.rateLimitPerMinute ?? env.AI_RATE_LIMIT_PER_MINUTE, options.maxConcurrent ?? env.AI_MAX_CONCURRENT);
    this.denyFieldNames = new Set((options.denyFieldNames || env.AI_DERIVATION_DENY_FIELD_NAMES.split(',')).map(value => value.trim().toLowerCase()).filter(Boolean));
  }

  async generate(rawInput: unknown, context: GenerateContext): Promise<AiAudienceGenerateResult> {
    if (!this.enabled || !this.providerConfigured) throw new AppError(503, 'AI_FEATURE_DISABLED', 'AI 圈人功能尚未配置');
    const parsedInput = aiAudienceGenerateRequestSchema.safeParse(rawInput);
    if (!parsedInput.success) throw new AppError(400, 'AI_PROMPT_INVALID', '人群描述或确认项格式不正确', parsedInput.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })));
    const input = parsedInput.data;
    this.limiter.enter(context.actorKey);
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    const abort = () => controller.abort();
    context.signal?.addEventListener('abort', abort, { once: true });
    if (context.signal?.aborted) controller.abort();
    const startedAt = Date.now();
    let outcome = 'failed';
    try {
      const snapshot = buildCatalogSnapshot(await this.loadCatalog());
      if (!snapshot.catalog.metadata.length && !snapshot.catalog.events.length)
        throw new AppError(422, 'AI_CATALOG_EMPTY', '当前没有启用的规则元数据');
      const clarifications = this.resolveClarifications(input, snapshot);
      let issues: string[] | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        let rawOutput: unknown;
        try {
          rawOutput = await this.provider.generate({ prompt: input.prompt, clarifications, catalog: snapshot.providerCatalog, repairIssues: issues }, controller.signal);
        } catch (error) {
          if (error instanceof AiProviderError && error.kind === 'INVALID_RESPONSE' && attempt === 0) {
            issues = [error.message];
            continue;
          }
          throw error;
        }
        try {
          const generated = resolveProviderOutput(rawOutput, snapshot, this.denyFieldNames);
          if (generated.rules) {
            const validation = validateRules(generated.rules, snapshot.catalog);
            if (validation.length) throw new Error(validation.slice(0, 20).map(issue => `${issue.path}: ${issue.message}`).join('; '));
          }
          const result = aiAudienceGenerateResultSchema.parse({
            ...generated, requestId: context.requestId, catalogRevision: snapshot.revision,
          });
          outcome = result.mappings.some(mapping => mapping.status === 'DERIVED') ? 'derived' : result.requiresConfirmation ? 'needs_confirmation' : result.hasUnmappedSegments ? 'partial' : 'mapped';
          return result;
        } catch (error) {
          issues = repairIssues(error);
          if (attempt === 1) throw new AppError(502, 'AI_OUTPUT_INVALID', 'AI 生成结果无法通过规则校验，请重试');
        }
      }
      throw new AppError(502, 'AI_OUTPUT_INVALID', 'AI 生成结果无法通过规则校验，请重试');
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        if (timedOut) throw new AppError(504, 'AI_PROVIDER_TIMEOUT', 'AI 生成超时，请稍后重试');
        throw new AppError(499, 'AI_REQUEST_CANCELLED', 'AI 生成已取消');
      }
      if (error instanceof AiProviderError) {
        if (error.kind === 'INVALID_RESPONSE') throw new AppError(502, 'AI_OUTPUT_INVALID', 'AI 返回内容无法解析，请重试');
        throw new AppError(503, 'AI_PROVIDER_UNAVAILABLE', 'AI 服务暂时不可用，请稍后重试');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      context.signal?.removeEventListener('abort', abort);
      this.limiter.leave(context.actorKey);
      if (env.NODE_ENV !== 'test') console.info(JSON.stringify({ event: 'ai_audience_generation', requestId: context.requestId, outcome, durationMs: Date.now() - startedAt }));
    }
  }

  private resolveClarifications(input: AiAudienceGenerateRequest, snapshot: ReturnType<typeof buildCatalogSnapshot>) {
    return input.clarifications.map(clarification => {
      if (!input.prompt.includes(clarification.sourceText))
        throw new AppError(422, 'AI_CLARIFICATION_INVALID', '确认片段不属于当前描述');
      const alias = resourceAlias(snapshot, clarification.resourceType, clarification.resourceId);
      if (!alias) throw new AppError(422, 'AI_CLARIFICATION_INVALID', '确认候选不存在、已停用或类型不匹配');
      return { key: clarification.key, sourceText: clarification.sourceText, resourceAlias: alias };
    });
  }
}

export function createAiAudienceService(options?: AiAudienceServiceOptions) { return new AiAudienceService(options); }
