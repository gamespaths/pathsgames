import type { FastifyInstance } from 'fastify';
import type { EchoService } from '../../../core/services/EchoService';

export function registerEchoController(app: FastifyInstance, echoService: EchoService) {
  app.get('/api/echo/status', async () => {
    return {
      status: echoService.getServerStatus(),
      timestamp: echoService.getTimestamp(),
      properties: echoService.getServerProperties(),
    };
  });
}
