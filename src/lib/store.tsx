import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, LocalBackend, newId, supabase, type Session } from './backend';
import { rangeFor, type DateRange, type RangePreset } from './dates';
import type { CollectionName, Collections, DataSet, Role } from './types';

/** Which roles may edit each collection. Mirrors the row-level security policies in Supabase. */
export const WRITE_ACCESS: Record<CollectionName, Role[]> = {
  reports: ['coo', 'compliance', 'marketing'],
  sales: ['coo', 'compliance'],
  accounts: ['coo', 'compliance'],
  payments: ['coo', 'compliance'],
  interactions: ['coo', 'compliance'],
  paid: ['coo', 'marketing'],
  organic: ['coo', 'marketing'],
  retainers: ['coo', 'marketing'],
  deliverables: ['coo', 'marketing'],
  issues: ['coo', 'marketing'],
};

interface Store {
  data: DataSet | null;
  error: string | null;
  session: Session | null;
  setDemoRole: (r: Role) => void;
  signOut: () => Promise<void>;
  canWrite: (c: CollectionName) => boolean;
  add: <K extends CollectionName>(c: K, rows: Omit<Collections[K], 'id'>[]) => Promise<void>;
  update: <K extends CollectionName>(c: K, id: string, patch: Partial<Collections[K]>) => Promise<void>;
  remove: (c: CollectionName, id: string) => Promise<void>;
  reload: () => Promise<void>;
  resetDemo: () => Promise<void>;
  rangePreset: RangePreset;
  setRangePreset: (p: RangePreset) => void;
  range: DateRange;
  toast: string | null;
  notify: (msg: string) => void;
}

const Ctx = createContext<Store | null>(null);

const DEMO_ROLE_KEY = 'opshub.demoRole';
const RANGE_KEY = 'opshub.range';

function readLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* ignore */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(() =>
    supabase ? null : { email: 'demo@local', name: 'Demo user', role: (readLS(DEMO_ROLE_KEY) as Role) || 'coo' },
  );
  const [rangePreset, setRangePresetState] = useState<RangePreset>(() => (readLS(RANGE_KEY) as RangePreset) || '7d');
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }, []);

  const reload = useCallback(async () => {
    try {
      setData(await backend.loadAll());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Supabase auth: resolve the signed-in user's profile (name + role).
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase;
    const resolve = async (email: string | undefined, uid: string | undefined) => {
      if (!uid || !email) return setSession(null);
      const { data: profile } = await sb.from('profiles').select('full_name, role').eq('id', uid).maybeSingle();
      setSession({ email, name: profile?.full_name || email, role: (profile?.role as Role) || 'viewer' });
    };
    sb.auth.getSession().then(({ data: d }) => resolve(d.session?.user.email, d.session?.user.id));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => void resolve(s?.user.email, s?.user.id));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) void reload();
  }, [session, reload]);

  // Live updates: when anyone on any team saves something, refresh.
  useEffect(() => {
    if (!supabase || !session) return;
    const sb = supabase;
    let timer: number | undefined;
    const channel = sb
      .channel('opshub-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void reload(), 800);
      })
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [session, reload]);

  const canWrite = useCallback((c: CollectionName) => !!session && WRITE_ACCESS[c].includes(session.role), [session]);

  const add = useCallback(
    async <K extends CollectionName>(c: K, rows: Omit<Collections[K], 'id'>[]) => {
      const withIds = rows.map((r) => ({ ...r, id: newId() }) as Collections[K]);
      await backend.insert(c, withIds);
      setData((d) => (d ? { ...d, [c]: [...d[c], ...withIds] } : d));
    },
    [],
  );

  const update = useCallback(async <K extends CollectionName>(c: K, id: string, patch: Partial<Collections[K]>) => {
    await backend.update(c, id, patch);
    setData((d) =>
      d ? { ...d, [c]: (d[c] as Collections[K][]).map((r) => ((r as { id: string }).id === id ? { ...r, ...patch } : r)) } : d,
    );
  }, []);

  const remove = useCallback(async (c: CollectionName, id: string) => {
    await backend.remove(c, id);
    setData((d) => (d ? { ...d, [c]: (d[c] as { id: string }[]).filter((r) => r.id !== id) } : d));
  }, []);

  const value = useMemo<Store>(
    () => ({
      data,
      error,
      session,
      setDemoRole: (role) => {
        writeLS(DEMO_ROLE_KEY, role);
        setSession((s) => (s ? { ...s, role } : s));
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut();
      },
      canWrite,
      add,
      update,
      remove,
      reload,
      resetDemo: async () => {
        if (backend instanceof LocalBackend) {
          backend.reset();
          await reload();
        }
      },
      rangePreset,
      setRangePreset: (p) => {
        writeLS(RANGE_KEY, p);
        setRangePresetState(p);
      },
      range: rangeFor(rangePreset),
      toast,
      notify,
    }),
    [data, error, session, canWrite, add, update, remove, reload, rangePreset, toast, notify],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** Data is guaranteed loaded inside the app shell. */
export function useData() {
  const s = useStore();
  return { ...s, data: s.data as DataSet };
}
