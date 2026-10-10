/**
 * Server-side progress for signed-in users. Every mutation runs in one transaction
 * that locks the user's row (so parallel requests can't double-count XP or tasks),
 * applies the shared engine, and persists item state, stats, daily tasks and the
 * XP ledger together. The engine is the same code the guest store runs in the browser.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  applyAnswer,
  applyArticleRead,
  applyRecall,
  clampDueAt,
  emptyCounts,
  ensureDaily,
  generateDailyTasks,
  importGrants,
  levelFromXp,
  localDate,
  quizBonus,
  recordActivity,
  taskContentFromCatalog,
  weakChapters,
  type ActivityEvent,
  type AnswerOutcome,
  type CardProgress,
  type Catalog,
  type DailyState,
  type DailyTask,
  type ImportPayload,
  type ImportResult,
  type PlayerProgress,
  type PlayerStats,
  type ProgressUpdate,
  type QuestionProgress,
  type QuizAttemptRecord,
  type XpGrant,
} from '@qa-hub/shared';
import { HttpError, notFound } from '../lib/errors';

type Tx = Prisma.TransactionClient;

const XP_LOG_SIZE = 100;
const ATTEMPTS_SHOWN = 20;
/** finishQuiz only accepts questions answered this recently (one sitting). */
const RUN_WINDOW_MS = 6 * 60 * 60 * 1000;

const toQuestionProgress = (s: {
  lastResult: number;
  attempts: number;
  firstCorrectAt: Date | null;
  lastXpDate: string | null;
}): QuestionProgress => ({
  lastResult: s.lastResult === 1 ? 1 : 0,
  attempts: s.attempts,
  firstCorrectAt: s.firstCorrectAt?.getTime() ?? null,
  lastXpDate: s.lastXpDate,
});

const toCardProgress = (s: {
  rating: number;
  reviews: number;
  dueAt: Date;
  history: number[];
}): CardProgress => ({
  rating: s.rating,
  reviews: s.reviews,
  dueAt: s.dueAt.getTime(),
  history: s.history,
});

const toTask = (r: {
  date: string;
  slot: number;
  type: string;
  params: Prisma.JsonValue;
  target: number;
  progress: number;
  rewardXp: number;
  completedAt: Date | null;
}): DailyTask => ({
  id: `${r.date}:${r.slot}`,
  date: r.date,
  slot: r.slot,
  type: r.type as DailyTask['type'],
  params: (r.params ?? {}) as DailyTask['params'],
  target: r.target,
  progress: r.progress,
  rewardXp: r.rewardXp,
  completedAt: r.completedAt?.getTime() ?? null,
});

interface Player {
  timeZone: string;
  stats: PlayerStats;
  daily: DailyState | null;
}

export class ProgressService {
  constructor(
    private readonly db: PrismaClient,
    private readonly catalog: () => Promise<Catalog>,
    private readonly now: () => number,
  ) {}

  /* ---------- shared plumbing ---------- */

  private async inTx<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.$transaction(async (tx) => {
      // Serialises all progress writes of one user.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (!locked.length) throw new HttpError(401, 'unauthorized', 'Account not found');
      return fn(tx);
    });
  }

  /** Loads stats and today's tasks, creating the day's task set if it's a new local day. */
  private async loadPlayer(tx: Tx, userId: string, now: number): Promise<Player> {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timeZone: true, stats: true },
    });
    const s = user.stats ?? (await tx.userStats.create({ data: { userId } }));
    const stats: PlayerStats = {
      totalXp: s.totalXp,
      streak: s.streak,
      longestStreak: s.longestStreak,
      lastActiveDate: s.lastActiveDate,
    };

    const latest = await tx.dailyTask.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { slot: 'asc' }],
      take: 3,
    });
    const date = latest[0]?.date;
    const current: DailyState | null = date
      ? { date, tasks: latest.filter((r) => r.date === date).map(toTask) }
      : null;

    const today = localDate(now, user.timeZone);
    let daily = current;
    if (!current || today > current.date) {
      const catalog = await this.catalog();
      const situation = await this.situation(tx, userId, catalog, now);
      daily = ensureDaily(current, today, (d) =>
        generateDailyTasks(userId, d, taskContentFromCatalog(catalog), situation),
      );
      await tx.dailyTask.createMany({
        data: daily.tasks.map((t) => ({
          userId,
          date: t.date,
          slot: t.slot,
          type: t.type,
          params: t.params as Prisma.InputJsonValue,
          target: t.target,
          progress: t.progress,
          rewardXp: t.rewardXp,
        })),
        skipDuplicates: true,
      });
    }
    return { timeZone: user.timeZone, stats, daily };
  }

  private async situation(tx: Tx, userId: string, catalog: Catalog, now: number) {
    const [qs, cs] = await Promise.all([
      tx.questionState.findMany({
        where: { userId },
        select: { questionId: true, lastResult: true },
      }),
      tx.cardState.findMany({ where: { userId } }),
    ]);
    const questions: Record<string, 0 | 1> = {};
    for (const q of qs) questions[q.questionId] = q.lastResult === 1 ? 1 : 0;
    const cards: Record<string, CardProgress> = {};
    for (const c of cs) cards[c.cardId] = toCardProgress(c);
    return {
      weakChapterIds: weakChapters(catalog, { questions, cards }, now).map((c) => c.chapterId),
      dueCards: cs.filter((c) => c.dueAt.getTime() <= now).length,
    };
  }

  /** Tasks, streak, bonuses and the XP ledger for one activity. */
  private async record(
    tx: Tx,
    userId: string,
    player: Player,
    event: ActivityEvent,
    itemGrants: XpGrant[],
  ) {
    const result = recordActivity({
      stats: player.stats,
      daily: player.daily,
      event,
      itemGrants,
      timeZone: player.timeZone,
    });
    const s = result.stats;
    await tx.userStats.update({
      where: { userId },
      data: {
        totalXp: s.totalXp,
        streak: s.streak,
        longestStreak: s.longestStreak,
        lastActiveDate: s.lastActiveDate,
      },
    });
    const before = new Map(player.daily?.tasks.map((t) => [t.id, t]) ?? []);
    for (const t of result.daily?.tasks ?? []) {
      const old = before.get(t.id);
      if (old && old.progress === t.progress && old.completedAt === t.completedAt) continue;
      await tx.dailyTask.update({
        where: { userId_date_slot: { userId, date: t.date, slot: t.slot } },
        data: {
          progress: t.progress,
          completedAt: t.completedAt === null ? null : new Date(t.completedAt),
        },
      });
    }
    if (result.grants.length) {
      await tx.xpEvent.createMany({
        data: result.grants.map((g) => ({
          userId,
          amount: g.amount,
          reason: g.reason,
          refId: g.refId ?? null,
          at: new Date(event.at),
        })),
      });
    }
    return result;
  }

  /* ---------- reads ---------- */

  async snapshot(userId: string): Promise<PlayerProgress> {
    const now = this.now();
    return this.inTx(userId, async (tx) => {
      const player = await this.loadPlayer(tx, userId, now);
      const [qs, cs, reads, attempts, xp] = await Promise.all([
        tx.questionState.findMany({ where: { userId } }),
        tx.cardState.findMany({ where: { userId } }),
        tx.articleRead.findMany({ where: { userId } }),
        tx.quizAttempt.findMany({ where: { userId }, orderBy: { at: 'desc' } }),
        tx.xpEvent.findMany({ where: { userId }, orderBy: { at: 'desc' }, take: XP_LOG_SIZE }),
      ]);

      const progress: PlayerProgress = {
        timeZone: player.timeZone,
        questions: {},
        cards: {},
        articlesRead: {},
        attempts: {},
        stats: player.stats,
        daily: player.daily,
        xpLog: xp.reverse().map((e) => ({
          amount: e.amount,
          reason: e.reason as XpGrant['reason'],
          ...(e.refId ? { refId: e.refId } : {}),
          at: e.at.getTime(),
        })),
      };
      for (const q of qs) progress.questions[q.questionId] = toQuestionProgress(q);
      for (const c of cs) progress.cards[c.cardId] = toCardProgress(c);
      for (const r of reads) progress.articlesRead[r.articleId] = r.readAt.getTime();
      for (const a of attempts) {
        const list = (progress.attempts[a.sectionId] ??= []);
        if (list.length < ATTEMPTS_SHOWN)
          list.push({ at: a.at.getTime(), n: a.answered, y: a.correct });
      }
      return progress;
    });
  }

  /* ---------- mutations ---------- */

  async answer(
    userId: string,
    questionId: string,
    outcome: AnswerOutcome,
  ): Promise<ProgressUpdate> {
    const now = this.now();
    const q = await this.db.question.findUnique({
      where: { id: questionId },
      select: {
        level: true,
        sectionId: true,
        chapterId: true,
        section: { select: { topicId: true } },
      },
    });
    if (!q) throw notFound('question');

    return this.inTx(userId, async (tx) => {
      const player = await this.loadPlayer(tx, userId, now);
      const prevRow = await tx.questionState.findUnique({
        where: { userId_questionId: { userId, questionId } },
      });
      const item = applyAnswer(
        prevRow ? toQuestionProgress(prevRow) : undefined,
        { questionId, level: q.level, outcome },
        { now, timeZone: player.timeZone },
      );
      const data = {
        lastResult: item.next.lastResult,
        attempts: item.next.attempts,
        firstCorrectAt:
          item.next.firstCorrectAt === null ? null : new Date(item.next.firstCorrectAt),
        lastXpDate: item.next.lastXpDate,
        answeredAt: new Date(now),
      };
      await tx.questionState.upsert({
        where: { userId_questionId: { userId, questionId } },
        create: { userId, questionId, ...data },
        update: data,
      });
      const result = await this.record(
        tx,
        userId,
        player,
        {
          type: 'answer',
          at: now,
          questionId,
          sectionId: q.sectionId,
          topicId: q.section.topicId,
          chapterId: q.chapterId,
          outcome,
        },
        item.grants,
      );
      return { result, at: now, question: { id: questionId, state: item.next } };
    });
  }

  /**
   * Records a finished run. The client only names the questions; correctness comes
   * from stored state, and every question must have been answered in this sitting.
   */
  async finishQuiz(
    userId: string,
    sectionId: string,
    questionIds: string[],
  ): Promise<ProgressUpdate> {
    const now = this.now();
    const ids = [...new Set(questionIds)];
    const inSection = await this.db.question.count({ where: { id: { in: ids }, sectionId } });
    if (inSection !== ids.length) {
      throw new HttpError(400, 'bad_request', 'questionIds: not all in this section');
    }

    return this.inTx(userId, async (tx) => {
      const states = await tx.questionState.findMany({
        where: { userId, questionId: { in: ids } },
        select: { lastResult: true, answeredAt: true },
      });
      const recent = states.filter((s) => s.answeredAt.getTime() >= now - RUN_WINDOW_MS);
      if (recent.length !== ids.length) {
        throw new HttpError(409, 'not_answered', 'Not every question of this run was answered');
      }
      const lastAnswer = new Date(Math.max(...recent.map((s) => s.answeredAt.getTime())));
      const dup = await tx.quizAttempt.findFirst({
        where: { userId, sectionId, at: { gte: lastAnswer } },
        select: { id: true },
      });
      if (dup) throw new HttpError(409, 'already_finished', 'This run was already recorded');

      const correct = recent.filter((s) => s.lastResult === 1).length;
      const attempt: QuizAttemptRecord = { at: now, n: ids.length, y: correct };
      await tx.quizAttempt.create({
        data: { userId, sectionId, answered: ids.length, correct, at: new Date(now) },
      });
      const player = await this.loadPlayer(tx, userId, now);
      const result = await this.record(
        tx,
        userId,
        player,
        { type: 'quiz_finish', at: now, sectionId, answered: ids.length, correct },
        quizBonus(ids.length, correct),
      );
      return { result, at: now, attempt: { sectionId, attempt } };
    });
  }

  async rate(userId: string, cardId: string, rating: number): Promise<ProgressUpdate> {
    const now = this.now();
    const card = await this.db.recallCard.findUnique({
      where: { id: cardId },
      select: { topicId: true, chapterId: true },
    });
    if (!card) throw notFound('card');

    return this.inTx(userId, async (tx) => {
      const player = await this.loadPlayer(tx, userId, now);
      const prevRow = await tx.cardState.findUnique({
        where: { userId_cardId: { userId, cardId } },
      });
      const item = applyRecall(prevRow ? toCardProgress(prevRow) : undefined, rating, cardId, {
        now,
        timeZone: player.timeZone,
      });
      const data = {
        rating: item.next.rating,
        reviews: item.next.reviews,
        dueAt: new Date(item.next.dueAt),
        history: item.next.history,
      };
      await tx.cardState.upsert({
        where: { userId_cardId: { userId, cardId } },
        create: { userId, cardId, ...data },
        update: data,
      });
      const result = await this.record(
        tx,
        userId,
        player,
        {
          type: 'recall',
          at: now,
          cardId,
          topicId: card.topicId,
          chapterId: card.chapterId,
          rating,
          wasDue: item.wasDue,
        },
        item.grants,
      );
      return { result, at: now, card: { id: cardId, state: item.next } };
    });
  }

  async readArticle(userId: string, articleId: string): Promise<ProgressUpdate> {
    const now = this.now();
    const article = await this.db.article.findUnique({
      where: { id: articleId },
      select: { chapterId: true, chapter: { select: { topicId: true } } },
    });
    if (!article) throw notFound('article');

    return this.inTx(userId, async (tx) => {
      const player = await this.loadPlayer(tx, userId, now);
      const existing = await tx.articleRead.findUnique({
        where: { userId_articleId: { userId, articleId } },
      });
      if (!existing)
        await tx.articleRead.create({ data: { userId, articleId, readAt: new Date(now) } });
      const result = await this.record(
        tx,
        userId,
        player,
        {
          type: 'article_read',
          at: now,
          articleId,
          topicId: article.chapter.topicId,
          chapterId: article.chapterId,
        },
        applyArticleRead(!!existing, articleId),
      );
      return {
        result,
        at: now,
        articleRead: { id: articleId, at: existing?.readAt.getTime() ?? now },
      };
    });
  }

  /**
   * Moves guest/legacy progress into the account. Unknown content is skipped, anything
   * the account already has wins, timestamps are clamped to [2020, now], and XP comes
   * from the normal rules applied once to each newly added item. Re-importing the same
   * data therefore adds nothing.
   */
  async importProgress(userId: string, p: ImportPayload): Promise<ImportResult> {
    const now = this.now();
    const floor = Date.UTC(2020, 0, 1);
    const at = (t: number | undefined) =>
      new Date(t === undefined ? now : Math.min(Math.max(t, floor), now));

    const [questions, cards, articles, sections] = await Promise.all([
      this.db.question.findMany({
        where: { id: { in: Object.keys(p.questions) } },
        select: { id: true, level: true },
      }),
      this.db.recallCard.findMany({
        where: { id: { in: Object.keys(p.cards) } },
        select: { id: true },
      }),
      this.db.article.findMany({
        where: { id: { in: Object.keys(p.articlesRead) } },
        select: { id: true },
      }),
      this.db.section.findMany({
        where: { id: { in: Object.keys(p.attempts) } },
        select: { id: true },
      }),
    ]);

    return this.inTx(userId, async (tx) => {
      const [haveQ, haveC, haveA, haveAttempts] = await Promise.all([
        tx.questionState.findMany({
          where: { userId, questionId: { in: questions.map((q) => q.id) } },
          select: { questionId: true },
        }),
        tx.cardState.findMany({
          where: { userId, cardId: { in: cards.map((c) => c.id) } },
          select: { cardId: true },
        }),
        tx.articleRead.findMany({
          where: { userId, articleId: { in: articles.map((a) => a.id) } },
          select: { articleId: true },
        }),
        tx.quizAttempt.findMany({
          where: { userId, sectionId: { in: sections.map((s) => s.id) } },
          select: { sectionId: true, at: true },
        }),
      ]);
      const hasQ = new Set(haveQ.map((r) => r.questionId));
      const hasC = new Set(haveC.map((r) => r.cardId));
      const hasA = new Set(haveA.map((r) => r.articleId));
      const hasAttempt = new Set(haveAttempts.map((r) => `${r.sectionId}@${r.at.getTime()}`));

      const newQ = questions.filter((q) => !hasQ.has(q.id));
      const newC = cards.filter((c) => !hasC.has(c.id));
      const newA = articles.filter((a) => !hasA.has(a.id));
      const newAttempts = sections.flatMap((s) =>
        (p.attempts[s.id] ?? [])
          .filter((a) => a.at <= now && a.y <= a.n && !hasAttempt.has(`${s.id}@${a.at}`))
          .map((a) => ({
            userId,
            sectionId: s.id,
            answered: a.n,
            correct: a.y,
            at: new Date(a.at),
          })),
      );

      await tx.questionState.createMany({
        data: newQ.map((q) => {
          const src = p.questions[q.id]!;
          const when = at(src.answeredAt);
          return {
            userId,
            questionId: q.id,
            lastResult: src.lastResult,
            attempts: src.attempts ?? 1,
            firstCorrectAt: src.lastResult === 1 ? when : null,
            lastXpDate: null,
            answeredAt: when,
          };
        }),
      });
      await tx.cardState.createMany({
        data: newC.map((c) => {
          const src = p.cards[c.id]!;
          return {
            userId,
            cardId: c.id,
            rating: src.rating,
            reviews: src.reviews,
            dueAt: new Date(clampDueAt(src.dueAt, now)),
            history: src.history.length ? src.history : [src.rating],
          };
        }),
      });
      await tx.articleRead.createMany({
        data: newA.map((a) => ({ userId, articleId: a.id, readAt: at(p.articlesRead[a.id]) })),
      });
      await tx.quizAttempt.createMany({ data: newAttempts });

      const grants = importGrants({
        correctLevels: newQ.filter((q) => p.questions[q.id]!.lastResult === 1).map((q) => q.level),
        cardRatings: newC.map((c) => p.cards[c.id]!.rating),
        articles: newA.length,
      });
      const xpGained = grants.reduce((n, g) => n + g.amount, 0);
      const stats = await tx.userStats.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      if (xpGained) {
        await tx.userStats.update({
          where: { userId },
          data: { totalXp: stats.totalXp + xpGained },
        });
        await tx.xpEvent.createMany({
          data: grants.map((g) => ({
            userId,
            amount: g.amount,
            reason: g.reason,
            refId: `${p.source}:${g.refId}`,
            at: new Date(now),
          })),
        });
      }
      const before = levelFromXp(stats.totalXp).level;
      const after = levelFromXp(stats.totalXp + xpGained).level;

      const total = (o: object) => Object.keys(o).length;
      const attemptsIn = Object.values(p.attempts).reduce((n, a) => n + a.length, 0);
      return {
        imported: {
          questions: newQ.length,
          cards: newC.length,
          articles: newA.length,
          attempts: newAttempts.length,
        },
        skipped: {
          ...emptyCounts(),
          questions: total(p.questions) - newQ.length,
          cards: total(p.cards) - newC.length,
          articles: total(p.articlesRead) - newA.length,
          attempts: attemptsIn - newAttempts.length,
        },
        xpGained,
        levelUp: after > before ? { from: before, to: after } : null,
      };
    });
  }

  /** Clears one section's answers and attempts. Earned XP stays. */
  async resetSection(userId: string, sectionId: string): Promise<void> {
    await this.inTx(userId, async (tx) => {
      await tx.questionState.deleteMany({ where: { userId, question: { sectionId } } });
      await tx.quizAttempt.deleteMany({ where: { userId, sectionId } });
    });
  }
}
