import type { FastifyInstance, FastifyReply } from 'fastify';
import type { TestDataCleanupService } from '../../../core/services/TestDataCleanupService';

export function registerDevController(app: FastifyInstance, testDataCleanupService: TestDataCleanupService, devEnabled: boolean) {
  app.post('/api/dev/cleanup', async (request, reply: FastifyReply) => {
    if (!devEnabled) {
      return reply.code(403).send({ error: 'Dev endpoints disabled' });
    }
    const result = await testDataCleanupService.cleanupTestData();
    return { deletedGuests: result.deletedGuests, deletedMatches: result.deletedMatches };
  });
}
