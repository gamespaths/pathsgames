import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SessionService } from '../../../core/services/SessionService';

export function registerSessionController(app: FastifyInstance, sessionService: SessionService) {
  app.post('/api/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = (request.headers.cookie || '').split(';').reduce((acc: any, c) => {
      const [k, v] = c.trim().split('=');
      acc[k] = v;
      return acc;
    }, {});
    
    const refreshToken = cookies['pathsgames.refreshToken'];
    if (!refreshToken) {
      return reply.code(401).send({ error: 'Missing refresh token' });
    }

    try {
      const response = await sessionService.refreshToken(refreshToken);
      reply.header('Set-Cookie', [`pathsgames.refreshToken=${response.accessToken}; HttpOnly; SameSite=Lax; Path=/`]);
      return response;
    } catch {
      return reply.code(401).send({ error: 'Invalid refresh token' });
    }
  });

  app.post('/api/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = (request.headers.cookie || '').split(';').reduce((acc: any, c) => {
      const [k, v] = c.trim().split('=');
      acc[k] = v;
      return acc;
    }, {});
    
    const refreshToken = cookies['pathsgames.refreshToken'];
    if (refreshToken) {
      await sessionService.logout(refreshToken);
    }
    reply.header('Set-Cookie', [
      `pathsgames.refreshToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      `pathsgames.guestcookie=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    ]);
    return { status: 'logged out' };
  });

  app.post('/api/auth/logout/all', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    await sessionService.revokeAllSessions(user.uuid);
    reply.header('Set-Cookie', [
      `pathsgames.refreshToken=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
      `pathsgames.guestcookie=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
    ]);
    return { status: 'all sessions revoked' };
  });

  app.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    return { userUuid: user.uuid, username: user.username, role: user.role };
  });
}
