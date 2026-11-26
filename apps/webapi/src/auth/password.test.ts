import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('密码哈希', () => {
  it('只验证原始密码，且相同密码每次使用不同盐值', async () => {
    const first = await hashPassword('correct-horse-battery-staple');
    const second = await hashPassword('correct-horse-battery-staple');
    expect(first).not.toBe(second);
    await expect(verifyPassword('correct-horse-battery-staple', first)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', first)).resolves.toBe(false);
  });

  it('把损坏或非当前参数的哈希视为不匹配', async () => {
    await expect(verifyPassword('anything', 'plain-text')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'scrypt$1$8$1$bad$bad')).resolves.toBe(false);
  });
});
