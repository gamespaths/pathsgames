import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GuestAuthService } from '../../../core/services/GuestAuthService';

export function registerGuestAuthController(app: FastifyInstance, guestAuthService: GuestAuthService) {
  app.post('/api/auth/guest', async (request: FastifyRequest, reply: FastifyReply) => {
    const testMarker = (request.headers['x-test-marker'] as string) || undefined;
    const response = await guestAuthService.createGuestSession(testMarker);
    
    reply.header('Set-Cookie', [
      `pathsgames.refreshToken=; HttpOnly; SameSite=Lax; Path=/`,
      `pathsgames.guestcookie=${response.userUuid}; HttpOnly; SameSite=Lax; Path=/`
    ]);
    
    reply.code(201);
    return response;
  });

  app.post('/api/auth/guest/resume', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = (request.headers.cookie || '').split(';').reduce((acc: any, c) => {
      const [k, v] = c.trim().split('=');
      acc[k] = v;
      return acc;
    }, {});
    
    const guestUuid = cookies['pathsgames.guestcookie'];
    if (!guestUuid) {
      return reply.code(400).send({ error: 'Missing guest cookie' });
    }

    const response = await guestAuthService.resumeGuestSession(guestUuid);
    if (!response) {
      return reply.code(401).send({ error: 'Invalid guest session' });
    }

    reply.header('Set-Cookie', [
      `pathsgames.refreshToken=; HttpOnly; SameSite=Lax; Path=/`,
      `pathsgames.guestcookie=${response.userUuid}; HttpOnly; SameSite=Lax; Path=/`
    ]);

    return response;
  });
}
