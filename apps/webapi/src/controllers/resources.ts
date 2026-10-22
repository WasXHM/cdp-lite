import type { Context } from 'koa';
import { z } from 'zod';
import { listQuerySchema } from '@cdp/contracts';
import { resourceService } from '../services/resources.js';
import type { Resource } from '../models/index.js';

type Scope = (ctx: Context) => Promise<Record<string, string>> | Record<string, string>;
export function controller(resource: Resource, scope: Scope = () => ({}), idParam = 'id') {
  const id = (ctx: Context) => z.string().uuid().parse(ctx.params[idParam]);
  return {
    list: async (ctx: Context) => { ctx.body = await resourceService.list(resource, listQuerySchema.parse(ctx.query), await scope(ctx)); },
    detail: async (ctx: Context) => { ctx.body = { data: await resourceService.detail(resource, id(ctx), await scope(ctx)) }; },
    create: async (ctx: Context) => {
      ctx.body = { data: await resourceService.create(resource, ctx.request.body, await scope(ctx)) };
      ctx.status = 201;
    },
    update: async (ctx: Context) => { ctx.body = { data: await resourceService.update(resource, id(ctx), ctx.request.body, await scope(ctx)) }; },
    remove: async (ctx: Context) => { await resourceService.remove(resource, id(ctx), await scope(ctx)); ctx.status = 204; },
  };
}
export const audienceController = {
  validate: async (ctx: Context) => {
    const input = z.object({ rules: z.unknown() }).strict().parse(ctx.request.body);
    ctx.body = { data: await resourceService.validate(input.rules) };
  },
  copy: async (ctx: Context) => {
    z.object({}).strict().parse(ctx.request.body || {});
    ctx.body = { data: await resourceService.copy(z.string().uuid().parse(ctx.params.id)) };
    ctx.status = 201;
  },
};
