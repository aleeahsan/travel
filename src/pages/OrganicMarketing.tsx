import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RankBars, TrendChart } from '../components/charts';
import { FormModal, unique, type FieldSpec } from '../components/FormModal';
import { Card, change, DataTable, Kpi, PageHead, RangePicker, Segmented } from '../components/ui';
import { PLATFORMS } from '../lib/config';
import { previousRange, todayKey } from '../lib/dates';
import { compact, dateLabel, num, pct } from '../lib/format';
import { dailySeries, filterRange, groupSum, organicTotals } from '../lib/metrics';
import { useData } from '../lib/store';
import type { OrganicEntry } from '../lib/types';

type Dim = 'brand' | 'platform';

export default function OrganicMarketing() {
  const { data, range, canWrite, add, update, remove, notify } = useData();
  const [dim, setDim] = useState<Dim>('platform');
  const [brand, setBrand] = useState('');
  const [editing, setEditing] = useState<Partial<OrganicEntry> | null>(null);
  const brands = unique(data.organic.map((o) => o.brand));
  const scoped = brand ? data.organic.filter((o) => o.brand === brand) : data.organic;
  const rows = filterRange(scoped, range);
  const prev = previousRange(range);
  const t = organicTotals(rows);
  const p = prev ? organicTotals(filterRange(scoped, prev)) : null;

  const trend = useMemo(() => dailySeries(rows, range, { views: (r) => r.views, reach: (r) => r.reach }), [rows, range]);
  const engTrend = useMemo(
    () => dailySeries(rows, range, { engagements: (r) => r.likes + r.comments + r.shares + r.saves, clicks: (r) => r.clicks }),
    [rows, range],
  );

  const breakdown = useMemo(() => {
    const m = new Map<string, OrganicEntry[]>();
    for (const r of rows) m.set(r[dim], [...(m.get(r[dim]) ?? []), r]);
    return [...m.entries()].map(([name, rs]) => ({ name, ...organicTotals(rs) }));
  }, [rows, dim]);

  const fields: FieldSpec[] = [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'brand', label: 'Brand', type: 'text', required: true, suggestions: brands },
    { key: 'platform', label: 'Platform', type: 'text', required: true, suggestions: unique([...PLATFORMS, ...data.organic.map((o) => o.platform)]) },
    { key: 'posts', label: 'Posts published', type: 'number', min: 0 },
    { key: 'views', label: 'Views', type: 'number', min: 0 },
    { key: 'reach', label: 'Reach', type: 'number', min: 0 },
    { key: 'likes', label: 'Likes', type: 'number', min: 0 },
    { key: 'comments', label: 'Comments', type: 'number', min: 0 },
    { key: 'shares', label: 'Shares', type: 'number', min: 0 },
    { key: 'saves', label: 'Saves', type: 'number', min: 0 },
    { key: 'clicks', label: 'Link / profile clicks', type: 'number', min: 0 },
    { key: 'followersGained', label: 'Followers gained', type: 'number' },
  ];

  return (
    <div className="page">
      <PageHead title="Organic marketing" sub="Views, reach, clicks and engagement across every brand and platform.">
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ width: 'auto' }} aria-label="Brand">
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
        <RangePicker />
        {canWrite('organic') && (
          <>
            <Link to="/import?type=organic" className="btn">
              Paste from sheet
            </Link>
            <button className="primary" onClick={() => setEditing({ date: todayKey() })}>
              + Add entry
            </button>
          </>
        )}
      </PageHead>

      <div className="kpis">
        <Kpi label="Posts published" value={num(t.posts)} delta={change(t.posts, p?.posts)} />
        <Kpi label="Views" value={compact(t.views)} delta={change(t.views, p?.views)} />
        <Kpi label="Reach" value={compact(t.reach)} delta={change(t.reach, p?.reach)} />
        <Kpi label="Engagements" value={compact(t.engagements)} delta={change(t.engagements, p?.engagements)} foot="likes + comments + shares + saves" />
        <Kpi label="Engagement rate" value={pct(t.engagementRate)} delta={change(t.engagementRate, p?.engagementRate)} foot="engagements ÷ views" />
        <Kpi label="Clicks" value={num(t.clicks)} delta={change(t.clicks, p?.clicks)} />
        <Kpi label="Followers gained" value={num(t.followersGained)} delta={change(t.followersGained, p?.followersGained)} />
      </div>

      <div className="grid g2">
        <Card title="Views & reach" sub="Daily">
          <TrendChart data={trend} x="date" series={[{ key: 'views', label: 'Views' }, { key: 'reach', label: 'Reach' }]} />
        </Card>
        <Card title="Engagements & clicks" sub="Daily">
          <TrendChart data={engTrend} x="date" series={[{ key: 'engagements', label: 'Engagements' }, { key: 'clicks', label: 'Clicks' }]} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Views by platform">
          <RankBars data={groupSum(rows, (r) => r.platform, (r) => r.views)} />
        </Card>
        <Card title="Views by brand">
          <RankBars data={groupSum(rows, (r) => r.brand, (r) => r.views)} />
        </Card>
      </div>

      <Card
        title="Breakdown"
        actions={
          <Segmented
            value={dim}
            onChange={setDim}
            options={[
              { value: 'platform', label: 'Platform' },
              { value: 'brand', label: 'Brand' },
            ]}
          />
        }
      >
        <DataTable
          rows={breakdown}
          rowKey={(r) => r.name}
          initialSort={{ key: 'views', dir: 'desc' }}
          columns={[
            { key: 'name', label: dim === 'brand' ? 'Brand' : 'Platform', sort: (r) => r.name, render: (r) => <b>{r.name}</b> },
            { key: 'posts', label: 'Posts', align: 'r', sort: (r) => r.posts, render: (r) => num(r.posts) },
            { key: 'views', label: 'Views', align: 'r', sort: (r) => r.views, render: (r) => num(r.views) },
            { key: 'reach', label: 'Reach', align: 'r', sort: (r) => r.reach, render: (r) => num(r.reach) },
            { key: 'likes', label: 'Likes', align: 'r', sort: (r) => r.likes, render: (r) => num(r.likes) },
            { key: 'comments', label: 'Comments', align: 'r', sort: (r) => r.comments, render: (r) => num(r.comments) },
            { key: 'shares', label: 'Shares', align: 'r', sort: (r) => r.shares, render: (r) => num(r.shares) },
            { key: 'saves', label: 'Saves', align: 'r', sort: (r) => r.saves, render: (r) => num(r.saves) },
            { key: 'er', label: 'Eng. rate', align: 'r', sort: (r) => r.engagementRate || 0, render: (r) => pct(r.engagementRate) },
            { key: 'clicks', label: 'Clicks', align: 'r', sort: (r) => r.clicks, render: (r) => num(r.clicks) },
            { key: 'fol', label: 'Followers +', align: 'r', sort: (r) => r.followersGained, render: (r) => num(r.followersGained) },
          ]}
        />
      </Card>

      <Card title="Entries" sub={canWrite('organic') ? 'Click a row to edit' : undefined}>
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          limit={25}
          onRowClick={canWrite('organic') ? setEditing : undefined}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'date', label: 'Date', sort: (r) => r.date, render: (r) => dateLabel(r.date) },
            { key: 'brand', label: 'Brand', sort: (r) => r.brand, render: (r) => r.brand },
            { key: 'platform', label: 'Platform', sort: (r) => r.platform, render: (r) => r.platform },
            { key: 'posts', label: 'Posts', align: 'r', sort: (r) => r.posts, render: (r) => r.posts },
            { key: 'views', label: 'Views', align: 'r', sort: (r) => r.views, render: (r) => num(r.views) },
            { key: 'clicks', label: 'Clicks', align: 'r', sort: (r) => r.clicks, render: (r) => num(r.clicks) },
          ]}
        />
      </Card>

      {editing && (
        <FormModal
          title={editing.id ? 'Edit organic entry' : 'Add organic entry'}
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? () => remove('organic', editing.id!) : undefined}
          onSubmit={async (v) => {
            if (editing.id) await update('organic', editing.id, v as Partial<OrganicEntry>);
            else await add('organic', [v as unknown as OrganicEntry]);
            notify('Saved');
          }}
        />
      )}
    </div>
  );
}
