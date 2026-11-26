import type { Middleware } from 'koa';
import { AppError } from '../errors/AppError.js';
import { SESSION_COOKIE_NAME, type AuthenticationService } from '../services/auth.js';
import type { UserRole } from '@cdp/contracts';

export function loadAuthentication(service: AuthenticationService): Middleware {
  return async (ctx, next) => {
    const token = ctx.cookies.get(SESSION_COOKIE_NAME);
    ctx.state.identity = token ? await service.authenticate(token) : null;
    await next();
  };
}

export const requireAuthentication: Middleware = async (ctx, next) => {
  if (!ctx.state.identity) {
    ctx.set('Cache-Control', 'no-store');
    throw new AppError(401, 'AUTH_REQUIRED', '请先登录');
  }
  await next();
};

export function requireRole(...roles: UserRole[]): Middleware {
  return async (ctx, next) => {
    if (!ctx.state.identity) throw new AppError(401, 'AUTH_REQUIRED', '请先登录');
    if (!roles.includes(ctx.state.identity.role)) throw new AppError(403, 'AUTH_FORBIDDEN', '当前用户无权执行此操作');
    await next();
  };
}
