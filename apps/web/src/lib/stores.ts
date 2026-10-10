import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Tiny external store for UI state that must outlive a component (e.g. a recall
 * session kept while the user switches tabs), updated immutably.
 */
export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const get = () => value;
  const set = (next: T | ((prev: T) => T)) => {
    value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
    listeners.forEach((fn) => fn());
  };
  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const use = () => useSyncExternalStore(subscribe, get);
  return { get, set, use };
}

/** Current time as state, refreshed every `ms`, so renders stay pure. */
export function useNow(ms = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
