import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import type { AiRuleGenerationProvider, ProviderGenerationInput } from './provider';
import type { Catalog } from '@cdp/contracts';
import { createApp } from '../app';
import { AiAudienceService } from '../services/aiAudience';
import type { AuthenticationService } from '../services/auth';

const tagId = '11111111-1111-4111-8111-111111111111';
const catalog: Catalog = {
  metadata: [{
    id: tagId, metadataType: 'TAG', name: '会员等级', fieldName: 'member_level', description: '会员等级',
    dataType: 'String', displayType: 'SELECT', isEnum: true, status: 'ENABLED', createdAt: '', updatedAt: '',
    enumValues: [{ id: '22222222-2222-4222-8222-222222222222', label: '金卡', value: 'GOLD', sortOrder: 0, status: 'ENABLED', createdAt: '', updatedAt: '' }],
  }],
  events: [],
};

const provider: AiRuleGenerationProvider = {
  async generate(_input: ProviderGenerationInput) {
    return {
      summary: '会员等级为金卡', rules: [[{ metadataType: 'TAG', metadataId: 'T1', operator: 'EQ', value: 'T1.V1' }]],
      mappings: [{
        key: 'member-level', sourceText: '金卡会员', status: 'MAPPED', resourceAlias: 'T1', rulePaths: ['rules[0][0]'],
        explanation: '直接匹配会员等级', parameters: [], candidateAliases: [], derivation: null,
      }], warnings: [],
    };
  },
};

const service = new AiAudienceService({
  provider, loadCatalog: async () => structuredClone(catalog), enabled: true, providerConfigured: true,
  rateLimitPerMinute: 20, maxConcurrent: 2,
});
const token = 'a'.repeat(43);
const authService: AuthenticationService = {
  async login() { throw new Error('not used'); },
  async authenticate(candidate) {
    return candidate === token ? { id: '33333333-3333-4333-8333-333333333333', username: 'admin', displayName: '系统管理员', role: 'ADMIN' } : null;
  },
  async logout() {},
};
const api = supertest(createApp({ aiAudienceService: service, authService }).callback());

describe('AI 圈人 HTTP 接口', () => {
  it('返回统一 data 包装、请求标识和真实规则 ID', async () => {
    const response = await api.post('/api/v1/audiences/generate-rules').set('Cookie', `cdp_session=${token}`).send({ prompt: '金卡会员' }).expect(200);
    expect(response.body.data.requestId).toBe(response.headers['x-request-id']);
    expect(response.body.data.rules[0][0]).toEqual({ metadataType: 'TAG', metadataId: tagId, operator: 'EQ', value: 'GOLD' });
  });

  it('拒绝客户端覆盖模型配置', async () => {
    const response = await api.post('/api/v1/audiences/generate-rules').set('Cookie', `cdp_session=${token}`).send({ prompt: '金卡会员', model: 'override' }).expect(400);
    expect(response.body.error.code).toBe('AI_PROMPT_INVALID');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});
