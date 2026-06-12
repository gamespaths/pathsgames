import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { MatchCommandService } from '../../../core/services/MatchCommandService';
import type { MatchQueryService } from '../../../core/services/MatchQueryService';

export function registerMatchController(
  app: FastifyInstance,
  matchCommandService: MatchCommandService,
  matchQueryService: MatchQueryService,
) {
  // POST /api/matches
  app.post('/api/matches', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const body = request.body as any;
    try {
      const match = await matchCommandService.createMatch(
        user.uuid, body.storyUuid, body.difficultyUuid, body.name,
        body.characterTemplateUuid, body.classUuid, body.traitUuids, body.singlePlayer,
      );
      return reply.code(201).send(match);
    } catch (err: any) {
      const code = err.statusCode === 404 ? 404 : 400;
      return reply.code(code).send({ error: err.message });
    }
  });

  // GET /api/matches
  app.get('/api/matches', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    return matchQueryService.listUserMatches(user.uuid);
  });

  // GET /api/match/:uuidMatch/info
  app.get('/api/match/:uuidMatch/info', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const params = request.params as any;
    const match = await matchQueryService.getMatchInfo(params.uuidMatch, user.uuid);
    if (!match) return reply.code(404).send({ error: 'Match not found' });
    return reply.code(200).send(match);
  });

  // PATCH /api/match/:uuid/end/:eventUuid
  app.patch('/api/match/:uuid/end/:eventUuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const params = request.params as any;
    try {
      const result = await matchCommandService.endMatch(params.uuid, params.eventUuid, user.uuid);
      return reply.code(200).send(result);
    } catch (err: any) {
      if (err.statusCode === 404) return reply.code(404).send({ error: 'MATCH_NOT_FOUND' });
      if (err.statusCode === 406) return reply.code(406).send({ error: err.message || 'EVENT_NOT_END_GAME' });
      return reply.code(400).send({ error: err.message });
    }
  });

  // POST /api/matches/:uuidMatch/join — Step 21/23
  app.post('/api/matches/:uuidMatch/join', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const params = request.params as any;
    const body = request.body as any || {};
    try {
      const result = await matchCommandService.joinMatch(
        params.uuidMatch, user.uuid,
        body.characterTemplateUuid, body.classUuid, body.traitUuids,
      );
      return reply.code(201).send(result);
    } catch (err: any) {
      const code = err.statusCode === 404 ? 404 : err.statusCode === 409 ? 409 : 400;
      return reply.code(code).send({ error: err.message });
    }
  });

  // GET /api/match/:uuidMatch/players — Step 21
  app.get('/api/match/:uuidMatch/players', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const params = request.params as any;
    const players = await matchQueryService.getMatchPlayers(params.uuidMatch, user.uuid);
    if (players === null) return reply.code(404).send({ error: 'MATCH_NOT_FOUND' });
    return reply.code(200).send(players);
  });

  // GET /api/match/:uuidMatch/characters/:uuidCharacter — Step 21
  app.get('/api/match/:uuidMatch/characters/:uuidCharacter', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });

    const params = request.params as any;
    const character = await matchQueryService.getCharacterDetail(params.uuidMatch, params.uuidCharacter, user.uuid);
    if (character === null) return reply.code(404).send({ error: 'CHARACTER_NOT_FOUND' });
    return reply.code(200).send(character);
  });
}
