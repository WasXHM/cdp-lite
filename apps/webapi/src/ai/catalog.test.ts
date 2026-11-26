import { describe, expect, it } from 'vitest';
import type { Catalog } from '@cdp/contracts';
import { buildCatalogSnapshot } from './catalog';

const catalog: Catalog = {
  metadata: [
    { id: '11111111-1111-4111-8111-111111111111', metadataType: 'TAG', name: '会员等级', fieldName: 'member_level', description: '会员等级', dataType: 'String', displayType: 'SELECT', isEnum: true, status: 'ENABLED', createdAt: '', updatedAt: '', enumValues: [{ id: '21111111-1111-4111-8111-111111111111', label: '金卡', value: 'GOLD', sortOrder: 0, status: 'ENABLED', createdAt: '', updatedAt: '' }] },
    { id: '31111111-1111-4111-8111-111111111111', metadataType: 'ATTRIBUTE', name: '停用字段', fieldName: 'disabled', description: '', dataType: 'String', displayType: 'TEXT', isEnum: false, status: 'DISABLED', createdAt: '', updatedAt: '' },
  ],
  events: [{ id: '41111111-1111-4111-8111-111111111111', name: '商品购买', eventCode: 'purchase', description: '用户完成购买', status: 'ENABLED', createdAt: '', updatedAt: '', dimensions: [], metrics: [] }],
};

describe('AI 规则目录快照', () => {
  it('只保留启用资源并生成稳定别名和 revision', () => {
    const first = buildCatalogSnapshot(catalog);
    const second = buildCatalogSnapshot(structuredClone(catalog));
    expect(first.providerCatalog.metadata.map(item => item.alias)).toEqual(['T1']);
    expect(first.providerCatalog.events.map(item => item.alias)).toEqual(['E1']);
    expect(first.providerCatalog.metadata[0].values[0]).toEqual({ alias: 'T1.V1', label: '金卡' });
    expect(first.revision).toBe(second.revision);
    expect(first.revision).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
