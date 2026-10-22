import { randomUUID } from 'node:crypto';
import Koa from 'koa';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import { errors } from './middleware/errors.js';
import { router } from './routes/index.js';
import { AppError } from './errors/AppError.js';
import { env } from './config/env.js';

export function createApp() {
  const app = new Koa();
  app.use(async (ctx, next) => {
    ctx.state.requestId = randomUUID();
    ctx.set('X-Request-Id', ctx.state.requestId);
    await next();
  });
  app.use(errors);
  app.use(helmet());
  app.use(cors({ origin: ctx => ctx.get('Origin') === env.CORS_ORIGIN ? env.CORS_ORIGIN : '' }));
  app.use(async (ctx, next) => {
    const origin = ctx.get('Origin');
    if (origin && origin !== env.CORS_ORIGIN && !['GET', 'HEAD', 'OPTIONS'].includes(ctx.method))
      throw new AppError(403, 'ORIGIN_REJECTED', '请求来源不在允许列表中');
    await next();
  });
  app.use(bodyParser({ enableTypes: ['json'], jsonLimit: '1mb' }));
  app.use(async (ctx, next) => {
    const start = Date.now();
    ctx.state.identity = { mode: 'local-demo', role: 'administrator' };
    try { await next(); }
    finally {
      if (env.NODE_ENV !== 'test') console.info(JSON.stringify({ requestId: ctx.state.requestId, method: ctx.method, path: ctx.path, status: ctx.status, durationMs: Date.now() - start }));
    }
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.use(() => { throw new AppError(404, 'NOT_FOUND', '接口不存在'); });
  return app;
}
