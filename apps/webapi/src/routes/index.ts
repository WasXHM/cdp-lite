import Router from '@koa/router';
import type { Context } from 'koa';
import { z } from 'zod';
import { listQuerySchema } from '@cdp/contracts';
import { controller, audienceController } from '../controllers/resources.js';
import { resourceService } from '../services/resources.js';

export const router = new Router({ prefix: '/api/v1' });
function routes(path: string, handlers: ReturnType<typeof controller>, detailPath = `${path}/:id`, readDetail = true) {
  router.get(path, handlers.list).post(path, handlers.create);
  if (readDetail) router.get(detailPath, handlers.detail);
  router.patch(detailPath, handlers.update).delete(detailPath, handlers.remove);
}
router.post('/audiences/validate-rules', audienceController.validate);
router.post('/audiences/:id/copy', audienceController.copy);
routes('/metadata', controller('metadata'));
routes('/event-models', controller('events'));
routes('/audiences', controller('audiences'));
routes('/metadata/:id/enum-values', controller('metadataValues', ctx => ({ metadataId: z.string().uuid().parse(ctx.params.id) }), 'valueId'), '/metadata/:id/enum-values/:valueId', false);
const eventScope = (ctx: Context) => ({ eventModelId: z.string().uuid().parse(ctx.params.id) });
routes('/event-models/:id/dimensions', controller('dimensions', eventScope, 'dimensionId'), '/event-models/:id/dimensions/:dimensionId', false);
routes('/event-models/:id/metrics', controller('metrics', eventScope, 'metricId'), '/event-models/:id/metrics/:metricId', false);
routes('/event-models/:id/dimensions/:dimensionId/values', controller('dimensionValues', ctx => resourceService.dimensionScope(z.string().uuid().parse(ctx.params.id), z.string().uuid().parse(ctx.params.dimensionId)), 'valueId'), '/event-models/:id/dimensions/:dimensionId/values/:valueId', false);
router.get('/rule-catalog', async ctx => {
  const query = listQuerySchema.parse(ctx.query);
  const type = z.enum(['TAG', 'ATTRIBUTE', 'EVENT']).parse(query.type);
  ctx.body = await resourceService.catalog(type, query);
});
