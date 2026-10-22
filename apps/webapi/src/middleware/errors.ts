import type { Middleware } from 'koa';
import { ZodError } from 'zod';
import { ForeignKeyConstraintError, UniqueConstraintError } from 'sequelize';
import { AppError } from '../errors/AppError.js';

export const errors: Middleware = async (ctx, next) => {
  try { await next(); }
  catch (error) {
    let failure: AppError;
    if (error instanceof AppError) failure = error;
    else if (error instanceof ZodError) failure = new AppError(400, 'INVALID_INPUT', '请求格式不正确', error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })));
    else if (error instanceof UniqueConstraintError) failure = new AppError(409, 'CODE_CONFLICT', '编码已存在，请使用不同的编码');
    else if (error instanceof ForeignKeyConstraintError) failure = new AppError(409, 'RESOURCE_REFERENCED', '资源仍有关联记录，无法删除');
    else if (error && typeof error === 'object' && 'status' in error && (error.status === 400 || error.status === 413))
      failure = new AppError(error.status, 'INVALID_BODY', '请求内容无效或超过大小限制');
    else {
      failure = new AppError(500, 'INTERNAL_ERROR', '服务暂时不可用，请稍后重试');
      console.error(JSON.stringify({ requestId: ctx.state.requestId, error: error instanceof Error ? error.name : 'UnknownError' }));
    }
    ctx.status = failure.status;
    ctx.body = { error: { code: failure.code, message: failure.message, details: failure.details, requestId: ctx.state.requestId } };
  }
};
