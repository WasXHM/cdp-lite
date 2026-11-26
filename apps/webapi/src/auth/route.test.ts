import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { AppError } from '../errors/AppError';
import { createApp } from '../app';
import type { AuthenticationService } from '../services/auth';
import type { AuthUser } from '@cdp/contracts';

const token = 'a'.repeat(43);
const user: AuthUser = { id: '11111111-1111-4111-8111-111111111111', username: 'admin', displayName: '系统管理员', role: 'ADMIN' };

function fakeAuth(authenticatedUser = user): AuthenticationService {
  const sessions = new Set<string>();
  return {
    async login(input) {
      if (!input || typeof input !== 'object' || !('password' in input) || input.password !== 'correct-password')
        throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', '用户名或密码错误');
      sessions.add(token);
      return { user: authenticatedUser, token, expiresAt: new Date(Date.now() + 60000) };
    },
    async authenticate(candidate) { return sessions.has(candidate) ? authenticatedUser : null; },
    async logout(candidate) { sessions.delete(candidate); },
  };
}

describe('身份认证 HTTP 接口', () => {
  it('保护业务接口，并支持登录、恢复身份和注销', async () => {
    const api = supertest.agent(createApp({ authService: fakeAuth() }).callback());
    const anonymous = await api.get('/api/v1/metadata').expect(401);
    expect(anonymous.body.error.code).toBe('AUTH_REQUIRED');

    const login = await api.post('/api/v1/auth/login').send({ username: 'admin', password: 'correct-password' }).expect(200);
    expect(login.body.data).toEqual(user);
    const cookie = login.headers['set-cookie']?.[0].toLowerCase();
    expect(cookie).toContain('cdp_session=');
    expect(cookie).toContain('httponly');
    expect(cookie).toContain('samesite=lax');

    expect((await api.get('/api/v1/auth/me').expect(200)).body.data).toEqual(user);
    await api.post('/api/v1/auth/logout').expect(204);
    await api.get('/api/v1/auth/me').expect(401);
  });

  it('不在登录错误中暴露账号是否存在', async () => {
    const response = await supertest(createApp({ authService: fakeAuth() }).callback())
      .post('/api/v1/auth/login').send({ username: 'missing', password: 'wrong' }).expect(401);
    expect(response.body.error).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS', message: '用户名或密码错误' });
  });

  it('拒绝普通用户访问用户管理接口', async () => {
    const regularUser: AuthUser = { ...user, id: '22222222-2222-4222-8222-222222222222', username: 'operator', displayName: '普通用户', role: 'USER' };
    const api = supertest.agent(createApp({ authService: fakeAuth(regularUser) }).callback());
    await api.post('/api/v1/auth/login').send({ username: 'operator', password: 'correct-password' }).expect(200);
    const response = await api.get('/api/v1/users').expect(403);
    expect(response.body.error.code).toBe('AUTH_FORBIDDEN');
  });
});
