import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RankBars, SERIES, TrendChart } from '../components/charts';
import { FormModal, unique, type FieldSpec } from '../components/FormModal';
import { Card, change, DataTable, Kpi, PageHead, RangePicker, Segmented, type Column } from '../components/ui';
import { CHANNELS } from '../lib/config';
import { previousRange, todayKey } from '../lib/dates';
import { compact, dateLabel, money, money2, num, pct, ratio } from '../lib/format';
import { dailySeries, filterRange, groupSum, paidTotals } from '../lib/metrics';
import { useData } from '../lib/store';
import type { PaidEntry } from '../lib/types';

type Dim = 'clientBrand' | 'brand' | 'channel' | 'campaign';
const DIM_LABELS: Record<Dim, string> = { clientBrand: 'Customer brand', brand: 'Our brand', channel: 'Channel', campaign: 'Campaign' };

type Row = ReturnType<typeof paidTotals> & { name: string };

const metricColumns: Column<Row>[] = [
  { key: 'spend', label: 'Spend', align: 'r', sort: (r) => r.spend, render: (r) => money(r.spend) },
  { key: 'impressions', label: 'Impr.', align: 'r', sort: (r) => r.impressions, render: (r) => compact(r.impressions) },
  { key: 'clicks', label: 'Clicks', align: 'r', sort: (r) => r.clicks, render: (r) => num(r.clicks) },
  { key: 'ctr', label: 'CTR', align: 'r', sort: (r) => r.ctr || 0, render: (r) => pct(r.ctr, 2) },
  { key: 'cpc', label: 'CPC', align: 'r', sort: (r) => r.cpc || 0, render: (r) => money2(r.cpc) },
  { key: 'leads', label: 'Leads', align: 'r', sort: (r) => r.leads, render: (r) => num(r.leads) },
  { key: 'cpl', label: 'CPL', align: 'r', sort: (r) => r.cpl || 0, render: (r) => money2(r.cpl) },
  { key: 'conv', label: 'Conv.', align: 'r', sort: (r) => r.conversions, render: (r) => num(r.conversions) },
  { key: 'cpa', label: 'CPA', align: 'r', sort: (r) => r.cpa || 0, render: (r) => money2(r.cpa) },
  { key: 'revenue', label: 'Revenue', align: 'r', sort: (r) => r.revenue, render: (r) => money(r.revenue) },
  { key: 'roas', label: 'ROAS', align: 'r', sort: (r) => r.roas || 0, render: (r) => ratio(r.roas) },
];

export default function PaidMarketing() {
  const { data, range, canWrite, add, update, remove, notify } = useData();
  const [dim, setDim] = useState<Dim>('clientBrand');
  const [brand, setBrand] = useState('');
  const [editing, setEditing] = useState<Partial<PaidEntry> | null>(null);
  const brands = unique(data.paid.map((p) => p.brand));
  const scoped = brand ? data.paid.filter((p) => p.brand === brand) : data.paid;
  const rows = filterRange(scoped, range);
  const prev = previousRange(range);
  const t = paidTotals(rows);
  const p = prev ? paidTotals(filterRange(scoped, prev)) : null;

  // Colour each of our brands by a fixed slot so it keeps its colour across charts and filters.
  const brandColor = (b: string) => SERIES[Math.max(0, unique(data.paid.map((x) => x.brand)).indexOf(b)) % SERIES.length];

  const spendTrend = useMemo(() => {
    const fields: Record<string, (r: PaidEntry) => number> = {};
    for (const b of brands) fields[b] = (r) => (r.brand === b ? r.spend : 0);
    return dailySeries(rows, range, fields);
  }, [rows, range, brands]);
  const shownBrands = brand ? [brand] : brands;

  const breakdown = useMemo<Row[]>(() => {
    const m = new Map<string, PaidEntry[]>();
    for (const r of rows) m.set(r[dim] || '—', [...(m.get(r[dim] || '—') ?? []), r]);
    return [...m.entries()].map(([name, rs]) => ({ name, ...paidTotals(rs) }));
  }, [rows, dim]);

  const fields: FieldSpec[] = [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'brand', label: 'Our brand', type: 'text', required: true, suggestions: brands },
    { key: 'clientBrand', label: 'Customer brand', type: 'text', suggestions: unique(data.paid.map((x) => x.clientBrand)), hint: 'Same as our brand for in-house campaigns' },
    { key: 'channel', label: 'Channel', type: 'text', required: true, suggestions: unique([...CHANNELS, ...data.paid.map((x) => x.channel)]) },
    { key: 'campaign', label: 'Campaign', type: 'text', suggestions: unique(data.paid.map((x) => x.campaign)) },
    { key: 'spend', label: 'Spend', type: 'number', required: true, min: 0 },
    { key: 'impressions', label: 'Impressions', type: 'number', min: 0 },
    { key: 'clicks', label: 'Clicks', type: 'number', min: 0 },
    { key: 'leads', label: 'Leads', type: 'number', min: 0 },
    { key: 'conversions', label: 'Conversions', type: 'number', min: 0 },
    { key: 'revenue', label: 'Revenue / conversion value', type: 'number', min: 0 },
  ];

  return (
    <div className="page">
      <PageHead title="Paid marketing" sub="Spend and results per brand, customer brand, channel and campaign.">
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ width: 'auto' }} aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <RangePicker />
        {canWrite('paid') && (
          <>
            <Link to="/import?type=paid" className="btn">
              Paste from sheet
            </Link>
            <button className="primary" onClick={() => setEditing({ date: todayKey() })}>
              + Add entry
            </button>
          </>
        )}
      </PageHead>

      <div className="kpis">
        <Kpi label="Spend" value={money(t.spend)} delta={change(t.spend, p?.spend)} />
        <Kpi label="Impressions" value={compact(t.impressions)} delta={change(t.impressions, p?.impressions)} />
        <Kpi label="Clicks" value={num(t.clicks)} delta={change(t.clicks, p?.clicks)} />
        <Kpi label="CTR" value={pct(t.ctr, 2)} delta={change(t.ctr, p?.ctr)} />
        <Kpi label="CPC" value={money2(t.cpc)} delta={change(t.cpc, p?.cpc)} invert />
        <Kpi label="CPM" value={money2(t.cpm)} delta={change(t.cpm, p?.cpm)} invert />
        <Kpi label="Leads" value={num(t.leads)} delta={change(t.leads, p?.leads)} />
        <Kpi label="Cost per lead" value={money2(t.cpl)} delta={change(t.cpl, p?.cpl)} invert />
        <Kpi label="Conversions" value={num(t.conversions)} delta={change(t.conversions, p?.conversions)} />
        <Kpi label="Cost per acquisition" value={money2(t.cpa)} delta={change(t.cpa, p?.cpa)} invert />
        <Kpi label="Revenue" value={money(t.revenue)} delta={change(t.revenue, p?.revenue)} />
        <Kpi label="ROAS" value={ratio(t.roas)} delta={change(t.roas, p?.roas)} />
      </div>

      <div className="grid g-2-1">
        <Card title="Daily spend by brand" sub="Stacked: the top edge is total spend">
          <TrendChart
            data={spendTrend}
            x="date"
            fmt={money}
            stacked
            series={shownBrands.map((b) => ({ key: b, label: b, color: brandColor(b) }))}
          />
        </Card>
        <Card title="Spend per brand">
          <RankBars data={groupSum(rows, (r) => r.brand, (r) => r.spend)} fmt={money} colorBy={brandColor} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Spend per customer brand">
          <RankBars data={groupSum(rows, (r) => r.clientBrand || r.brand, (r) => r.spend)} fmt={money} />
        </Card>
        <Card title="Spend per channel">
          <RankBars data={groupSum(rows, (r) => r.channel, (r) => r.spend)} fmt={money} />
        </Card>
      </div>

      <Card
        title="Performance breakdown"
        actions={<Segmented value={dim} onChange={setDim} options={(Object.keys(DIM_LABELS) as Dim[]).map((d) => ({ value: d, label: DIM_LABELS[d] }))} />}
      >
        <DataTable
          rows={breakdown}
          rowKey={(r) => r.name}
          initialSort={{ key: 'spend', dir: 'desc' }}
          columns={[{ key: 'name', label: DIM_LABELS[dim], sort: (r) => r.name, render: (r) => <b>{r.name}</b> }, ...metricColumns]}
        />
      </Card>

      <Card title="Entries" sub={canWrite('paid') ? 'Click a row to edit' : undefined}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          limit={25}
          onRowClick={canWrite('paid') ? setEditing : undefined}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', label: 'Date', sort: (r) => r.date, render: (r) => dateLabel(r.date) },
            { key: 'brand', label: 'Brand', sort: (r) => r.brand, render: (r) => r.brand },
            { key: 'client', label: 'Customer brand', sort: (r) => r.clientBrand, render: (r) => r.clientBrand },
            { key: 'channel', label: 'Channel', sort: (r) => r.channel, render: (r) => r.channel },
            { key: 'campaign', label: 'Campaign', render: (r) => r.campaign },
            { key: 'spend', label: 'Spend', align: 'r', sort: (r) => r.spend, render: (r) => money(r.spend) },
            { key: 'clicks', label: 'Clicks', align: 'r', sort: (r) => r.clicks, render: (r) => num(r.clicks) },
            { key: 'leads', label: 'Leads', align: 'r', sort: (r) => r.leads, render: (r) => num(r.leads) },
          ]}
        />
      </Card>

      {editing && (
        <FormModal
          title={editing.id ? 'Edit paid entry' : 'Add paid entry'}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? () => remove('paid', editing.id!) : undefined}
          onSubmit={async (v) => {
            const row = { campaign: '', ...v, clientBrand: (v.clientBrand as string) || (v.brand as string) } as PaidEntry;
            if (editing.id) await update('paid', editing.id, row);
            else await add('paid', [row]);
            notify('Saved');
          }}
        />
      )}
    </div>
  );
}
