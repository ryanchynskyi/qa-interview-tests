/**
 * Idempotent content seed: upserts every row from packages/content/data and
 * removes rows that no longer exist there. Safe to run any number of times.
 */
import { PrismaClient } from '@prisma/client';
import { loadContent } from '@qa-hub/content';

const prisma = new PrismaClient();

/** Runs upserts in transactions of `size` statements to keep round-trips low. */
async function inChunks<T>(rows: T[], size: number, op: (row: T) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await prisma.$transaction(chunk.map(op) as never);
  }
}

async function main() {
  const c = loadContent();

  // Parents before children.
  await inChunks(c.topics, 100, (t) =>
    prisma.topic.upsert({ where: { id: t.id }, create: t, update: t }),
  );
  await inChunks(c.sections, 100, (s) =>
    prisma.section.upsert({ where: { id: s.id }, create: s, update: s }),
  );
  await inChunks(c.chapters, 100, (ch) =>
    prisma.chapter.upsert({ where: { id: ch.id }, create: ch, update: ch }),
  );
  await inChunks(c.articles, 100, (a) =>
    prisma.article.upsert({ where: { id: a.id }, create: a, update: a }),
  );
  await inChunks(c.questions, 100, (q) =>
    prisma.question.upsert({ where: { id: q.id }, create: q, update: q }),
  );
  await inChunks(c.recallCards, 100, (r) =>
    prisma.recallCard.upsert({ where: { id: r.id }, create: r, update: r }),
  );

  // Children before parents.
  const keep = <T extends { id: string }>(rows: T[]) => ({ id: { notIn: rows.map((r) => r.id) } });
  const removed = [
    await prisma.recallCard.deleteMany({ where: keep(c.recallCards) }),
    await prisma.question.deleteMany({ where: keep(c.questions) }),
    await prisma.article.deleteMany({ where: keep(c.articles) }),
    await prisma.chapter.deleteMany({ where: keep(c.chapters) }),
    await prisma.section.deleteMany({ where: keep(c.sections) }),
    await prisma.topic.deleteMany({ where: keep(c.topics) }),
  ].reduce((n, r) => n + r.count, 0);

  console.log(
    `Seeded ${c.topics.length} topics, ${c.sections.length} sections, ${c.chapters.length} chapters, ` +
      `${c.articles.length} articles, ${c.questions.length} questions, ${c.recallCards.length} recall cards` +
      (removed ? `; removed ${removed} stale rows` : ''),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
