/**
 * Calendar-day helpers in a user's IANA time zone, built on Intl only (no date library).
 * A "local date" is a `YYYY-MM-DD` string; ISO strings compare correctly with < and >.
 * Every function takes `now` explicitly so tests (and the server) control the clock.
 */

export type LocalDate = string;

const DAY_MS = 86_400_000;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    // en-CA formats dates as YYYY-MM-DD.
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The calendar date at instant `at` in `timeZone`. */
export function localDate(at: Date | number, timeZone: string): LocalDate {
  return formatter(timeZone).format(at);
}

function parse(date: LocalDate): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a local date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parse(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ya, ma, da] = parse(a);
  const [yb, mb, db] = parse(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY_MS);
}

/**
 * First instant (epoch ms) of `date` in `timeZone`. Binary search instead of offset math,
 * so DST gaps work, including zones where the clock jumps over midnight itself.
 * UTC offsets are within -12h..+14h, so the instant lies within ±15h of UTC midnight.
 */
export function startOfLocalDay(date: LocalDate, timeZone: string): number {
  const [y, m, d] = parse(date);
  const utcMidnight = Date.UTC(y, m - 1, d);
  let lo = utcMidnight - 15 * 3_600_000;
  let hi = utcMidnight + 15 * 3_600_000;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDate(mid, timeZone) >= date) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Milliseconds until the next local midnight: drives the "new tasks in…" countdown. */
export function msUntilNextLocalDay(now: Date | number, timeZone: string): number {
  const next = addDays(localDate(now, timeZone), 1);
  return startOfLocalDay(next, timeZone) - Number(now);
}
