import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { StoryQueryService } from '../../../core/services/StoryQueryService';

export function registerStoryController(app: FastifyInstance, storyQueryService: StoryQueryService) {
  app.get('/api/stories', async (request: FastifyRequest) => {
    const lang = (request.query as any).lang || 'en';
    return storyQueryService.listPublicStories(lang);
  });

  app.get('/api/stories/categories', async () => {
    return storyQueryService.listCategories();
  });

  app.get('/api/stories/category/:category', async (request: FastifyRequest) => {
    const lang = (request.query as any).lang || 'en';
    const params = request.params as any;
    return storyQueryService.listStoriesByCategory(params.category, lang);
  });

  app.get('/api/stories/groups', async () => {
    return storyQueryService.listGroups();
  });

  app.get('/api/stories/group/:group', async (request: FastifyRequest) => {
    const lang = (request.query as any).lang || 'en';
    const params = request.params as any;
    return storyQueryService.listStoriesByGroup(params.group, lang);
  });

  // GET /api/stories/:uuidStory/classes/:uuidClass/traits — Step 23
  app.get('/api/stories/:uuidStory/classes/:uuidClass/traits', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const result = await storyQueryService.getTraitsForClass(params.uuidStory, params.uuidClass);
    if ('error' in result) {
      const code = result.error === 'STORY_NOT_FOUND' ? 404 : 404;
      return reply.code(code).send({ error: result.error, message: `${result.error}: ${params.uuidClass}` });
    }
    return reply.code(200).send(result.traits);
  });

  app.get('/api/stories/:uuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const lang = (request.query as any).lang || 'en';
    const params = request.params as any;
    const story = await storyQueryService.getStoryByUuid(params.uuid, lang);
    if (!story) return reply.code(404).send({ error: 'Story not found' });
    return story;
  });
}
