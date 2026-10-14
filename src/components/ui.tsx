import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BAND_LABELS, bandFor, TRACK_LABELS, type HealthBand, type TrackStatus } from '../lib/health';
import { RANGE_LABELS, type RangePreset } from '../lib/dates';
import { useStore } from '../lib/store';

const bandClass = (b: HealthBand) => (b === 'healthy' ? 'good' : b === 'watch' ? 'warn' : 'bad');
const BAND_ICON: Record<HealthBand, string> = { healthy: '●', watch: '▲', 'at-risk': '■' };

export function HealthPill({ score }: { score: number }) {
  const b = bandFor(score);
  return (
    <span className={`pill ${bandClass(b)}`} title={`Health score ${score}/100`}>
      <span aria-hidden>{BAND_ICON[b]}</span> {BAND_LABELS[b]}
    </span>
  );
}

export function Score({ score }: { score: number }) {
  return (
    <span className={`score ${bandClass(bandFor(score))}`} title="Health score out of 100">
      {score}
    </span>
  );
}

export function TrackPill({ track }: { track: TrackStatus }) {
  const cls = track === 'on-track' ? 'good' : track === 'at-risk' ? 'warn' : 'bad';
  const icon = track === 'on-track' ? '✓' : track === 'at-risk' ? '!' : '✕';
  return (
    <span className={`pill ${cls}`}>
      <span aria-hidden>{icon}</span> {TRACK_LABELS[track]}
    </span>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' }) {
  return <span className={`pill ${tone ?? ''}`}>{children}</span>;
}

export function ProgressBar({ value, tone }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`bar ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Kpi({
  label,
  value,
  foot,
  delta,
  invert,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  /** Fractional change vs previous period. */
  delta?: number | null;
  /** True when a decrease is good (e.g. cost per lead). */
  invert?: boolean;
}) {
  const showDelta = delta != null && Number.isFinite(delta);
  const good = showDelta && (invert ? delta! < 0 : delta! > 0);
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {(showDelta || foot) && (
        <div className="kpi-foot">
          {showDelta && (
            <span className={delta === 0 ? '' : good ? 'delta-up' : 'delta-down'}>
              {delta! > 0 ? '▲' : delta! < 0 ? '▼' : '■'} {Math.abs(delta! * 100).toFixed(1)}%
            </span>
          )}
          {foot}
        </div>
      )}
    </div>
  );
}

export const change = (cur: number, prev: number | undefined | null) =>
  prev == null || !prev || !Number.isFinite(prev) ? null : (cur - prev) / Math.abs(prev);

export function Card({ title, actions, children, sub }: { title?: ReactNode; actions?: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {sub && <div className="faint">{sub}</div>}
          </div>
          <div className="spacer" />
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted" style={{ marginTop: 4 }}>{sub}</p>}
      </div>
      <div className="spacer" />
      {children}
    </div>
  );
}

export function RangePicker({ allowed }: { allowed?: RangePreset[] }) {
  const { rangePreset, setRangePreset } = useStore();
  const opts = allowed ?? (Object.keys(RANGE_LABELS) as RangePreset[]);
  return (
    <select value={rangePreset} onChange={(e) => setRangePreset(e.target.value as RangePreset)} style={{ width: 'auto' }} aria-label="Date range">
      {opts.map((p) => (
        <option key={p} value={p}>
          {RANGE_LABELS[p]}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

// ------------------------------------------------------------ sortable table

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => number | string;
  align?: 'r';
  /** Footer cell (totals). */
  foot?: ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  initialSort,
  empty = 'No data for this period.',
  limit,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  empty?: ReactNode;
  limit?: number;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    return [...rows].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, columns, sort]);
  const visible = limit && !showAll ? sorted.slice(0, limit) : sorted;
  const hasFoot = columns.some((c) => c.foot !== undefined);

  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={`${c.align ?? ''} ${c.sort ? 'sortable' : ''}`}
                onClick={() =>
                  c.sort && setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'desc' }))
                }
                aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                {c.label}
                {sort?.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={rowKey(r)} className={onRowClick ? 'click' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} className={c.align ?? ''}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasFoot && (
          <tfoot>
            <tr>
              {columns.map((c) => (
                <td key={c.key} className={c.align ?? ''}>
                  {c.foot}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
      {limit && sorted.length > limit && (
        <div style={{ padding: '10px 0 2px' }}>
          <button className="small" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'Show less' : `Show all ${sorted.length}`}
          </button>
        </div>
      )}
    </div>
  );
}
