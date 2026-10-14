import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { compact } from '../lib/format';

/** Categorical slots in fixed order. Colour follows the series, never its rank. */
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

export interface Series {
  key: string;
  label: string;
  color?: string;
}

type Fmt = (n: number) => string;

function Tip({ active, payload, label, fmt, labelFmt }: Partial<TooltipContentProps<number, string>> & { fmt: Fmt; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="t">{labelFmt ? labelFmt(String(label)) : label}</div>
      {payload.map((p) => (
        <div className="l" key={String(p.dataKey)}>
          <span>
            <i style={{ background: p.color }} />
            {p.name}
          </span>
          <b className="num">{fmt(Number(p.value))}</b>
        </div>
      ))}
    </div>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <div className="legend" style={{ marginBottom: 8 }}>
      {series.map((s, i) => (
        <span key={s.key}>
          <i style={{ background: s.color ?? SERIES[i] }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

const shortDate = (k: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
    const d = new Date(`${k}T00:00:00`);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  return k;
};

/** Trend over time. Multiple series are stacked only when `stacked` (parts of a whole). */
export function TrendChart({
  data,
  x,
  series,
  fmt = compact,
  height = 240,
  stacked = false,
}: {
  data: Record<string, number | string>[];
  x: string;
  series: Series[];
  fmt?: Fmt;
  height?: number;
  stacked?: boolean;
}) {
  return (
    <div>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" />
          <XAxis dataKey={x} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickFormatter={(v) => fmt(Number(v))} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={(p) => <Tip {...(p as TooltipContentProps<number, string>)} fmt={fmt} labelFmt={shortDate} />} cursor={{ stroke: 'var(--text-3)', strokeDasharray: '3 3' }} />
          {series.map((s, i) => {
            const color = s.color ?? SERIES[i];
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={stacked ? 0.55 : series.length > 1 ? 0.06 : 0.12}
                stackId={stacked ? 'a' : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars — for comparing magnitudes across named categories. */
export function RankBars({
  data,
  fmt = compact,
  color = 'var(--s1)',
  height,
  colorBy,
}: {
  data: { name: string; value: number }[];
  fmt?: Fmt;
  color?: string;
  height?: number;
  /** Optional fixed colour per category (keeps identity consistent across charts). */
  colorBy?: (name: string) => string;
}) {
  const h = height ?? Math.max(120, data.length * 34 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={(p) => <Tip {...(p as TooltipContentProps<number, string>)} fmt={fmt} />}
        />
        <Bar
          dataKey="value"
          name="Value"
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          label={{ position: 'right', formatter: (v: unknown) => fmt(Number(v)), fill: 'var(--text-2)', fontSize: 11 }}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={colorBy ? colorBy(d.name) : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Vertical bars over a time/ordinal axis (e.g. hours of the day). */
export function ColumnChart({
  data,
  x,
  series,
  fmt = compact,
  height = 220,
  xFmt,
}: {
  data: Record<string, number | string>[];
  x: string;
  series: Series[];
  fmt?: Fmt;
  height?: number;
  xFmt?: (v: string) => string;
}) {
  return (
    <div>
      <Legend series={series} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={x} tickLine={false} axisLine={false} tickFormatter={xFmt} />
          <YAxis tickFormatter={(v) => fmt(Number(v))} tickLine={false} axisLine={false} width={64} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={(p) => <Tip {...(p as TooltipContentProps<number, string>)} fmt={fmt} labelFmt={xFmt} />} />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
