import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormModal } from '../components/FormModal';
import { Card, DataTable, Kpi, PageHead, Pill, Score, Segmented } from '../components/ui';
import { todayKey } from '../lib/dates';
import { useAccountRows } from '../lib/derived';
import { dateLabel, money, titleCase } from '../lib/format';
import { FLAG_LABELS, RESPONSIVENESS_LABELS } from '../lib/health';
import { useData } from '../lib/store';
import type { Account } from '../lib/types';
import { accountFields, RESP_TONE } from './AccountDetail';

type Filter = 'all' | 'at-risk' | 'watch' | 'flags' | 'overdue';

export default function Accounts() {
  const rows = useAccountRows().filter((r) => r.account.status !== 'closed');
  const nav = useNavigate();
  const { canWrite, add, notify, data } = useData();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const shown = rows
    .filter((r) =>
      filter === 'all'
        ? true
        : filter === 'flags'
          ? r.flags.length > 0
          : filter === 'overdue'
            ? r.pay.overdue.length > 0
            : r.health.band === filter,
    )
    .filter((r) => !q || `${r.account.name} ${r.account.brand} ${r.account.accountManager} ${r.account.salesRep}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <PageHead title="Account health" sub="Compliance view of every client account: payments, responsiveness, and anything said on chats, calls and meetings.">
        <input placeholder="Search accounts…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} aria-label="Search" />
        {canWrite('accounts') && (
          <button className="primary" onClick={() => setCreating(true)}>
            + New account
          </button>
        )}
      </PageHead>

      <div className="kpis">
        <Kpi label="Active accounts" value={rows.length} />
        <Kpi label="At risk" value={rows.filter((r) => r.health.band === 'at-risk').length} foot={`${rows.filter((r) => r.health.band === 'watch').length} on watch`} />
        <Kpi label="Refund / chargeback statements" value={rows.filter((r) => r.flags.some((f) => f === 'refund-request' || f === 'chargeback-threat')).length} foot="accounts, last 30 days" />
        <Kpi label="Overdue payments" value={money(rows.reduce((s, r) => s + r.pay.overdueAmount, 0))} foot={`${rows.filter((r) => r.pay.overdue.length).length} accounts`} />
        <Kpi label="Remaining to collect" value={money(rows.reduce((s, r) => s + r.pay.remaining, 0))} />
        <Kpi label="Unresponsive clients" value={rows.filter((r) => r.resp.level === 'unresponsive').length} foot="no reply in 10+ days" />
      </div>

      <Card
        title="Accounts"
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'at-risk', label: 'At risk' },
              { value: 'watch', label: 'Watch' },
              { value: 'flags', label: 'Risk statements' },
              { value: 'overdue', label: 'Overdue' },
            ]}
          />
        }
      >
        <DataTable
          rows={shown}
          rowKey={(r) => r.account.id}
          onRowClick={(r) => nav(`/accounts/${r.account.id}`)}
          initialSort={{ key: 'score', dir: 'asc' }}
          columns={[
            { key: 'score', label: 'Health', sort: (r) => r.health.score, render: (r) => <Score score={r.health.score} /> },
            {
              key: 'name',
              label: 'Account',
              sort: (r) => r.account.name,
              render: (r) => (
                <div>
                  <b>{r.account.name}</b>
                  <div className="faint">
                    {r.account.brand} · {r.account.packageName}
                  </div>
                </div>
              ),
            },
            {
              key: 'team',
              label: 'Sales / AM / PM',
              render: (r) => (
                <span className="faint">
                  {r.account.salesRep} / {r.account.accountManager} / {r.account.projectManager}
                </span>
              ),
            },
            { key: 'perf', label: 'Performance', align: 'r', sort: (r) => r.account.performanceRating, render: (r) => `${r.account.performanceRating}/5` },
            { key: 'cycle', label: 'Payment cycle', sort: (r) => r.account.paymentCycle, render: (r) => titleCase(r.account.paymentCycle) },
            { key: 'last', label: 'Last payment', sort: (r) => r.pay.lastPaymentDate ?? '', render: (r) => dateLabel(r.pay.lastPaymentDate) },
            { key: 'remaining', label: 'Remaining', align: 'r', sort: (r) => r.pay.remaining, render: (r) => money(r.pay.remaining) },
            {
              key: 'overdue',
              label: 'Overdue',
              align: 'r',
              sort: (r) => r.pay.overdueAmount,
              render: (r) => (r.pay.overdueAmount ? <span style={{ color: 'var(--bad-ink)', fontWeight: 600 }}>{money(r.pay.overdueAmount)}</span> : '—'),
            },
            {
              key: 'resp',
              label: 'Responsiveness',
              sort: (r) => r.resp.daysSince ?? 999,
              render: (r) => (
                <Pill tone={RESP_TONE[r.resp.level]}>
                  {RESPONSIVENESS_LABELS[r.resp.level]}
                  {r.resp.daysSince != null && ` · ${r.resp.daysSince}d`}
                </Pill>
              ),
            },
            {
              key: 'flags',
              label: 'Risk statements (30d)',
              sort: (r) => r.flags.length,
              render: (r) =>
                r.flags.length ? (
                  <div className="row" style={{ gap: 4 }}>
                    {r.flags.map((f) => (
                      <Pill key={f} tone="bad">
                        ⚑ {FLAG_LABELS[f]}
                      </Pill>
                    ))}
                  </div>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>

      {creating && (
        <FormModal
          title="New account"
          fields={accountFields(data)}
          initial={{ status: 'onboarding', startDate: todayKey(), paymentCycle: 'monthly', performanceRating: 3 }}
          onClose={() => setCreating(false)}
          onSubmit={async (v) => {
            await add('accounts', [{ performanceNotes: '', ...v } as unknown as Account]);
            notify('Account created');
          }}
        />
      )}
    </div>
  );
}
