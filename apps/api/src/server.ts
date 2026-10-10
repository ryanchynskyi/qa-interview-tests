import { PrismaClient } from '@prisma/client';
import { buildApp } from './app';
import { createGoogleOAuth } from './auth/google';
import { loadConfig } from './config';

const config = loadConfig();
const db = new PrismaClient();
const app = await buildApp({
  db,
  webOrigin: config.WEB_ORIGIN,
  jwtSecret: config.JWT_SECRET,
  cookieSecure: config.cookieSecure,
  crossSiteCookies: config.COOKIE_SAMESITE === 'none',
  trustProxy: config.TRUST_PROXY,
  webAppUrl: config.WEB_APP_URL,
  google:
    config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET && config.GOOGLE_REDIRECT_URI
      ? createGoogleOAuth({
          clientId: config.GOOGLE_CLIENT_ID,
          clientSecret: config.GOOGLE_CLIENT_SECRET,
          redirectUri: config.GOOGLE_REDIRECT_URI,
        })
      : null,
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
