/**
 * Moving progress between stores: the guest store and the legacy single-page app
 * (localStorage `qa-hub-v1`, or its "Скопіювати прогрес" backup text) into an account.
 *
 * Sources are converted in the browser into one normalised payload; the server validates
 * it, keeps whatever it already has (server state wins), and recomputes XP itself from
 * the newly added items. Imported XP never trusts the source's own XP numbers.
 */
import { z } from 'zod';
import type { Level } from './content';
import type { CardProgress } from './engine/items';
import { RECALL_INTERVAL_DAYS } from './engine/items';
import { XP_RULES, type XpGrant } from './engine/xp';

const id = z.string().min(1).max(64);
const time = z.number().int().nonnegative();

export const importPayloadSchema = z.object({
  source: z.enum(['guest', 'legacy']),
  questions: z
    .record(
      id,
      z.object({
        lastResult: z.union([z.literal(0), z.literal(1)]),
        attempts: z.number().int().min(1).max(100_000).optional(),
        answeredAt: time.optional(),
      }),
    )
    .refine((r) => Object.keys(r).length <= 5000, 'too many questions'),
  cards: z
    .record(
      id,
      z.object({
        rating: z.number().int().min(1).max(5),
        reviews: z.number().int().min(1).max(100_000),
        dueAt: time,
        history: z.array(z.number().int().min(1).max(5)).max(5),
      }),
    )
    .refine((r) => Object.keys(r).length <= 2000, 'too many cards'),
  articlesRead: z
    .record(id, time)
    .refine((r) => Object.keys(r).length <= 2000, 'too many articles'),
  attempts: z
    .record(
      id,
      z
        .array(
          z.object({
            at: time,
            n: z.number().int().min(1).max(1000),
            y: z.number().int().min(0).max(1000),
          }),
        )
        .max(20),
    )
    .refine((r) => Object.keys(r).length <= 100, 'too many sections'),
});
export type ImportPayload = z.infer<typeof importPayloadSchema>;

export interface ImportCounts {
  questions: number;
  cards: number;
  articles: number;
  attempts: number;
}
export interface ImportResult {
  imported: ImportCounts;
  /** Unknown ids, or items the destination already had. */
  skipped: ImportCounts;
  xpGained: number;
  levelUp: { from: number; to: number } | null;
}

export const emptyCounts = (): ImportCounts => ({
  questions: 0,
  cards: 0,
  articles: 0,
  attempts: 0,
});

export const payloadSize = (p: ImportPayload) =>
  Object.keys(p.questions).length +
  Object.keys(p.cards).length +
  Object.keys(p.articlesRead).length +
  Object.values(p.attempts).reduce((n, a) => n + a.length, 0);

/**
 * XP for newly imported items, using the normal rules once per item: first-correct XP
 * by level, one due-review grant per card, first-read XP per article. No quiz bonuses,
 * streaks or tasks: those belong to days that can't be replayed.
 */
export function importGrants(input: {
  correctLevels: Level[];
  cardRatings: number[];
  articles: number;
}): XpGrant[] {
  const grants: XpGrant[] = [];
  const q = input.correctLevels.reduce((s, l) => s + XP_RULES.firstCorrect[l], 0);
  const c = input.cardRatings.reduce(
    (s, r) => s + (r >= 4 ? XP_RULES.recallDueGood : XP_RULES.recallDue),
    0,
  );
  const a = input.articles * XP_RULES.articleFirstRead;
  if (q) grants.push({ amount: q, reason: 'import', refId: 'questions' });
  if (c) grants.push({ amount: c, reason: 'import', refId: 'cards' });
  if (a) grants.push({ amount: a, reason: 'import', refId: 'articles' });
  return grants;
}

/* ---------- legacy single-page app ---------- */

export const LEGACY_STORAGE_KEY = 'qa-hub-v1';

/** Question ids per section in legacy order (index i = the i-th question): for v1 saves. */
export type LegacyIndex = Record<string, readonly string[]>;

/** "10.10.26, 13:15" (uk-UA short date/time, local time) → epoch ms. */
export function parseLegacyDate(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4}),?\s+(\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const year = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const t = new Date(year, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5])).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Converts a legacy save (any version) into an import payload, mirroring the legacy
 * page's own migrate(): v1 keyed answers by position, v2+ by question id.
 * Throws if the input doesn't look like a legacy save at all.
 */
export function fromLegacy(raw: unknown, index: LegacyIndex, now: number): ImportPayload {
  if (!raw || typeof raw !== 'object') throw new Error('Not a progress backup');
  const r = raw as { ver?: unknown; q?: unknown; rc?: unknown };
  if (!r.q && !r.rc) throw new Error('Not a progress backup');
  const ver = typeof r.ver === 'number' ? r.ver : 1;

  const payload: ImportPayload = {
    source: 'legacy',
    questions: {},
    cards: {},
    articlesRead: {},
    attempts: {},
  };
  const known = new Set(Object.values(index).flat());

  const sections = r.q && typeof r.q === 'object' ? (r.q as Record<string, unknown>) : {};
  for (const [sec, value] of Object.entries(sections)) {
    if (!value || typeof value !== 'object') continue;
    const { hist, attempts } = value as { hist?: unknown; attempts?: unknown };
    if (hist && typeof hist === 'object') {
      for (const [key, v] of Object.entries(hist as Record<string, unknown>)) {
        if (v !== 0 && v !== 1) continue;
        const qid = ver >= 2 ? key : /^\d+$/.test(key) ? index[sec]?.[Number(key)] : undefined;
        if (qid && known.has(qid)) payload.questions[qid] = { lastResult: v, attempts: 1 };
      }
    }
    if (Array.isArray(attempts) && index[sec]) {
      const list = attempts
        .slice(0, 20)
        .map((a: { d?: unknown; n?: unknown; y?: unknown }) => ({
          at: parseLegacyDate(a?.d),
          n: Number(a?.n),
          y: Number(a?.y),
        }))
        .filter(
          (a): a is { at: number; n: number; y: number } =>
            a.at !== null &&
            a.at <= now &&
            Number.isInteger(a.n) &&
            a.n >= 1 &&
            Number.isInteger(a.y) &&
            a.y >= 0 &&
            a.y <= a.n,
        );
      if (list.length) payload.attempts[sec] = list;
    }
  }

  if (r.rc && typeof r.rc === 'object') {
    for (const [cid, v] of Object.entries(r.rc as Record<string, unknown>)) {
      const o = v as { r?: unknown; n?: unknown; d?: unknown; h?: unknown } | null;
      const rating = Number(o?.r);
      if (!o || !Number.isInteger(rating) || rating < 1 || rating > 5) continue;
      const history = (Array.isArray(o.h) ? o.h : [rating])
        .map(Number)
        .filter((x) => Number.isInteger(x) && x >= 1 && x <= 5)
        .slice(-5);
      payload.cards[cid] = {
        rating,
        reviews: Math.max(1, Math.floor(Number(o.n) || 1)),
        dueAt: Math.max(0, Math.floor(Number(o.d) || 0)),
        history: history.length ? history : [rating],
      };
    }
  }
  return payload;
}

/* ---------- guest store ---------- */

export interface GuestProgressLike {
  questions: Record<string, { lastResult: 0 | 1; attempts: number }>;
  cards: Record<string, CardProgress>;
  articlesRead: Record<string, number>;
  attempts: Record<string, { at: number; n: number; y: number }[]>;
}

export function fromGuest(g: GuestProgressLike): ImportPayload {
  const questions: ImportPayload['questions'] = {};
  for (const [qid, q] of Object.entries(g.questions)) {
    questions[qid] = { lastResult: q.lastResult, attempts: Math.max(1, q.attempts) };
  }
  const cards: ImportPayload['cards'] = {};
  for (const [cid, c] of Object.entries(g.cards)) {
    cards[cid] = {
      rating: c.rating,
      reviews: Math.max(1, c.reviews),
      dueAt: c.dueAt,
      history: c.history.slice(-5),
    };
  }
  const attempts: ImportPayload['attempts'] = {};
  for (const [sec, list] of Object.entries(g.attempts)) attempts[sec] = list.slice(0, 20);
  return { source: 'guest', questions, cards, articlesRead: { ...g.articlesRead }, attempts };
}

/** Keeps imported due dates sane: never earlier than "due now", never beyond the longest interval. */
export function clampDueAt(dueAt: number, now: number): number {
  const max = now + RECALL_INTERVAL_DAYS[RECALL_INTERVAL_DAYS.length - 1]! * 86_400_000;
  return Math.min(Math.max(dueAt, 0), max);
}
