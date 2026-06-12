import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ContentQueryService } from '../../../core/services/ContentQueryService';

export function registerContentController(app: FastifyInstance, contentQueryService: ContentQueryService) {
  // GET /api/content/:uuidStory/cards/:uuidCard
  app.get('/api/content/:uuidStory/cards/:uuidCard', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;
    const result = await contentQueryService.getCardInfo(params.uuidStory, params.uuidCard, query.lang || 'en');
    if ('error' in result) {
      return reply.code(result.status ?? 404).send({ error: result.error, message: result.message });
    }
    return reply.code(200).send(result.data);
  });

  // GET /api/content/:uuidStory/texts/:idText/lang/:lang
  app.get('/api/content/:uuidStory/texts/:idText/lang/:lang', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const idText = parseInt(params.idText, 10);
    if (isNaN(idText)) {
      return reply.code(400).send({ error: 'INVALID_ID_TEXT', message: 'idText must be an integer' });
    }
    const result = await contentQueryService.getTextInfo(params.uuidStory, idText, params.lang || 'en');
    if ('error' in result) {
      return reply.code(result.status ?? 404).send({ error: result.error, message: result.message });
    }
    return reply.code(200).send(result.data);
  });

  // GET /api/content/:uuidStory/creators/:uuidCreator
  app.get('/api/content/:uuidStory/creators/:uuidCreator', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = request.query as any;
    const result = await contentQueryService.getCreatorInfo(params.uuidStory, params.uuidCreator, query.lang || 'en');
    if ('error' in result) {
      return reply.code(result.status ?? 404).send({ error: result.error, message: result.message });
    }
    return reply.code(200).send(result.data);
  });
}
