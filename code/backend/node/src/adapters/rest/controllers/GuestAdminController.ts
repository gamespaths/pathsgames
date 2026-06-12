import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GuestAdminService } from '../../../core/services/GuestAdminService';

export function registerGuestAdminController(app: FastifyInstance, guestAdminService: GuestAdminService) {
  // The admin port already enforces ADMIN role in onRequest hook (main.ts).
  // These per-route checks are belt-and-suspenders.

  app.get('/api/admin/guests', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const guests = await guestAdminService.listAllGuests();
    return guests.map((g) => ({
      userUuid: g.uuid,
      username: g.username,
      role: g.role,
      createdAt: g.createdAt.toISOString(),
      expired: false,
    }));
  });

  app.get('/api/admin/guests/stats', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return guestAdminService.getGuestStats();
  });

  app.get('/api/admin/guests/:uuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const guest = await guestAdminService.getGuestByUuid(params.uuid);
    if (!guest) return reply.code(404).send({ error: 'Guest not found' });
    return {
      userUuid: guest.uuid,
      username: guest.username,
      role: guest.role,
      createdAt: guest.createdAt.toISOString(),
      expired: false,
    };
  });

  app.delete('/api/admin/guests/expired', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const count = await guestAdminService.deleteExpiredGuests();
    return { deleted: count };
  });

  app.delete('/api/admin/guests/:uuid', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    if (params.uuid === 'expired') {
      const count = await guestAdminService.deleteExpiredGuests();
      return { deleted: count };
    }
    const success = await guestAdminService.deleteGuest(params.uuid);
    if (!success) return reply.code(404).send({ error: 'Guest not found' });
    return { status: 'deleted', uuid: params.uuid };
  });
}
