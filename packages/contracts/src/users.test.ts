import { describe, expect, it } from 'vitest';
import { createUserInputSchema, updateUserInputSchema } from './index';

describe('用户管理契约', () => {
  it('创建用户要求安全长度密码并拒绝未知字段', () => {
    expect(createUserInputSchema.safeParse({ username: 'operator', password: 'short', displayName: '运营用户' }).success).toBe(false);
    expect(createUserInputSchema.safeParse({ username: 'operator', password: 'valid-password', displayName: '运营用户', extra: true }).success).toBe(false);
    expect(createUserInputSchema.parse({ username: 'operator', password: 'valid-password', displayName: '运营用户' })).toMatchObject({ role: 'USER', status: 'ENABLED' });
  });

  it('更新至少包含一个字段，密码存在时仍要求 12 位', () => {
    expect(updateUserInputSchema.safeParse({}).success).toBe(false);
    expect(updateUserInputSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(updateUserInputSchema.safeParse({ role: 'ADMIN' }).success).toBe(true);
  });
});
