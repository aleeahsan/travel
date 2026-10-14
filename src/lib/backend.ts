// Storage backends.
//
// - Supabase (shared): used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
//   Every team reads and writes the same database; access is enforced by row-level
//   security in supabase/migrations.
// - Local (demo): data lives in this browser's localStorage, seeded with sample data.
//   Nothing is shared between people in this mode.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildSeed } from './seed';
import type { CollectionName, Collections, DataSet, Role } from './types';

export const COLLECTIONS: CollectionName[] = [
  'reports',
  'sales',
  'paid',
  'organic',
  'retainers',
  'deliverables',
  'issues',
  'accounts',
  'payments',
  'interactions',
];

/** Supabase table for each collection. */
export const TABLES: Record<CollectionName, string> = {
  reports: 'reports',
  sales: 'sales_entries',
  paid: 'paid_entries',
  organic: 'organic_entries',
  retainers: 'retainers',
  deliverables: 'deliverables',
  issues: 'retainer_issues',
  accounts: 'accounts',
  payments: 'payments',
  interactions: 'interactions',
};

export interface Session {
  email: string;
  name: string;
  role: Role;
}

export interface Backend {
  kind: 'local' | 'supabase';
  loadAll(): Promise<DataSet>;
  insert<K extends CollectionName>(c: K, rows: Collections[K][]): Promise<Collections[K][]>;
  update<K extends CollectionName>(c: K, id: string, patch: Partial<Collections[K]>): Promise<void>;
  remove(c: CollectionName, id: string): Promise<void>;
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;

// ------------------------------------------------------------------ local

const LS_KEY = 'opshub.data.v1';

export class LocalBackend implements Backend {
  kind = 'local' as const;
  private data: DataSet | null = null;

  async loadAll() {
    if (!this.data) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        this.data = raw ? (JSON.parse(raw) as DataSet) : null;
      } catch {
        this.data = null;
      }
      if (!this.data) {
        this.data = buildSeed();
        this.persist();
      }
      for (const c of COLLECTIONS) this.data[c] ??= [];
    }
    return structuredClone(this.data);
  }

  private persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.data));
    } catch {
      // Storage full or blocked: keep working in memory for this session.
    }
  }

  async insert<K extends CollectionName>(c: K, rows: Collections[K][]) {
    await this.loadAll();
    (this.data![c] as Collections[K][]).push(...rows);
    this.persist();
    return rows;
  }

  async update<K extends CollectionName>(c: K, id: string, patch: Partial<Collections[K]>) {
    await this.loadAll();
    const list = this.data![c] as Collections[K][];
    const i = list.findIndex((r) => (r as { id: string }).id === id);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    this.persist();
  }

  async remove(c: CollectionName, id: string) {
    await this.loadAll();
    (this.data![c] as { id: string }[]) = (this.data![c] as { id: string }[]).filter((r) => r.id !== id);
    this.persist();
  }

  reset() {
    localStorage.removeItem(LS_KEY);
    this.data = null;
  }
}

// --------------------------------------------------------------- supabase

const toSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// Only top-level keys are converted; json columns (metrics, kpis, flags…) keep their inner shape.
const rowToDb = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [toSnake(k), v]));
const rowFromDb = (row: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => k !== 'created_by')
      .map(([k, v]) => [toCamel(k), v]),
  );

export class SupabaseBackend implements Backend {
  kind = 'supabase' as const;
  client: SupabaseClient;
  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async loadAll() {
    const entries = await Promise.all(
      COLLECTIONS.map(async (c) => {
        const rows: Record<string, unknown>[] = [];
        // Page through results; PostgREST caps a single response (1000 rows by default).
        for (let from = 0; ; from += 1000) {
          const { data, error } = await this.client.from(TABLES[c]).select('*').range(from, from + 999);
          if (error) throw new Error(`${TABLES[c]}: ${error.message}`);
          rows.push(...data);
          if (data.length < 1000) break;
        }
        return [c, rows.map(rowFromDb)] as const;
      }),
    );
    return Object.fromEntries(entries) as unknown as DataSet;
  }

  async insert<K extends CollectionName>(c: K, rows: Collections[K][]) {
    const { error } = await this.client.from(TABLES[c]).insert(rows.map((r) => rowToDb(r as unknown as Record<string, unknown>)));
    if (error) throw new Error(error.message);
    return rows;
  }

  async update<K extends CollectionName>(c: K, id: string, patch: Partial<Collections[K]>) {
    const { error } = await this.client.from(TABLES[c]).update(rowToDb(patch as Record<string, unknown>)).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async remove(c: CollectionName, id: string) {
    const { error } = await this.client.from(TABLES[c]).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const backend: Backend = supabase ? new SupabaseBackend(supabase) : new LocalBackend();
