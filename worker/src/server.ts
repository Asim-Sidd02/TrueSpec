import Fastify from 'fastify';
import cors from '@fastify/cors';
import { runAudit } from './audit';
import { closeBrowser } from './scraper/scrapeDom';
import { AuditRequest } from './shared/types';

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });

app.register(cors, { origin: process.env.CORS_ORIGIN ?? true, methods: ['GET', 'POST', 'OPTIONS'] });

let running = 0;
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? 2);

const guarded = async (body: AuditRequest) => {
  running += 1;
  try {
    return await runAudit(body);
  } finally {
    running -= 1;
  }
};

app.get('/', async () => ({ name: 'figma-dom-qa-worker', endpoints: ['GET /health', 'POST /api/audit'] }));
app.get('/health', async () => ({ status: 'ok', running, time: new Date().toISOString() }));

app.post<{ Body: AuditRequest }>('/api/audit', async (request, reply) =>
  running >= MAX_CONCURRENT
    ? reply.code(503).send({ error: 'Worker busy. Please retry shortly.', statusCode: 503 })
    : guarded(request.body ?? ({} as AuditRequest)),
);

app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  status >= 500 && app.log.error(error);
  reply.code(status).send({ error: error.message || 'Internal error', statusCode: status });
});

const port = Number(process.env.PORT ?? 7860);

app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

const shutdown = (): void => {
  closeBrowser().finally(() => app.close().finally(() => process.exit(0)));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
