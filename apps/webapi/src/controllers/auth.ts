import type { Middleware } from 'koa';
import { env } from '../config/env.js';
import { SESSION_COOKIE_NAME, type AuthenticationService } from '../services/auth.js';

const baseCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
  overwrite: true,
  path: '/',
};

export function authController(service: AuthenticationService): {
  login: Middleware;
  current: Middleware;
  logout: Middleware;
} {
  return {
    login: async ctx => {
      ctx.set('Cache-Control', 'no-store');
      const result = await service.login(ctx.request.body, ctx.ip);
      ctx.cookies.set(SESSION_COOKIE_NAME, result.token, {
        ...baseCookieOptions,
        expires: result.expiresAt,
        maxAge: Math.max(0, result.expiresAt.getTime() - Date.now()),
      });
      ctx.body = { data: result.user };
    },
    current: async ctx => {
      ctx.set('Cache-Control', 'no-store');
      ctx.body = { data: ctx.state.identity };
    },
    logout: async ctx => {
      ctx.set('Cache-Control', 'no-store');
      const token = ctx.cookies.get(SESSION_COOKIE_NAME);
      if (token) await service.logout(token);
      ctx.cookies.set(SESSION_COOKIE_NAME, '', { ...baseCookieOptions, expires: new Date(0), maxAge: 0 });
      ctx.status = 204;
    },
  };
}
