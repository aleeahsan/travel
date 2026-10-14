import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendChart } from '../components/charts';
import { Card, change, DataTable, HealthPill, Kpi, PageHead, RangePicker, Score, TrackPill } from '../components/ui';
import { completedWorkHours, TEAM_LABELS, WORK_HOURS } from '../lib/config';
import { previousRange, todayKey } from '../lib/dates';
import { useAccountRows, useRetainerRows } from '../lib/derived';
import { dateTimeLabel, money, num, pct, ratio } from '../lib/format';
import { FLAG_LABELS } from '../lib/health';
import { dailySeries, filterRange, organicTotals, paidTotals, salesTotals } from '../lib/metrics';
import { useData } from '../lib/store';

export default function Overview() {
  const { data, range } = useData();
  const nav = useNavigate();
  const prev = previousRange(range);
  const accounts = useAccountRows();
  const retainers = useRetainerRows();

  const sales = salesTotals(filterRange(data.sales, range));
  const salesPrev = prev ? salesTotals(filterRange(data.sales, prev)) : null;
  const paid = paidTotals(filterRange(data.paid, range));
  const paidPrev = prev ? paidTotals(filterRange(data.paid, prev)) : null;
  const org = organicTotals(filterRange(data.organic, range));
  const orgPrev = prev ? organicTotals(filterRange(data.organic, prev)) : null;

  const trend = useMemo(() => {
    const s = dailySeries(filterRange(data.sales, range), range, { booked: (r) => r.revenueBooked, collected: (r) => r.revenueCollected });
    const p = dailySeries(filterRange(data.paid, range), range, { spend: (r) => r.spend });
    return s.map((row, i) => ({ ...row, spend: p[i]?.spend ?? 0 }));
  }, [data.sales, data.paid, range]);

  const atRiskAccounts = accounts.filter((a) => a.health.band !== 'healthy' && a.account.status !== 'closed').sort((a, b) => a.health.score - b.health.score);
  const offTrack = retainers.filter((r) => r.health.track !== 'on-track' && r.retainer.status !== 'ended').sort((a, b) => a.health.score - b.health.score);

  // Hourly reporting compliance for today.
  const today = todayKey();
  const expected = completedWorkHours();
  const expectedHours = expected.length;
  const hourly = (['compliance', 'marketing'] as const).map((team) => {
    const got = new Set(
      data.reports.filter((r) => r.team === team && r.cadence === 'hourly' && r.periodStart.startsWith(today)).map((r) => new Date(r.periodStart).getHours()),
    );
    return { team, got: expected.filter((h) => got.has(h)).length };
  });

  const latestReports = [...data.reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <div className="page">
      <PageHead title="Company overview" sub="Everything the teams report, in one place.">
        <RangePicker />
      </PageHead>

      <div className="kpis">
        <Kpi label="Revenue booked" value={money(sales.booked)} delta={change(sales.booked, salesPrev?.booked)} />
        <Kpi label="Revenue collected" value={money(sales.collected)} delta={change(sales.collected, salesPrev?.collected)} foot={`${pct(sales.collectionRate, 0)} of booked`} />
        <Kpi label="Deals closed" value={num(sales.deals)} delta={change(sales.deals, salesPrev?.deals)} />
        <Kpi label="Ad spend" value={money(paid.spend)} delta={change(paid.spend, paidPrev?.spend)} />
        <Kpi label="Paid ROAS" value={ratio(paid.roas)} delta={change(paid.roas, paidPrev?.roas)} />
        <Kpi label="Cost per lead" value={money(paid.cpl)} delta={change(paid.cpl, paidPrev?.cpl)} invert />
        <Kpi label="Organic views" value={num(org.views)} delta={change(org.views, orgPrev?.views)} />
        <Kpi label="Engagement rate" value={pct(org.engagementRate)} delta={change(org.engagementRate, orgPrev?.engagementRate)} />
      </div>

      <div className="grid g-2-1">
        <Card title="Revenue vs ad spend" sub="Daily, from sales and paid-marketing entries">
          <TrendChart
            data={trend}
            x="date"
            fmt={money}
            series={[
              { key: 'booked', label: 'Revenue booked' },
              { key: 'collected', label: 'Revenue collected' },
              { key: 'spend', label: 'Ad spend' },
            ]}
          />
        </Card>
        <Card title="Today's hourly reports" sub={`Working hours ${WORK_HOURS.start}:00–${WORK_HOURS.end}:00`} actions={<Link to="/reports">Open hub →</Link>}>
          <div className="grid" style={{ gap: 12 }}>
            {hourly.map((h) => {
              const missing = Math.max(0, expectedHours - h.got);
              return (
                <div key={h.team} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{TEAM_LABELS[h.team]}</span>
                  <span className={`pill ${missing === 0 ? 'good' : missing <= 1 ? 'warn' : 'bad'}`}>
                    {missing === 0 ? '✓' : '!'} {h.got}/{expectedHours} hours in
                  </span>
                </div>
              );
            })}
            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '4px 0' }} />
            <h3>Latest reports</h3>
            {latestReports.map((r) => (
              <div key={r.id} style={{ fontSize: 13 }}>
                <div>{r.title}</div>
                <div className="faint">
                  {TEAM_LABELS[r.team]} · {r.cadence} · {dateTimeLabel(r.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Accounts needing attention" sub={`${atRiskAccounts.length} of ${accounts.length} accounts`} actions={<Link to="/accounts">All accounts →</Link>}>
          <DataTable
            rows={atRiskAccounts}
            rowKey={(r) => r.account.id}
            onRowClick={(r) => nav(`/accounts/${r.account.id}`)}
            empty="All accounts are healthy."
            limit={6}
            columns={[
              { key: 'score', label: 'Score', render: (r) => <Score score={r.health.score} /> },
              { key: 'name', label: 'Account', render: (r) => <b>{r.account.name}</b> },
              {
                key: 'why',
                label: 'Top reason',
                render: (r) =>
                  r.flags.length ? FLAG_LABELS[r.flags[0]] : [...r.health.reasons].sort((a, b) => a.points - b.points)[0]?.label ?? '—',
              },
              { key: 'overdue', label: 'Overdue', align: 'r', render: (r) => (r.pay.overdueAmount ? money(r.pay.overdueAmount) : '—') },
            ]}
          />
        </Card>
        <Card title="Retainers off track" sub={`${offTrack.length} of ${retainers.length} retainers`} actions={<Link to="/retainers">All retainers →</Link>}>
          <DataTable
            rows={offTrack}
            rowKey={(r) => r.retainer.id}
            onRowClick={(r) => nav(`/retainers/${r.retainer.id}`)}
            empty="Every retainer is on track."
            columns={[
              { key: 'score', label: 'Score', render: (r) => <Score score={r.health.score} /> },
              { key: 'client', label: 'Client', render: (r) => <b>{r.retainer.client}</b> },
              { key: 'track', label: 'Status', render: (r) => <TrackPill track={r.health.track} /> },
              { key: 'late', label: 'Past due', align: 'r', render: (r) => r.stats.overdueOpen.length || '—' },
              { key: 'issues', label: 'Open issues', align: 'r', render: (r) => r.stats.openIssues.length || '—' },
            ]}
          />
        </Card>
      </div>

      <Card title="Account health at a glance">
        <div className="row">
          {(['healthy', 'watch', 'at-risk'] as const).map((b) => {
            const n = accounts.filter((a) => a.health.band === b).length;
            return (
              <span key={b} className="row" style={{ marginRight: 16 }}>
                <HealthPill score={b === 'healthy' ? 100 : b === 'watch' ? 60 : 0} /> <b className="num">{n}</b>
              </span>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
