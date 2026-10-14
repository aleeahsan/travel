// Date helpers. Calendar dates are stored as local YYYY-MM-DD strings.

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayKey = () => toDateKey(new Date());

export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  const db = new Date(`${b.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

export type RangePreset = 'today' | '7d' | '30d' | 'mtd' | '90d' | 'all';

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  mtd: 'Month to date',
  '90d': 'Last 90 days',
  all: 'All time',
};

export interface DateRange {
  from: string;
  to: string;
}

export function rangeFor(preset: RangePreset, today = todayKey()): DateRange {
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'mtd':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'all':
      return { from: '0000-01-01', to: '9999-12-31' };
  }
}

/** The equally long period immediately before `r`, for period-over-period comparisons. */
export function previousRange(r: DateRange): DateRange | null {
  if (r.from.startsWith('0000')) return null;
  const len = daysBetween(r.from, r.to) + 1;
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}

export const inRange = (date: string, r: DateRange) => {
  const k = date.slice(0, 10);
  return k >= r.from && k <= r.to;
};

export function eachDay(r: DateRange): string[] {
  const out: string[] = [];
  for (let k = r.from; k <= r.to; k = addDays(k, 1)) out.push(k);
  return out;
}
