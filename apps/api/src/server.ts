import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const db = new PrismaClient();
const app = await buildApp({
  db,
  webOrigin: config.WEB_ORIGIN,
  logger: config.NODE_ENV === 'development' ? { level: 'info' } : true,
});

const shutdown = async () => {
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
