import type { Context } from 'koa';
import { z } from 'zod';
import { authUserSchema, userListQuerySchema } from '@cdp/contracts';
import { userService } from '../services/users.js';

const userId = (ctx: Context) => z.string().uuid().parse(ctx.params.id);
const actorId = (ctx: Context) => authUserSchema.parse(ctx.state.identity).id;

export const userController = {
  list: async (ctx: Context) => {
    ctx.body = await userService.list(userListQuerySchema.parse(ctx.query));
  },
  create: async (ctx: Context) => {
    ctx.body = { data: await userService.create(ctx.request.body) };
    ctx.status = 201;
  },
  update: async (ctx: Context) => {
    ctx.body = { data: await userService.update(userId(ctx), ctx.request.body, actorId(ctx)) };
  },
  remove: async (ctx: Context) => {
    await userService.remove(userId(ctx), actorId(ctx));
    ctx.status = 204;
  },
};
