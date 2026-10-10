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
import { useAuth } from '../auth/AuthProvider';
import { useCatalog } from '../hooks/content';
import { LoadError, Loading } from '../lib/ui';
import { GuestStore, STORAGE_KEY, skillProgressOf } from './guest-store';
import { ServerStore } from './server-store';
import type { ProgressRepo, ProgressState } from './types';

const StoreContext = createContext<ProgressRepo | null>(null);

function browserStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return window.localStorage;
  } catch {
    // Blocked storage (some private modes): fall back to memory.
    const memory = new Map<string, string>();
    return { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
  }
}

const createGuestStore = () =>
  new GuestStore({ storage: browserStorage(), checkAnswer: api.checkAnswer });

/** Guests use localStorage; signed-in users use the API. Views can't tell the difference. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const [guest] = useState(createGuestStore);
  const user = auth.status === 'user' ? auth.user : null;
  const userId = user?.id ?? null;
  const server = useMemo(
    () => (user ? new ServerStore({ api, user, storage: browserStorage() }) : null),
    // A new store only when the account changes, not on every auth object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId],
  );
  const [loaded, setLoaded] = useState<ServerStore | null>(null);
  const [error, setError] = useState<unknown>(null);
  const { data: catalog } = useCatalog();

  useEffect(() => {
    if (!server) return;
    let cancelled = false;
    server.load().then(
      () => !cancelled && setLoaded(server),
      (e: unknown) => !cancelled && setError(e),
    );
    return () => {
      cancelled = true;
    };
  }, [server]);

  const repo: ProgressRepo = server ?? guest;

  useEffect(() => {
    if (catalog) repo.setCatalog(catalog);
  }, [catalog, repo]);

  useEffect(() => {
    // New local day while the tab stays open, and guest progress written by other tabs.
    const onFocus = () => repo.refreshDaily();
    const onStorage = (e: StorageEvent) => {
      if (repo instanceof GuestStore && e.key === STORAGE_KEY) repo.reload();
    };
    const timer = window.setInterval(onFocus, 60_000);
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [repo]);

  if (auth.status === 'loading') return <Shell />;
  if (server && loaded !== server) {
    return (
      <Shell>{error ? <LoadError error={error} retry={() => location.reload()} /> : null}</Shell>
    );
  }
  return <StoreContext.Provider value={repo}>{children}</StoreContext.Provider>;
}

function Shell({ children }: { children?: ReactNode }) {
  return <div className="wrap">{children ?? <Loading />}</div>;
}

export function useStore(): ProgressRepo {
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
