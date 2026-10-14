// Paste-from-spreadsheet import.
//
// Teams copy rows straight out of Google Sheets / Excel (which copies as tab-separated
// text) or export a CSV. Headers are matched loosely, so "Revenue Collected",
// "revenue_collected" and "revenuecollected" all land in the same field.

import type { CollectionName } from './types';

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'list';

export interface ImportField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  aliases?: string[];
}

export const IMPORT_SPECS: Partial<Record<CollectionName, { label: string; fields: ImportField[] }>> = {
  sales: {
    label: 'Sales performance',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'brand', label: 'Brand', type: 'text', required: true },
      { key: 'rep', label: 'Rep', type: 'text', required: true, aliases: ['salesperson', 'agent', 'closer'] },
      { key: 'leads', label: 'Leads', type: 'number' },
      { key: 'calls', label: 'Calls', type: 'number' },
      { key: 'dealsClosed', label: 'Deals closed', type: 'number', aliases: ['deals', 'closed', 'sales'] },
      { key: 'revenueBooked', label: 'Revenue booked', type: 'number', aliases: ['booked', 'revenue', 'sales amount'] },
      { key: 'revenueCollected', label: 'Revenue collected', type: 'number', aliases: ['collected', 'cash collected'] },
      { key: 'refunds', label: 'Refunds', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'text' },
    ],
  },
  paid: {
    label: 'Paid marketing',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'brand', label: 'Brand', type: 'text', required: true, aliases: ['our brand'] },
      { key: 'clientBrand', label: 'Client brand', type: 'text', aliases: ['customer brand', 'client', 'customer'] },
      { key: 'channel', label: 'Channel', type: 'text', required: true, aliases: ['platform', 'network'] },
      { key: 'campaign', label: 'Campaign', type: 'text' },
      { key: 'spend', label: 'Spend', type: 'number', required: true, aliases: ['amount spent', 'cost'] },
      { key: 'impressions', label: 'Impressions', type: 'number', aliases: ['impr'] },
      { key: 'clicks', label: 'Clicks', type: 'number', aliases: ['link clicks'] },
      { key: 'leads', label: 'Leads', type: 'number' },
      { key: 'conversions', label: 'Conversions', type: 'number', aliases: ['purchases', 'results'] },
      { key: 'revenue', label: 'Revenue', type: 'number', aliases: ['conversion value', 'purchase value'] },
    ],
  },
  organic: {
    label: 'Organic marketing',
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true },
      { key: 'brand', label: 'Brand', type: 'text', required: true },
      { key: 'platform', label: 'Platform', type: 'text', required: true, aliases: ['channel'] },
      { key: 'posts', label: 'Posts', type: 'number' },
      { key: 'views', label: 'Views', type: 'number', aliases: ['video views', 'plays'] },
      { key: 'reach', label: 'Reach', type: 'number' },
      { key: 'likes', label: 'Likes', type: 'number', aliases: ['reactions'] },
      { key: 'comments', label: 'Comments', type: 'number' },
      { key: 'shares', label: 'Shares', type: 'number' },
      { key: 'saves', label: 'Saves', type: 'number' },
      { key: 'clicks', label: 'Clicks', type: 'number', aliases: ['link clicks', 'website clicks'] },
      { key: 'followersGained', label: 'Followers gained', type: 'number', aliases: ['new followers', 'follows'] },
    ],
  },
  payments: {
    label: 'Account payments',
    fields: [
      { key: 'accountId', label: 'Account name', type: 'text', required: true, aliases: ['account', 'client'] },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true, aliases: ['due'] },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'paidDate', label: 'Paid date', type: 'date', aliases: ['payment date', 'paid on'] },
      { key: 'paidAmount', label: 'Paid amount', type: 'number', aliases: ['paid', 'amount paid'] },
      { key: 'note', label: 'Note', type: 'text' },
    ],
  },
  deliverables: {
    label: 'Retainer deliverables',
    fields: [
      { key: 'retainerId', label: 'Retainer client', type: 'text', required: true, aliases: ['client', 'retainer'] },
      { key: 'title', label: 'Deliverable', type: 'text', required: true, aliases: ['title', 'task', 'name'] },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'dueDate', label: 'Due date', type: 'date', required: true, aliases: ['due', 'deadline'] },
      { key: 'deliveredDate', label: 'Delivered date', type: 'date', aliases: ['delivered', 'completed'] },
      { key: 'status', label: 'Status', type: 'text' },
      { key: 'progress', label: 'Progress %', type: 'number', aliases: ['progress'] },
      { key: 'qualityScore', label: 'Quality (1-5)', type: 'number', aliases: ['quality'] },
      { key: 'plannedQty', label: 'Planned qty', type: 'number', aliases: ['planned', 'quantity'] },
      { key: 'deliveredQty', label: 'Delivered qty', type: 'number' },
    ],
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Splits pasted text into rows. Handles tabs (sheet copy) or commas with "quoted, values". */
export function parseTable(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : ',';
  if (delim === '\t') return lines.map((l) => l.split('\t').map((c) => c.trim()));
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') {
        cells.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

/** Map each spec field to a column index (or -1 if not found). */
export function matchColumns(headers: string[], fields: ImportField[]): Record<string, number> {
  const normed = headers.map(norm);
  const out: Record<string, number> = {};
  for (const f of fields) {
    const candidates = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    out[f.key] = normed.findIndex((h) => candidates.includes(h));
  }
  return out;
}

export function parseNumber(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === '-' || s === '—') return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[^0-9.]/g, '');
  if (!s) return null;
  // "45%" is kept as 45, matching the 0-100 progress fields.
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Accepts 2026-10-14, 14/10/2026, 10/14/2026, 14-Oct-2026, Oct 14 2026.
 * Ambiguous dd/mm vs mm/dd uses `dayFirst` (most sheets outside the US are day-first).
 */
export function parseDate(raw: string, dayFirst = true): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return fmt(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (a > 12) return fmt(y, b, a);
    if (b > 12) return fmt(y, a, b);
    if (!dayFirst) [a, b] = [b, a];
    return fmt(y, b, a);
  }
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-,]+(\d{4})$/);
  if (m) return fmt(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) return fmt(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return null;
}

function fmt(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface ParsedRow {
  values: Record<string, string | number | null>;
  errors: string[];
}

export function convertRows(rows: string[][], fields: ImportField[], columns: Record<string, number>, dayFirst = true): ParsedRow[] {
  return rows.map((cells) => {
    const values: Record<string, string | number | null> = {};
    const errors: string[] = [];
    for (const f of fields) {
      const idx = columns[f.key];
      const raw = idx >= 0 ? (cells[idx] ?? '') : '';
      let v: string | number | null;
      if (f.type === 'number') {
        v = parseNumber(raw);
        if (raw.trim() && v === null) errors.push(`${f.label}: "${raw}" is not a number`);
      } else if (f.type === 'date') {
        v = parseDate(raw, dayFirst);
        if (raw.trim() && v === null) errors.push(`${f.label}: "${raw}" is not a date`);
      } else v = raw.trim() || null;
      if (f.required && (v === null || v === '')) errors.push(`${f.label} is required`);
      values[f.key] = v;
    }
    return { values, errors };
  });
}
