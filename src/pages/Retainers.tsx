import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormModal } from '../components/FormModal';
import { Card, DataTable, Kpi, PageHead, Pill, ProgressBar, Score, Segmented, TrackPill } from '../components/ui';
import { daysBetween, todayKey } from '../lib/dates';
import { useRetainerRows } from '../lib/derived';
import { dateLabel, money, pct, titleCase } from '../lib/format';
import { useData } from '../lib/store';
import type { Retainer } from '../lib/types';
import { retainerFields } from './RetainerDetail';

type Filter = 'all' | 'off' | 'risk' | 'on';

export default function Retainers() {
  const rows = useRetainerRows();
  const nav = useNavigate();
  const { canWrite, add, notify, data } = useData();
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const live = rows.filter((r) => r.retainer.status !== 'ended');
  const shown = rows.filter((r) =>
    filter === 'all' ? true : filter === 'off' ? r.health.track === 'off-track' : filter === 'risk' ? r.health.track === 'at-risk' : r.health.track === 'on-track',
  );
  const overdue = live.reduce((s, r) => s + r.stats.overdueOpen.length, 0);
  const openIssues = live.reduce((s, r) => s + r.stats.openIssues.length, 0);
  const delivered = live.reduce((s, r) => s + r.stats.delivered, 0);
  const onTime = live.reduce((s, r) => s + r.stats.onTime, 0);

  return (
    <div className="page">
      <PageHead title="Marketing retainers" sub="Deliverables, deadlines, quality and issues for every retainer client. Click a retainer for full detail.">
        {canWrite('retainers') && (
          <button className="primary" onClick={() => setCreating(true)}>
            + New retainer
          </button>
        )}
      </PageHead>

      <div className="kpis">
        <Kpi label="Active retainers" value={live.length} />
        <Kpi label="Monthly retainer value" value={money(live.reduce((s, r) => s + r.retainer.monthlyFee, 0))} />
        <Kpi label="On track" value={live.filter((r) => r.health.track === 'on-track').length} foot={`of ${live.length}`} />
        <Kpi label="At risk / off track" value={live.filter((r) => r.health.track !== 'on-track').length} />
        <Kpi label="Deliverables past due" value={overdue} />
        <Kpi label="On-time delivery" value={pct(delivered + overdue ? onTime / (delivered + overdue) : 1, 0)} foot="delivered on time ÷ (delivered + past due)" />
        <Kpi label="Open issues" value={openIssues} />
      </div>

      <Card
        title="All retainers"
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'off', label: 'Off track' },
              { value: 'risk', label: 'At risk' },
              { value: 'on', label: 'On track' },
            ]}
          />
        }
      >
        <DataTable
          rows={shown}
          rowKey={(r) => r.retainer.id}
          onRowClick={(r) => nav(`/retainers/${r.retainer.id}`)}
          initialSort={{ key: 'score', dir: 'asc' }}
          columns={[
            { key: 'score', label: 'Health', sort: (r) => r.health.score, render: (r) => <Score score={r.health.score} /> },
            {
              key: 'client',
              label: 'Client',
              sort: (r) => r.retainer.client,
              render: (r) => (
                <div>
                  <b>{r.retainer.client}</b>
                  <div className="faint">
                    {r.retainer.brand} · {r.retainer.owner}
                  </div>
                </div>
              ),
            },
            { key: 'status', label: 'Project status', sort: (r) => r.retainer.status, render: (r) => <Pill tone={r.retainer.status === 'active' ? 'info' : undefined}>{titleCase(r.retainer.status)}</Pill> },
            { key: 'track', label: 'On track?', sort: (r) => r.health.track, render: (r) => <TrackPill track={r.health.track} /> },
            {
              key: 'progress',
              label: 'Progress',
              sort: (r) => r.stats.avgProgress,
              render: (r) => (
                <div style={{ minWidth: 110 }}>
                  <ProgressBar value={r.stats.avgProgress} />
                  <div className="faint">
                    {r.stats.delivered}/{r.stats.total} deliverables done
                  </div>
                </div>
              ),
            },
            { key: 'ontime', label: 'Deadlines met', align: 'r', sort: (r) => r.stats.onTimeRate, render: (r) => pct(r.stats.onTimeRate, 0) },
            { key: 'overdue', label: 'Past due', align: 'r', sort: (r) => r.stats.overdueOpen.length, render: (r) => r.stats.overdueOpen.length || '—' },
            { key: 'quality', label: 'Quality', align: 'r', sort: (r) => r.stats.avgQuality ?? 0, render: (r) => (r.stats.avgQuality == null ? '—' : `${r.stats.avgQuality.toFixed(1)}/5`) },
            { key: 'qty', label: 'Quantity', align: 'r', sort: (r) => r.stats.deliveredQty, render: (r) => `${r.stats.deliveredQty}/${r.stats.plannedQty}` },
            { key: 'issues', label: 'Open issues', align: 'r', sort: (r) => r.stats.openIssues.length, render: (r) => r.stats.openIssues.length || '—' },
            {
              key: 'renewal',
              label: 'Renewal',
              sort: (r) => r.retainer.renewalDate,
              render: (r) => {
                const d = daysBetween(todayKey(), r.retainer.renewalDate);
                return (
                  <span>
                    {dateLabel(r.retainer.renewalDate)}
                    {d >= 0 && d <= 30 && <div className="faint">in {d} days</div>}
                  </span>
                );
              },
            },
          ]}
        />
      </Card>

      {creating && (
        <FormModal
          title="New retainer"
          fields={retainerFields(data)}
          initial={{ status: 'onboarding', startDate: todayKey(), services: [], kpis: [] }}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await add('retainers', [{ kpis: [], notes: '', ...v } as unknown as Retainer]);
            notify('Retainer created');
          }}
        />
      )}
    </div>
  );
}
