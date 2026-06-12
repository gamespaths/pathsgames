import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { EchoService } from './core/services/EchoService';
import { GuestAuthService } from './core/services/GuestAuthService';
import { SessionService } from './core/services/SessionService';
import { StoryQueryService } from './core/services/StoryQueryService';
import { MatchCommandService } from './core/services/MatchCommandService';
import { MatchQueryService } from './core/services/MatchQueryService';
import { GuestAdminService } from './core/services/GuestAdminService';
import { StoryImportService } from './core/services/StoryImportService';
import { StoryCrudService } from './core/services/StoryCrudService';
import { ContentQueryService } from './core/services/ContentQueryService';
import { PrismaGuestRepository } from './adapters/persistence/prisma/PrismaGuestRepository';
import { PrismaTokenRepository } from './adapters/persistence/prisma/PrismaTokenRepository';
import { PrismaStoryRepository } from './adapters/persistence/prisma/PrismaStoryRepository';
import { PrismaMatchRepository } from './adapters/persistence/prisma/PrismaMatchRepository';
import { PrismaDifficultyRepository } from './adapters/persistence/prisma/PrismaDifficultyRepository';
import { TestDataCleanupService } from './core/services/TestDataCleanupService';
import { JwtTokenAdapter } from './adapters/auth/JwtTokenAdapter';
import { registerEchoController } from './adapters/rest/controllers/EchoController';
import { registerGuestAuthController } from './adapters/rest/controllers/GuestAuthController';
import { registerSessionController } from './adapters/rest/controllers/SessionController';
import { registerStoryController } from './adapters/rest/controllers/StoryController';
import { registerMatchController } from './adapters/rest/controllers/MatchController';
import { registerDevController } from './adapters/rest/controllers/DevController';
import { registerGuestAdminController } from './adapters/rest/controllers/GuestAdminController';
import { registerMatchAdminController } from './adapters/rest/controllers/MatchAdminController';
import { registerStoryAdminController } from './adapters/rest/controllers/StoryAdminController';
import { registerContentController } from './adapters/rest/controllers/ContentController';
import { registerJwtAuthMiddleware } from './adapters/rest/middleware/JwtAuthMiddleware';

async function main() {
  const publicPort = parseInt(process.env.PUBLIC_PORT || '8042', 10);
  const adminPort = parseInt(process.env.ADMIN_PORT || '8044', 10);
  const jwtSecret = process.env.JWT_SECRET || 'dev-secret-changeme';
  const devEndpointsEnabled = process.env.DEV_ENDPOINTS_ENABLED === 'true';
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5172/,http://localhost:5174').split(',');

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('✓ PostgreSQL connected');

  // Repositories
  const guestRepo = new PrismaGuestRepository(prisma);
  const tokenRepo = new PrismaTokenRepository(prisma);
  const storyRepo = new PrismaStoryRepository(prisma);
  const matchRepo = new PrismaMatchRepository(prisma);
  const difficultyRepo = new PrismaDifficultyRepository(prisma);
  const jwtPort = new JwtTokenAdapter(jwtSecret);

  // Services
  const echoService = new EchoService();
  const guestAuthService = new GuestAuthService(guestRepo, tokenRepo, jwtPort);
  const sessionService = new SessionService(tokenRepo, jwtPort);
  const storyQueryService = new StoryQueryService(storyRepo, difficultyRepo, prisma);
  const matchCommandService = new MatchCommandService(matchRepo, guestRepo, storyRepo, difficultyRepo, prisma);
  const matchQueryService = new MatchQueryService(matchRepo, guestRepo, storyRepo, prisma);
  const guestAdminService = new GuestAdminService(guestRepo);
  const storyImportService = new StoryImportService(prisma);
  const storyCrudService = new StoryCrudService(prisma, storyRepo);
  const contentQueryService = new ContentQueryService(prisma);
  const testDataCleanupService = new TestDataCleanupService(guestRepo, matchRepo);

  // Fastify instances
  const publicApp = Fastify({ logger: true });
  const adminApp = Fastify({ logger: true });

  // Tolerant JSON parser: empty body (e.g. DELETE / cleanup with Content-Type:
  // application/json but no payload) parses to {} instead of FST_ERR_CTP_EMPTY_JSON_BODY (400).
  const jsonParser = (_req: any, body: string, done: (err: Error | null, value?: any) => void) => {
    if (!body || body.trim() === '') { done(null, {}); return; }
    try { done(null, JSON.parse(body)); } catch (err) { done(err as Error); }
  };
  // Catch-all parser: tolerate form-urlencoded / missing / unknown Content-Type bodies
  // (e.g. a browser POST to /api/auth/guest) instead of rejecting with 415.
  const anyParser = (req: any, body: string, done: (err: Error | null, value?: any) => void) => {
    if (!body || body.trim() === '') { done(null, {}); return; }
    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('application/x-www-form-urlencoded')) {
      done(null, Object.fromEntries(new URLSearchParams(body))); return;
    }
    try { done(null, JSON.parse(body)); } catch { done(null, {}); }
  };
  for (const app of [publicApp, adminApp]) {
    app.addContentTypeParser('application/json', { parseAs: 'string' }, jsonParser);
    app.addContentTypeParser('*', { parseAs: 'string' }, anyParser);
  }

  await publicApp.register(cors, { origin: corsOrigins, credentials: true });
  await adminApp.register(cors, { origin: corsOrigins, credentials: true });

  registerJwtAuthMiddleware(publicApp, jwtPort);
  registerJwtAuthMiddleware(adminApp, jwtPort);

  // Admin port: enforce ADMIN role
  adminApp.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') return;
    if (request.url === '/api/echo/status') return;
    // Dev-only test-data cleanup is exposed on the admin port for the robot harness.
    if (devEndpointsEnabled && request.url.startsWith('/api/dev/')) return;
    const authHeader = request.headers.authorization;
    if (!authHeader) { void reply.code(401).send({ error: 'Unauthorized' }); return; }
    const token = authHeader.replace('Bearer ', '');
    const payload = jwtPort.verify(token) as any;
    if (!payload) { void reply.code(401).send({ error: 'Unauthorized' }); return; }
    if (payload.role !== 'ADMIN') { void reply.code(403).send({ error: 'Forbidden' }); return; }
    const uuid = payload.uuid || payload.sub;
    (request as any).user = { uuid, username: payload.username, role: payload.role };
  });

  // Public port controllers
  registerEchoController(publicApp, echoService);
  registerGuestAuthController(publicApp, guestAuthService);
  registerSessionController(publicApp, sessionService);
  registerStoryController(publicApp, storyQueryService);
  registerMatchController(publicApp, matchCommandService, matchQueryService);
  registerContentController(publicApp, contentQueryService);
  registerDevController(publicApp, testDataCleanupService, devEndpointsEnabled);

  // Admin port controllers
  registerEchoController(adminApp, echoService);
  registerGuestAdminController(adminApp, guestAdminService);
  registerMatchAdminController(adminApp, matchCommandService, matchQueryService);
  registerStoryAdminController(adminApp, storyImportService, storyQueryService, storyRepo, storyCrudService);
  registerDevController(adminApp, testDataCleanupService, devEndpointsEnabled);

  // Error handlers — pass through 4xx (e.g. JSON parse errors) as-is
  publicApp.setErrorHandler(async (error: any, _request, reply) => {
    console.error(error);
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      reply.code(status).send({ error: 'BAD_REQUEST', message: error.message });
    } else {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });
  adminApp.setErrorHandler(async (error: any, _request, reply) => {
    console.error(error);
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      reply.code(status).send({ error: 'BAD_REQUEST', message: error.message });
    } else {
      reply.code(500).send({ error: 'Internal server error' });
    }
  });

  try {
    await publicApp.listen({ port: publicPort, host: '0.0.0.0' });
    console.log(`✓ Public API listening on port ${publicPort}`);
    await adminApp.listen({ port: adminPort, host: '0.0.0.0' });
    console.log(`✓ Admin API listening on port ${adminPort}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }

  process.on('SIGTERM', async () => {
    await publicApp.close();
    await adminApp.close();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await publicApp.close();
    await adminApp.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
