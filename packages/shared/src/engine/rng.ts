/**
 * Deterministic PRNG (mulberry32). Seeding with `${userKey}:${localDate}` makes daily
 * task generation repeatable: the same user gets the same tasks for a given day on
 * the server, in the guest store and in tests.
 */
export type Rng = () => number;

/** FNV-1a 32-bit as an unsigned integer (same algorithm as `fnv1a` in ../hash). */
function seedOf(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: string): Rng {
  let a = seedOf(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (!items.length) throw new Error('pick() from an empty list');
  return items[Math.floor(rng() * items.length)]!;
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
