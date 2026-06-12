import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MATCH_STATUSES } from '../../../core/services/MatchCommandService';
import type { MatchCommandService } from '../../../core/services/MatchCommandService';
import type { MatchQueryService } from '../../../core/services/MatchQueryService';

export function registerMatchAdminController(
  app: FastifyInstance,
  matchCommandService: MatchCommandService,
  matchQueryService: MatchQueryService,
) {
  const ensureAdmin = (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user || user.role !== 'ADMIN') {
      void reply.code(401).send({ error: 'Admin required' });
      return false;
    }
    return true;
  };

  app.get('/api/admin/matches', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureAdmin(request, reply)) return reply;
    return matchQueryService.listAllMatches();
  });

  // List the valid match statuses (each flagged terminal when deletable).
  app.get('/api/admin/matches/statuses', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureAdmin(request, reply)) return reply;
    return MATCH_STATUSES;
  });

  // Full detail of any match (admin view — no ownership check).
  app.get<{ Params: { uuidMatch: string } }>('/api/admin/matches/:uuidMatch/info', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureAdmin(request, reply)) return reply;
    const { uuidMatch } = request.params as any;
    const info = await matchQueryService.getMatchInfo(uuidMatch);
    if (!info) return reply.code(404).send({ error: 'MATCH_NOT_FOUND' });
    return info;
  });

  app.put<{ Params: { uuidMatch: string } }>('/api/admin/matches/:uuidMatch', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureAdmin(request, reply)) return reply;
    const body = request.body as any;
    const { uuidMatch } = request.params as any;
    try {
      await matchCommandService.updateMatch(uuidMatch, body.status, body.name);
      return { status: 'UPDATED', uuid: uuidMatch };
    } catch (err: any) {
      const code = err.message === 'MATCH_NOT_FOUND' ? 404 : 400;
      return reply.code(code).send({ error: err.message });
    }
  });

  // Status transitions — stop (ENDED) / pause (PAUSED) / resume (RUNNING).
  const transition = (path: string, status: 'ENDED' | 'PAUSED' | 'RUNNING') =>
    app.post<{ Params: { uuidMatch: string } }>(path, async (request: FastifyRequest, reply: FastifyReply) => {
      if (!ensureAdmin(request, reply)) return reply;
      const { uuidMatch } = request.params as any;
      try {
        return await matchCommandService.setStatus(uuidMatch, status);
      } catch (err: any) {
        return reply.code(err.statusCode || 400).send({ error: err.message });
      }
    });

  transition('/api/admin/matches/:uuidMatch/stop', 'ENDED');
  transition('/api/admin/matches/:uuidMatch/pause', 'PAUSED');
  transition('/api/admin/matches/:uuidMatch/resume', 'RUNNING');

  app.delete<{ Params: { uuidMatch: string } }>('/api/admin/matches/:uuidMatch', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!ensureAdmin(request, reply)) return reply;
    const { uuidMatch } = request.params as any;
    try {
      const success = await matchCommandService.deleteMatch(uuidMatch);
      if (!success) return reply.code(404).send({ error: 'MATCH_NOT_FOUND' });
      return { status: 'DELETED', uuid: uuidMatch };
    } catch (err: any) {
      return reply.code(err.statusCode || 400).send({ error: err.message });
    }
  });
}
