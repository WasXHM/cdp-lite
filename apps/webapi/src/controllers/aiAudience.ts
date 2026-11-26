import type { Context } from 'koa';
import type { AiAudienceService } from '../services/aiAudience.js';

export function aiAudienceController(service: AiAudienceService) {
  return {
    generate: async (ctx: Context) => {
      const controller = new AbortController();
      const abortRequest = () => controller.abort();
      const abortResponse = () => { if (!ctx.res.writableEnded) controller.abort(); };
      ctx.req.once('aborted', abortRequest);
      ctx.res.once('close', abortResponse);
      try {
        const identity = ctx.state.identity as { id?: string; role?: string } | undefined;
        ctx.body = { data: await service.generate(ctx.request.body, {
          requestId: String(ctx.state.requestId), actorKey: `${identity?.id || identity?.role || 'anonymous'}:${ctx.ip}`, signal: controller.signal,
        }) };
      } finally {
        ctx.req.off('aborted', abortRequest);
        ctx.res.off('close', abortResponse);
      }
    },
  };
}
