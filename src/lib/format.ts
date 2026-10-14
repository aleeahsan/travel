import { CURRENCY } from './config';

const moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0 });
const moneyFmt2 = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export const money = (n: number) => moneyFmt.format(n || 0);
export const money2 = (n: number) => (Number.isFinite(n) ? moneyFmt2.format(n) : '—');
export const num = (n: number) => numFmt.format(n || 0);
export const compact = (n: number) => compactFmt.format(n || 0);
export const pct = (n: number, digits = 1) => (Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : '—');
export const ratio = (n: number) => (Number.isFinite(n) ? `${n.toFixed(2)}×` : '—');

/** Safe division: returns NaN (rendered as —) instead of Infinity. */
export const div = (a: number, b: number) => (b ? a / b : NaN);

export function dateLabel(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function hourLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric' });
}

export const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
