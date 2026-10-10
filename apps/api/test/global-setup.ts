/**
 * Prepares the integration-test database once per run: creates it if missing,
 * applies migrations and seeds content. Tests create their own users with unique
 * emails, so runs don't interfere and no cleanup is needed.
 */
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) await prepareDatabase(url);
}

/** Creates the database if missing, then migrates and seeds it. Also used by the e2e server. */
export async function prepareDatabase(url: string) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Unexpected test database name: ${name}`);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const db = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    const exists = await db.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (!exists.length) await db.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await db.$disconnect();
  }

  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx prisma migrate deploy', { cwd: apiDir, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd: apiDir, env, stdio: 'pipe' });
}
