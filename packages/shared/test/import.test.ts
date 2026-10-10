import { describe, expect, it } from 'vitest';
import {
  clampDueAt,
  fromGuest,
  fromLegacy,
  importGrants,
  importPayloadSchema,
  parseLegacyDate,
  payloadSize,
} from '../src/import';

const now = new Date(2026, 9, 10, 12, 0).getTime(); // local time, like the legacy page
const index = { sql: ['qa', 'qb', 'qc'], api: ['qd'] };

describe('parseLegacyDate', () => {
  it('reads the uk-UA short format the legacy page wrote', () => {
    expect(parseLegacyDate('10.10.26, 13:15')).toBe(new Date(2026, 9, 10, 13, 15).getTime());
    expect(parseLegacyDate('1.2.2025 9:05')).toBe(new Date(2025, 1, 1, 9, 5).getTime());
  });
  it('returns null for anything else', () => {
    expect(parseLegacyDate('yesterday')).toBeNull();
    expect(parseLegacyDate(42)).toBeNull();
  });
});

describe('fromLegacy', () => {
  it('reads v3 saves keyed by question id, including cards and attempts', () => {
    const p = fromLegacy(
      {
        ver: 3,
        cur: 'sql',
        q: {
          sql: { hist: { qa: 1, qb: 0, zz: 1 }, attempts: [{ d: '09.10.26, 20:00', n: 10, y: 7 }] },
        },
        rc: { c1: { r: 4, n: 2, d: now + 1000, h: [2, 4] }, bad: { r: 9 } },
      },
      index,
      now,
    );
    expect(p.questions).toEqual({
      qa: { lastResult: 1, attempts: 1 },
      qb: { lastResult: 0, attempts: 1 },
    });
    expect(p.cards).toEqual({ c1: { rating: 4, reviews: 2, dueAt: now + 1000, history: [2, 4] } });
    expect(p.attempts.sql).toEqual([{ at: new Date(2026, 9, 9, 20, 0).getTime(), n: 10, y: 7 }]);
    expect(importPayloadSchema.parse(p)).toEqual(p);
  });

  it('maps v1 saves (answers keyed by position) through the legacy order', () => {
    const p = fromLegacy({ q: { sql: { hist: { '0': 1, '2': 0, '9': 1 } } } }, index, now);
    expect(p.questions).toEqual({
      qa: { lastResult: 1, attempts: 1 },
      qc: { lastResult: 0, attempts: 1 },
    });
  });

  it('accepts answers filed under the wrong section in v2 (ids are global)', () => {
    const p = fromLegacy({ ver: 2, q: { sql: { hist: { qd: 1 } } } }, index, now);
    expect(p.questions.qd).toEqual({ lastResult: 1, attempts: 1 });
  });

  it('drops impossible attempts and future dates', () => {
    const p = fromLegacy(
      {
        ver: 3,
        q: {
          sql: {
            hist: {},
            attempts: [
              { d: '10.10.26, 11:00', n: 5, y: 9 },
              { d: '10.10.30, 11:00', n: 5, y: 1 },
              { d: 'garbage', n: 5, y: 1 },
            ],
          },
        },
      },
      index,
      now,
    );
    expect(p.attempts).toEqual({});
  });

  it('rejects things that are not legacy saves', () => {
    expect(() => fromLegacy(null, index, now)).toThrow();
    expect(() => fromLegacy({ hello: 1 }, index, now)).toThrow();
    expect(() => fromLegacy('text', index, now)).toThrow();
  });
});

describe('fromGuest', () => {
  it('copies guest progress without XP or stats', () => {
    const p = fromGuest({
      questions: { qa: { lastResult: 1, attempts: 3 } },
      cards: { c1: { rating: 5, reviews: 1, dueAt: 5, history: [5] } },
      articlesRead: { 'sq-0:0': 7 },
      attempts: { sql: [{ at: 1, n: 10, y: 9 }] },
    });
    expect(p).toEqual({
      source: 'guest',
      questions: { qa: { lastResult: 1, attempts: 3 } },
      cards: { c1: { rating: 5, reviews: 1, dueAt: 5, history: [5] } },
      articlesRead: { 'sq-0:0': 7 },
      attempts: { sql: [{ at: 1, n: 10, y: 9 }] },
    });
    expect(payloadSize(p)).toBe(4);
  });
});

describe('importGrants', () => {
  it('applies the normal XP rules once per new item', () => {
    expect(
      importGrants({ correctLevels: ['junior', 'senior'], cardRatings: [3, 5], articles: 2 }),
    ).toEqual([
      { amount: 20, reason: 'import', refId: 'questions' },
      { amount: 8, reason: 'import', refId: 'cards' },
      { amount: 4, reason: 'import', refId: 'articles' },
    ]);
    expect(importGrants({ correctLevels: [], cardRatings: [], articles: 0 })).toEqual([]);
  });
});

describe('importPayloadSchema', () => {
  it('rejects out-of-range values', () => {
    const base = { source: 'guest', questions: {}, cards: {}, articlesRead: {}, attempts: {} };
    expect(
      importPayloadSchema.safeParse({ ...base, questions: { q: { lastResult: 2 } } }).success,
    ).toBe(false);
    expect(
      importPayloadSchema.safeParse({
        ...base,
        cards: { c: { rating: 6, reviews: 1, dueAt: 0, history: [] } },
      }).success,
    ).toBe(false);
    expect(importPayloadSchema.safeParse({ ...base, source: 'other' }).success).toBe(false);
  });
});

describe('clampDueAt', () => {
  it('keeps due dates within [0, now + 14 days]', () => {
    expect(clampDueAt(-5, now)).toBe(0);
    expect(clampDueAt(now + 100 * 86_400_000, now)).toBe(now + 14 * 86_400_000);
    expect(clampDueAt(now + 1000, now)).toBe(now + 1000);
  });
});
