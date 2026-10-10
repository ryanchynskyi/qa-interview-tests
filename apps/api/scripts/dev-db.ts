/**
 * Local Postgres without Docker or a system install: downloads a Postgres binary
 * (via the embedded-postgres npm package) and keeps it running until Ctrl+C.
 * Data lives in apps/api/.pgdata (git-ignored). Same port/credentials as docker-compose.yml.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../.pgdata');
const PORT = 5433;
const DB = 'qahub';

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
  // Without this, initdb inherits the OS locale (e.g. WIN1251 on a Cyrillic Windows),
  // which cannot store characters like "ʼ" from the Ukrainian content.
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

const firstRun = !existsSync(resolve(dataDir, 'PG_VERSION'));
if (firstRun) {
  console.log('Initialising a new Postgres cluster in apps/api/.pgdata ...');
  await pg.initialise();
}
await pg.start();
if (firstRun) await pg.createDatabase(DB);

console.log(`Postgres is running: postgresql://postgres:postgres@localhost:${PORT}/${DB}`);
console.log('Press Ctrl+C to stop.');

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
