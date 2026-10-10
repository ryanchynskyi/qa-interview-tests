import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  isValidTimeZone,
  localDate,
  msUntilNextLocalDay,
  startOfLocalDay,
} from '../../src/engine/time';

const t = (iso: string) => Date.parse(iso);
const H = 3_600_000;

describe('localDate', () => {
  it('flips at local midnight, not UTC midnight', () => {
    expect(localDate(t('2026-10-10T03:59:59Z'), 'America/New_York')).toBe('2026-10-09');
    expect(localDate(t('2026-10-10T04:00:00Z'), 'America/New_York')).toBe('2026-10-10');
    expect(localDate(t('2026-10-09T14:59:59Z'), 'Asia/Tokyo')).toBe('2026-10-09');
    expect(localDate(t('2026-10-09T15:00:00Z'), 'Asia/Tokyo')).toBe('2026-10-10');
  });

  it('gives different dates for the same instant across zones', () => {
    const at = t('2026-10-09T23:30:00Z');
    expect(localDate(at, 'Europe/Kyiv')).toBe('2026-10-10');
    expect(localDate(at, 'UTC')).toBe('2026-10-09');
    expect(localDate(at, 'America/Los_Angeles')).toBe('2026-10-09');
  });
});

describe('startOfLocalDay', () => {
  it('finds local midnight on an ordinary day', () => {
    expect(startOfLocalDay('2026-10-10', 'Europe/Kyiv')).toBe(t('2026-10-09T21:00:00Z'));
    expect(startOfLocalDay('2026-10-10', 'Asia/Tokyo')).toBe(t('2026-10-09T15:00:00Z'));
    expect(startOfLocalDay('2026-10-10', 'Pacific/Kiritimati')).toBe(t('2026-10-09T10:00:00Z'));
    expect(startOfLocalDay('2026-10-10', 'Pacific/Pago_Pago')).toBe(t('2026-10-10T11:00:00Z'));
  });

  it('handles DST: Kyiv has a 23h day in March and a 25h day in October', () => {
    const len = (d: string) =>
      startOfLocalDay(addDays(d, 1), 'Europe/Kyiv') - startOfLocalDay(d, 'Europe/Kyiv');
    expect(len('2026-03-29')).toBe(23 * H);
    expect(len('2026-10-25')).toBe(25 * H);
    expect(len('2026-10-26')).toBe(24 * H);
  });

  it('handles a zone where the clock skips midnight (Santiago, 2026-09-06)', () => {
    // 23:59 on the 5th is followed by 01:00 on the 6th.
    expect(startOfLocalDay('2026-09-06', 'America/Santiago')).toBe(t('2026-09-06T04:00:00Z'));
  });
});

describe('msUntilNextLocalDay', () => {
  it('counts down to the next local midnight', () => {
    expect(msUntilNextLocalDay(t('2026-10-10T20:00:00Z'), 'Europe/Kyiv')).toBe(1 * H);
    expect(msUntilNextLocalDay(t('2026-10-09T21:00:00Z'), 'Europe/Kyiv')).toBe(24 * H);
  });

  it('accounts for the 25h day at the DST change', () => {
    expect(msUntilNextLocalDay(t('2026-10-24T21:00:00Z'), 'Europe/Kyiv')).toBe(25 * H);
  });
});

describe('date arithmetic', () => {
  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts whole days between dates', () => {
    expect(daysBetween('2026-10-10', '2026-10-10')).toBe(0);
    expect(daysBetween('2026-10-10', '2026-10-12')).toBe(2);
    expect(daysBetween('2026-10-12', '2026-10-10')).toBe(-2);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('rejects malformed dates', () => {
    expect(() => addDays('10/10/2026', 1)).toThrow();
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA names and rejects junk', () => {
    expect(isValidTimeZone('Europe/Kyiv')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
