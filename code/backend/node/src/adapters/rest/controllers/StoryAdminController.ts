import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { StoryImportService } from '../../../core/services/StoryImportService';
import type { StoryQueryService } from '../../../core/services/StoryQueryService';
import type { StoryRepository } from '../../../core/ports/StoryRepository';
import type { StoryCrudPort } from '../../../core/ports/StoryCrudPort';

export function registerStoryAdminController(
  app: FastifyInstance,
  storyImportService: StoryImportService,
  storyQueryService: StoryQueryService,
  storyRepo: StoryRepository,
  storyCrudPort: StoryCrudPort,
) {
  // GET /api/admin/stories
  app.get('/api/admin/stories', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const stories = await storyRepo.listAll();
    return stories.map((s: any) => ({
      uuid: s.uuid,
      title: s.title,
      description: s.description || null,
      author: s.author || null,
      category: s.category || null,
      group: s.group || null,
      visibility: s.visibility,
      priority: s.priority || 0,
      peghi: s.peghi || 0,
      difficultyCount: 0,
      card: null,
    }));
  });

  // GET /api/admin/stories/:uuid
  app.get('/api/admin/stories/:uuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const s = (await storyRepo.findByUuid(params.uuid)) as any;
    if (!s) {
      return reply.code(404).send({ error: 'STORY_NOT_FOUND', message: `Story not found: ${params.uuid}` });
    }
    return {
      id: s.idStory ?? null,
      uuid: s.uuid,
      title: s.title,
      description: s.description || null,
      author: s.author || null,
      category: s.category || null,
      group: s.group || null,
      visibility: s.visibility,
      priority: s.priority || 0,
      peghi: s.peghi || 0,
      versionMin: s.versionMin ?? null,
      versionMax: s.versionMax ?? null,
      idTextTitle: s.idTextTitle ?? null,
      idTextDescription: s.idTextDescription ?? null,
      idCard: s.idCard ?? null,
      idImage: s.idImage ?? null,
      idLocationStart: s.idLocationStart ?? null,
      idCreator: s.idCreator ?? null,
      idLocationAllPlayerComa: s.idLocationAllPlayerComa ?? null,
      idEventAllPlayerComa: s.idEventAllPlayerComa ?? null,
      idEventEndGame: s.idEventEndGame ?? null,
      idTextCopyright: s.idTextCopyright ?? null,
      idTextClockSingular: s.idTextClockSingular ?? null,
      idTextClockPlural: s.idTextClockPlural ?? null,
      difficultyCount: 0,
      card: null,
    };
  });

  // POST /api/admin/stories/import — validate first, then persist
  app.post('/api/admin/stories/import', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'INVALID_STORY', message: 'Request body must be a JSON object', errors: [] });
    }
    if (!body.uuid) {
      return reply.code(400).send({ error: 'INVALID_STORY', message: 'Missing required field: uuid', errors: [] });
    }

    // Validate payload integrity
    const errors = storyImportService.validate(body);
    if (errors.length > 0) {
      return reply.code(400).send({ error: 'INVALID_STORY', message: 'Story failed validation', errors });
    }

    try {
      const result = await storyImportService.importStory(body);
      return reply.code(201).send(result);
    } catch (err: any) {
      if (err?.code === 'INVALID_IMPORT_DATA') {
        return reply.code(400).send({ error: 'INVALID_IMPORT_DATA', message: err.message });
      }
      console.error('Import error:', err);
      return reply.code(500).send({ error: 'IMPORT_FAILED', message: err.message || 'Import failed', errors: [] });
    }
  });

  // GET /api/admin/stories/:uuid/validate — Step 22
  app.get('/api/admin/stories/:uuid/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const report = await storyImportService.validatePersistedStory(params.uuid);

    if (!report.valid && report.errors.some((e) => e.rule === 'STORY_NOT_FOUND')) {
      return reply.code(404).send({ error: 'STORY_NOT_FOUND', message: `Story not found: ${params.uuid}` });
    }
    return reply.code(200).send(report);
  });

  // DELETE /api/admin/stories/:uuid
  app.delete('/api/admin/stories/:uuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const story = await storyRepo.findByUuid(params.uuid);
    if (!story) {
      return reply.code(404).send({ error: 'Story not found' });
    }
    await storyRepo.delete(params.uuid);
    return { status: 'DELETED', uuid: params.uuid };
  });

  // PUT /api/admin/stories/:storyUuid
  app.put('/api/admin/stories/:storyUuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'EMPTY_DATA', message: 'Request body required' });
    }

    const result = await storyCrudPort.updateStory(params.storyUuid, body);
    if (!result) {
      return reply.code(404).send({ error: 'STORY_NOT_FOUND', message: `No story: ${params.storyUuid}` });
    }
    return result;
  });

  // POST /api/admin/stories (create story)
  app.post('/api/admin/stories', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'EMPTY_DATA', message: 'Request body required' });
    }

    const result = await storyCrudPort.createStory(body);
    if (!result) {
      return reply.code(400).send({ error: 'INVALID_DATA', message: 'Failed to create story' });
    }
    return reply.code(201).send(result);
  });

  // GET /api/admin/stories/:storyUuid/:entityType
  app.get('/api/admin/stories/:storyUuid/:entityType', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const result = await storyCrudPort.listEntities(params.storyUuid, params.entityType);

    if (result === null) {
      return reply.code(404).send({ error: 'STORY_NOT_FOUND', message: `No story: ${params.storyUuid}` });
    }
    return result;
  });

  // GET /api/admin/stories/:storyUuid/:entityType/:entityUuid
  app.get('/api/admin/stories/:storyUuid/:entityType/:entityUuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const result = await storyCrudPort.getEntity(params.storyUuid, params.entityType, params.entityUuid);

    if (!result) {
      return reply.code(404).send({ error: 'ENTITY_NOT_FOUND', message: 'Entity not found' });
    }
    return result;
  });

  // POST /api/admin/stories/:storyUuid/:entityType
  app.post('/api/admin/stories/:storyUuid/:entityType', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'EMPTY_DATA', message: 'Request body required' });
    }

    const result = await storyCrudPort.createEntity(params.storyUuid, params.entityType, body);
    if (!result) {
      return reply.code(404).send({ error: 'STORY_NOT_FOUND', message: `No story: ${params.storyUuid}` });
    }
    return reply.code(201).send(result);
  });

  // PUT /api/admin/stories/:storyUuid/:entityType/:entityUuid
  app.put('/api/admin/stories/:storyUuid/:entityType/:entityUuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const body = request.body as any;

    if (!body || typeof body !== 'object' || Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'EMPTY_DATA', message: 'Request body required' });
    }

    const result = await storyCrudPort.updateEntity(params.storyUuid, params.entityType, params.entityUuid, body);
    if (!result) {
      return reply.code(404).send({ error: 'ENTITY_NOT_FOUND', message: 'Entity not found' });
    }
    return result;
  });

  // DELETE /api/admin/stories/:storyUuid/:entityType/:entityUuid
  app.delete('/api/admin/stories/:storyUuid/:entityType/:entityUuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;

    const deleted = await storyCrudPort.deleteEntity(params.storyUuid, params.entityType, params.entityUuid);
    if (!deleted) {
      return reply.code(404).send({ error: 'ENTITY_NOT_FOUND', message: 'Entity not found' });
    }
    return { status: 'DELETED', uuid: params.entityUuid };
  });
}
