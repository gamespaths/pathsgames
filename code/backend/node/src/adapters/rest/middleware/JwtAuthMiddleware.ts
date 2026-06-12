import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { JwtPort } from '../../../core/ports/JwtPort';

export function registerJwtAuthMiddleware(app: FastifyInstance, jwtPort: JwtPort) {
  app.addHook('preHandler', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      (request as any).user = null;
      return;
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = jwtPort.verify(token) as any;
    if (!payload) {
      (request as any).user = null;
      return;
    }

    // Support both 'uuid' claim (Node backend) and 'sub' claim (Java/JwtHelper convention)
    const uuid = payload.uuid || payload.sub;

    (request as any).user = {
      uuid,
      username: payload.username,
      role: payload.role,
    };
  });
}
