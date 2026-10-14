import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RankBars, TrendChart } from '../components/charts';
import { FormModal, unique, type FieldSpec } from '../components/FormModal';
import { Card, change, DataTable, Kpi, PageHead, RangePicker } from '../components/ui';
import { previousRange, todayKey } from '../lib/dates';
import { dateLabel, money, num, pct } from '../lib/format';
import { dailySeries, filterRange, groupSum, salesTotals } from '../lib/metrics';
import { useData } from '../lib/store';
import type { SalesEntry } from '../lib/types';

export default function Sales() {
  const { data, range, canWrite, add, update, remove, notify } = useData();
  const [editing, setEditing] = useState<Partial<SalesEntry> | null>(null);
  const [brand, setBrand] = useState('');
  const brands = unique(data.sales.map((s) => s.brand));
  const scoped = brand ? data.sales.filter((s) => s.brand === brand) : data.sales;
  const rows = filterRange(scoped, range);
  const prev = previousRange(range);
  const t = salesTotals(rows);
  const p = prev ? salesTotals(filterRange(scoped, prev)) : null;

  const trend = useMemo(() => dailySeries(rows, range, { booked: (r) => r.revenueBooked, collected: (r) => r.revenueCollected }), [rows, range]);

  const byRep = useMemo(() => {
    const m = new Map<string, SalesEntry[]>();
    for (const r of rows) m.set(r.rep, [...(m.get(r.rep) ?? []), r]);
    return [...m.entries()].map(([rep, rs]) => ({ rep, ...salesTotals(rs) }));
  }, [rows]);

  const fields: FieldSpec[] = [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'brand', label: 'Brand', type: 'text', required: true, suggestions: brands },
    { key: 'rep', label: 'Sales rep', type: 'text', required: true, suggestions: unique(data.sales.map((s) => s.rep)) },
    { key: 'leads', label: 'Leads', type: 'number', min: 0 },
    { key: 'calls', label: 'Calls', type: 'number', min: 0 },
    { key: 'dealsClosed', label: 'Deals closed', type: 'number', min: 0 },
    { key: 'revenueBooked', label: 'Revenue booked', type: 'number', min: 0 },
    { key: 'revenueCollected', label: 'Revenue collected', type: 'number', min: 0 },
    { key: 'refunds', label: 'Refunds issued', type: 'number', min: 0 },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];

  return (
    <div className="page">
      <PageHead title="Sales performance" sub="Reported by the compliance team. The funnel itself stays in the Sales Hub.">
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ width: 'auto' }} aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <RangePicker />
        {canWrite('sales') && (
          <>
            <Link to="/import?type=sales" className="btn">
              Paste from sheet
            </Link>
            <button className="primary" onClick={() => setEditing({ date: todayKey() })}>
              + Add entry
            </button>
          </>
        )}
      </PageHead>

      <div className="kpis">
        <Kpi label="Revenue booked" value={money(t.booked)} delta={change(t.booked, p?.booked)} />
        <Kpi label="Revenue collected" value={money(t.collected)} delta={change(t.collected, p?.collected)} />
        <Kpi label="Collection rate" value={pct(t.collectionRate, 0)} delta={change(t.collectionRate, p?.collectionRate)} />
        <Kpi label="Deals closed" value={num(t.deals)} delta={change(t.deals, p?.deals)} />
        <Kpi label="Close rate (deals / leads)" value={pct(t.closeRate)} delta={change(t.closeRate, p?.closeRate)} />
        <Kpi label="Average deal" value={money(t.avgDeal)} delta={change(t.avgDeal, p?.avgDeal)} />
        <Kpi label="Calls" value={num(t.calls)} delta={change(t.calls, p?.calls)} />
        <Kpi label="Refunds" value={money(t.refunds)} delta={change(t.refunds, p?.refunds)} invert />
      </div>

      <div className="grid g-2-1">
        <Card title="Booked vs collected" sub="Daily">
          <TrendChart data={trend} x="date" fmt={money} series={[{ key: 'booked', label: 'Booked' }, { key: 'collected', label: 'Collected' }]} />
        </Card>
        <Card title="Revenue booked by brand">
          <RankBars data={groupSum(rows, (r) => r.brand, (r) => r.revenueBooked)} fmt={money} />
        </Card>
      </div>

      <Card title="By sales rep">
        <DataTable
          rows={byRep}
          rowKey={(r) => r.rep}
          initialSort={{ key: 'booked', dir: 'desc' }}
          columns={[
            { key: 'rep', label: 'Rep', sort: (r) => r.rep, render: (r) => <b>{r.rep}</b> },
            { key: 'leads', label: 'Leads', align: 'r', sort: (r) => r.leads, render: (r) => num(r.leads) },
            { key: 'calls', label: 'Calls', align: 'r', sort: (r) => r.calls, render: (r) => num(r.calls) },
            { key: 'deals', label: 'Deals', align: 'r', sort: (r) => r.deals, render: (r) => num(r.deals) },
            { key: 'close', label: 'Close rate', align: 'r', sort: (r) => r.closeRate || 0, render: (r) => pct(r.closeRate) },
            { key: 'booked', label: 'Booked', align: 'r', sort: (r) => r.booked, render: (r) => money(r.booked) },
            { key: 'collected', label: 'Collected', align: 'r', sort: (r) => r.collected, render: (r) => money(r.collected) },
            { key: 'refunds', label: 'Refunds', align: 'r', sort: (r) => r.refunds, render: (r) => (r.refunds ? money(r.refunds) : '—') },
          ]}
        />
      </Card>

      <Card title="Entries" sub={canWrite('sales') ? 'Click a row to edit' : undefined}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          limit={25}
          onRowClick={canWrite('sales') ? setEditing : undefined}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', label: 'Date', sort: (r) => r.date, render: (r) => dateLabel(r.date) },
            { key: 'brand', label: 'Brand', sort: (r) => r.brand, render: (r) => r.brand },
            { key: 'rep', label: 'Rep', sort: (r) => r.rep, render: (r) => r.rep },
            { key: 'deals', label: 'Deals', align: 'r', sort: (r) => r.dealsClosed, render: (r) => r.dealsClosed },
            { key: 'booked', label: 'Booked', align: 'r', sort: (r) => r.revenueBooked, render: (r) => money(r.revenueBooked) },
            { key: 'collected', label: 'Collected', align: 'r', sort: (r) => r.revenueCollected, render: (r) => money(r.revenueCollected) },
            { key: 'notes', label: 'Notes', render: (r) => <span className="faint">{r.notes}</span> },
          ]}
        />
      </Card>

      {editing && (
        <FormModal
          title={editing.id ? 'Edit sales entry' : 'Add sales entry'}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? () => remove('sales', editing.id!) : undefined}
          onSubmit={async (v) => {
            const row = { leads: 0, calls: 0, dealsClosed: 0, revenueBooked: 0, revenueCollected: 0, refunds: 0, notes: '', ...v } as SalesEntry;
            if (editing.id) await update('sales', editing.id, row);
            else await add('sales', [row]);
            notify('Saved');
          }}
        />
      )}
    </div>
  );
}
