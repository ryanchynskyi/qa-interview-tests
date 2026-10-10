import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { api } from '../api';
import { useCatalog } from '../hooks/content';
import { GuestStore, STORAGE_KEY, skillProgressOf, type ProgressState } from './guest-store';

const StoreContext = createContext<GuestStore | null>(null);

function createStore(): GuestStore {
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Blocked storage (some private modes): fall back to memory.
  }
  const memory = new Map<string, string>();
  return new GuestStore({
    storage: storage ?? {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
    },
    checkAnswer: api.checkAnswer,
  });
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createStore);
  const { data: catalog } = useCatalog();

  useEffect(() => {
    if (catalog) store.setCatalog(catalog);
  }, [catalog, store]);

  useEffect(() => {
    // New local day while the tab stays open, and progress written by other tabs.
    const onFocus = () => store.refreshDaily();
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && store.reload();
    const timer = window.setInterval(onFocus, 60_000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): GuestStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore() outside <ProgressProvider>');
  return store;
}

export function useProgress(): ProgressState {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Skill-engine view of progress, recomputed only when progress changes. */
export function useSkillProgress() {
  const state = useProgress();
  return useMemo(() => skillProgressOf(state), [state]);
}
