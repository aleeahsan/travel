import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { TrendChart } from '../components/charts';
import { FormModal, unique, type FieldSpec } from '../components/FormModal';
import { Card, DataTable, Empty, Kpi, Modal, Pill, ProgressBar, Score, TrackPill } from '../components/ui';
import { addDays, daysBetween, todayKey } from '../lib/dates';
import { useRetainerRows } from '../lib/derived';
import { dateLabel, money, money2, num, pct, ratio, titleCase } from '../lib/format';
import { dailySeries, paidTotals } from '../lib/metrics';
import { useData } from '../lib/store';
import type { DataSet, Deliverable, Retainer, RetainerIssue, RetainerKpi, Severity } from '../lib/types';

export const retainerFields = (data: DataSet): FieldSpec[] => [
  { key: 'client', label: 'Client', type: 'text', required: true },
  { key: 'brand', label: 'Our brand', type: 'text', required: true, suggestions: unique(data.retainers.map((r) => r.brand)) },
  { key: 'owner', label: 'Owner / account lead', type: 'text', required: true, suggestions: unique(data.retainers.map((r) => r.owner)) },
  {
    key: 'status',
    label: 'Project status',
    type: 'select',
    required: true,
    options: ['onboarding', 'active', 'paused', 'ended'].map((v) => ({ value: v, label: titleCase(v) })),
  },
  { key: 'monthlyFee', label: 'Monthly fee', type: 'number', min: 0 },
  { key: 'startDate', label: 'Start date', type: 'date', required: true },
  { key: 'renewalDate', label: 'Renewal date', type: 'date', required: true },
  { key: 'reportingCadence', label: 'Reporting cadence', type: 'text', placeholder: 'e.g. Weekly update + monthly report' },
  { key: 'services', label: 'Services', type: 'list', wide: true, placeholder: 'Paid social, SEO, Content…' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const deliverableFields = (data: DataSet): FieldSpec[] => [
  { key: 'title', label: 'Deliverable', type: 'text', required: true, wide: true },
  { key: 'type', label: 'Type', type: 'text', suggestions: unique(data.deliverables.map((d) => d.type)) },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: ['not-started', 'in-progress', 'in-review', 'delivered', 'blocked'].map((v) => ({ value: v, label: titleCase(v) })),
  },
  { key: 'dueDate', label: 'Due date', type: 'date', required: true },
  { key: 'deliveredDate', label: 'Delivered date', type: 'date', hint: 'Used to measure deadlines met' },
  { key: 'progress', label: 'Progress %', type: 'number', min: 0, max: 100 },
  { key: 'qualityScore', label: 'Quality score (1–5)', type: 'number', min: 1, max: 5, step: 1, nullable: true, hint: 'Leave blank until reviewed' },
  { key: 'plannedQty', label: 'Planned quantity', type: 'number', min: 0, hint: 'e.g. 6 videos' },
  { key: 'deliveredQty', label: 'Delivered quantity', type: 'number', min: 0 },
];

const issueFields: FieldSpec[] = [
  { key: 'title', label: 'Issue', type: 'text', required: true, wide: true },
  { key: 'severity', label: 'Severity', type: 'select', required: true, options: ['low', 'medium', 'high', 'critical'].map((v) => ({ value: v, label: titleCase(v) })) },
  { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }] },
  { key: 'owner', label: 'Owner', type: 'text' },
  { key: 'raisedAt', label: 'Raised on', type: 'date', required: true },
  { key: 'details', label: 'Details / next step', type: 'textarea' },
];

const SEV_TONE: Record<Severity, 'bad' | 'warn' | 'info' | undefined> = { critical: 'bad', high: 'bad', medium: 'warn', low: undefined };
const STATUS_TONE: Record<Deliverable['status'], 'good' | 'warn' | 'bad' | 'info' | undefined> = {
  delivered: 'good',
  'in-review': 'info',
  'in-progress': 'info',
  'not-started': undefined,
  blocked: 'bad',
};

export default function RetainerDetail() {
  const { id } = useParams();
  const { data, canWrite, add, update, remove, notify } = useData();
  const row = useRetainerRows().find((r) => r.retainer.id === id);
  const [editRet, setEditRet] = useState(false);
  const [editDl, setEditDl] = useState<Partial<Deliverable> | null>(null);
  const [editIss, setEditIss] = useState<Partial<RetainerIssue> | null>(null);
  const [editKpis, setEditKpis] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const can = canWrite('retainers');

  if (!row) return <div className="page"><Empty>Retainer not found. <Link to="/retainers">Back to retainers</Link></Empty></div>;
  const { retainer: r, stats, health } = row;
  const today = todayKey();
  const deliverables = data.deliverables.filter((d) => d.retainerId === r.id);
  const issues = data.issues.filter((i) => i.retainerId === r.id && (showResolved || i.status === 'open'));
  const renewalIn = daysBetween(today, r.renewalDate);

  // Paid media we run for this client (matched on customer brand), last 30 days.
  const last30 = { from: addDays(today, -29), to: today };
  const clientPaid = data.paid.filter((p) => p.clientBrand === r.client && p.date >= last30.from);
  const pt = paidTotals(clientPaid);

  return (
    <div className="page">
      <div className="faint">
        <Link to="/retainers">← Retainers</Link>
      </div>
      <div className="page-head">
        <div>
          <div className="row">
            <h1>{r.client}</h1>
            <Score score={health.score} />
            <TrackPill track={health.track} />
            <Pill tone={r.status === 'active' ? 'info' : undefined}>{titleCase(r.status)}</Pill>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            {r.brand} · Owner {r.owner} · {money(r.monthlyFee)}/month
          </p>
        </div>
        <div className="spacer" />
        {can && <button onClick={() => setEditRet(true)}>Edit retainer</button>}
      </div>

      <div className="kpis">
        <Kpi label="Overall progress" value={pct(stats.avgProgress / 100, 0)} foot={`${stats.delivered}/${stats.total} deliverables delivered`} />
        <Kpi label="Deadlines met" value={pct(stats.onTimeRate, 0)} foot={`${stats.onTime} on time · ${stats.late} late · ${stats.overdueOpen.length} past due`} />
        <Kpi label="Quality" value={stats.avgQuality == null ? '—' : `${stats.avgQuality.toFixed(1)}/5`} foot="average review score" />
        <Kpi label="Quantity" value={`${stats.deliveredQty}/${stats.plannedQty}`} foot="units delivered / planned" />
        <Kpi label="Open issues" value={stats.openIssues.length} />
        <Kpi label="Renewal" value={renewalIn >= 0 ? `${renewalIn} days` : 'Passed'} foot={dateLabel(r.renewalDate)} />
      </div>

      {(stats.overdueOpen.length > 0 || stats.dueSoon.length > 0) && (
        <div className="grid" style={{ gap: 8 }}>
          {stats.overdueOpen.map((d) => (
            <div key={d.id} className="alert bad">
              ✕ <b>{d.title}</b> was due {dateLabel(d.dueDate)} ({daysBetween(d.dueDate, today)} days ago) — {titleCase(d.status)}, {d.progress}% done
            </div>
          ))}
          {stats.dueSoon.map((d) => (
            <div key={d.id} className="alert warn">
              ! <b>{d.title}</b> due {dateLabel(d.dueDate)} — {d.progress}% done
            </div>
          ))}
        </div>
      )}

      <div className="grid g-2-1">
        <Card
          title="Deliverables"
          sub="What we're working on, progress, and whether deadlines are met"
          actions={can && <button className="small primary" onClick={() => setEditDl({ status: 'not-started', progress: 0, plannedQty: 1, deliveredQty: 0, dueDate: today })}>+ Add</button>}
        >
          <DataTable
            rows={deliverables}
            rowKey={(d) => d.id}
            onRowClick={can ? setEditDl : undefined}
            initialSort={{ key: 'due', dir: 'asc' }}
            empty="No deliverables yet."
            columns={[
              { key: 'title', label: 'Deliverable', sort: (d) => d.title, render: (d) => <div><b>{d.title}</b><div className="faint">{d.type}</div></div> },
              { key: 'status', label: 'Status', sort: (d) => d.status, render: (d) => <Pill tone={STATUS_TONE[d.status]}>{titleCase(d.status)}</Pill> },
              { key: 'progress', label: 'Progress', sort: (d) => d.progress, render: (d) => <div style={{ minWidth: 80 }}><ProgressBar value={d.progress} /><span className="faint">{d.progress}%</span></div> },
              {
                key: 'due',
                label: 'Due',
                sort: (d) => d.dueDate,
                render: (d) => {
                  const late = d.status === 'delivered' ? d.deliveredDate && d.deliveredDate > d.dueDate : d.dueDate < today;
                  return (
                    <div>
                      {dateLabel(d.dueDate)}
                      {d.status === 'delivered' ? (
                        <div className="faint">{late ? `✕ delivered ${daysBetween(d.dueDate, d.deliveredDate!)}d late` : '✓ on time'}</div>
                      ) : late ? (
                        <div style={{ color: 'var(--bad-ink)', fontSize: 12 }}>✕ {daysBetween(d.dueDate, today)}d overdue</div>
                      ) : null}
                    </div>
                  );
                },
              },
              { key: 'qty', label: 'Qty', align: 'r', render: (d) => `${d.deliveredQty}/${d.plannedQty}` },
              { key: 'q', label: 'Quality', align: 'r', sort: (d) => d.qualityScore ?? 0, render: (d) => (d.qualityScore == null ? '—' : `${d.qualityScore}/5`) },
            ]}
          />
        </Card>

        <Card title="Why this health score">
          <div className="row" style={{ marginBottom: 12 }}>
            <Score score={health.score} />
            <span className="muted">Starts at 100; points come off for each item below.</span>
          </div>
          {health.reasons.length ? (
            <ul className="reasons">
              {health.reasons.map((x) => (
                <li key={x.label}>
                  <span>{x.label}</span>
                  <span className="pts" style={{ color: x.points < 0 ? 'var(--bad-ink)' : 'var(--good-ink)' }}>
                    {x.points > 0 ? '+' : ''}
                    {x.points}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing is pulling this retainer down.</p>
          )}
        </Card>
      </div>

      <Card
        title="Issues to address"
        actions={
          <div className="row">
            <label className="row faint" style={{ gap: 4 }}>
              <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} style={{ width: 'auto' }} /> Show resolved
            </label>
            {can && <button className="small primary" onClick={() => setEditIss({ severity: 'medium', status: 'open', raisedAt: today, owner: r.owner })}>+ Log issue</button>}
          </div>
        }
      >
        <DataTable
          rows={issues}
          rowKey={(i) => i.id}
          onRowClick={can ? setEditIss : undefined}
          empty="No open issues."
          initialSort={{ key: 'sev', dir: 'desc' }}
          columns={[
            { key: 'sev', label: 'Severity', sort: (i) => ['low', 'medium', 'high', 'critical'].indexOf(i.severity), render: (i) => <Pill tone={SEV_TONE[i.severity]}>{titleCase(i.severity)}</Pill> },
            { key: 'title', label: 'Issue', render: (i) => <div><b>{i.title}</b><div className="faint">{i.details}</div></div> },
            { key: 'owner', label: 'Owner', render: (i) => i.owner },
            { key: 'raised', label: 'Raised', sort: (i) => i.raisedAt, render: (i) => `${dateLabel(i.raisedAt)} (${daysBetween(i.raisedAt, today)}d)` },
            {
              key: 'status',
              label: 'Status',
              render: (i) =>
                i.status === 'resolved' ? (
                  <Pill tone="good">✓ Resolved</Pill>
                ) : can ? (
                  <button
                    className="small"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await update('issues', i.id, { status: 'resolved', resolvedAt: today });
                      notify('Issue resolved');
                    }}
                  >
                    Mark resolved
                  </button>
                ) : (
                  <Pill tone="warn">Open</Pill>
                ),
            },
          ]}
        />
      </Card>

      <div className="grid g2">
        <Card title="Reporting details">
          <table>
            <tbody>
              <tr><td className="muted">Services</td><td>{r.services.join(', ') || '—'}</td></tr>
              <tr><td className="muted">Reporting cadence</td><td>{r.reportingCadence || '—'}</td></tr>
              <tr><td className="muted">Owner</td><td>{r.owner}</td></tr>
              <tr><td className="muted">Started</td><td>{dateLabel(r.startDate)}</td></tr>
              <tr><td className="muted">Renewal</td><td>{dateLabel(r.renewalDate)}</td></tr>
              <tr><td className="muted">Monthly fee</td><td>{money(r.monthlyFee)}</td></tr>
              <tr><td className="muted">Notes</td><td style={{ whiteSpace: 'pre-wrap' }}>{r.notes || '—'}</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="Client KPIs" sub="Targets agreed with the client" actions={can && <button className="small" onClick={() => setEditKpis(true)}>Edit KPIs</button>}>
          {r.kpis.length ? (
            <table>
              <thead>
                <tr><th>KPI</th><th className="r">Target</th><th className="r">Actual</th><th className="r">vs target</th></tr>
              </thead>
              <tbody>
                {r.kpis.map((k) => {
                  // For cost-type KPIs (lower is better) the name usually says "cost" / "CPL" / "CPA".
                  const lowerBetter = /cost|cpl|cpa|cpc/i.test(k.name);
                  const ratioVal = k.target ? k.actual / k.target : NaN;
                  const good = lowerBetter ? ratioVal <= 1 : ratioVal >= 1;
                  return (
                    <tr key={k.name}>
                      <td>{k.name}</td>
                      <td className="r">{num(k.target)}</td>
                      <td className="r">{num(k.actual)}</td>
                      <td className="r">
                        <Pill tone={Number.isFinite(ratioVal) ? (good ? 'good' : ratioVal > 0.85 && !lowerBetter ? 'warn' : 'bad') : undefined}>
                          {Number.isFinite(ratioVal) ? `${good ? '✓' : '!'} ${pct(ratioVal, 0)}` : '—'}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <Empty>No KPIs set.</Empty>
          )}
        </Card>
      </div>

      <Card title="Paid media for this client" sub={`Last 30 days · matched on customer brand "${r.client}"`}>
        {clientPaid.length ? (
          <>
            <div className="kpis" style={{ marginBottom: 12 }}>
              <Kpi label="Spend" value={money(pt.spend)} />
              <Kpi label="Clicks" value={num(pt.clicks)} />
              <Kpi label="Leads" value={num(pt.leads)} />
              <Kpi label="Cost per lead" value={money2(pt.cpl)} />
              <Kpi label="ROAS" value={ratio(pt.roas)} />
            </div>
            <TrendChart data={dailySeries(clientPaid, last30, { spend: (p) => p.spend })} x="date" fmt={money} series={[{ key: 'spend', label: 'Spend' }]} height={180} />
          </>
        ) : (
          <Empty>No paid-marketing entries for this client in the last 30 days.</Empty>
        )}
      </Card>

      {editRet && (
        <FormModal
          title="Edit retainer"
          fields={retainerFields(data)}
          initial={r}
          onClose={() => setEditRet(false)}
          onSubmit={async (v) => {
            await update('retainers', r.id, v as Partial<Retainer>);
            notify('Saved');
          }}
        />
      )}
      {editDl && (
        <FormModal
          title={editDl.id ? 'Edit deliverable' : 'Add deliverable'}
          fields={deliverableFields(data)}
          initial={editDl}
          onClose={() => setEditDl(null)}
          onDelete={editDl.id ? () => remove('deliverables', editDl.id!) : undefined}
          onSubmit={async (v) => {
            const row = { ...v, retainerId: r.id } as Deliverable;
            if (row.status === 'delivered') {
              row.progress = 100;
              row.deliveredDate ||= today;
            }
            if (editDl.id) await update('deliverables', editDl.id, row);
            else await add('deliverables', [row]);
            notify('Saved');
          }}
        />
      )}
      {editIss && (
        <FormModal
          title={editIss.id ? 'Edit issue' : 'Log issue'}
          fields={issueFields}
          initial={editIss}
          onClose={() => setEditIss(null)}
          onDelete={editIss.id ? () => remove('issues', editIss.id!) : undefined}
          onSubmit={async (v) => {
            const row = { details: '', owner: '', ...v, retainerId: r.id } as RetainerIssue;
            row.resolvedAt = row.status === 'resolved' ? editIss.resolvedAt || today : null;
            if (editIss.id) await update('issues', editIss.id, row);
            else await add('issues', [row]);
            notify('Saved');
          }}
        />
      )}
      {editKpis && <KpiEditor kpis={r.kpis} onClose={() => setEditKpis(false)} onSave={async (kpis) => { await update('retainers', r.id, { kpis }); notify('KPIs saved'); }} />}
    </div>
  );
}

function KpiEditor({ kpis, onSave, onClose }: { kpis: RetainerKpi[]; onSave: (k: RetainerKpi[]) => Promise<void>; onClose: () => void }) {
  const [rows, setRows] = useState<RetainerKpi[]>(kpis.length ? kpis : [{ name: '', target: 0, actual: 0 }]);
  const set = (i: number, patch: Partial<RetainerKpi>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <FormModalShell title="Client KPIs" onClose={onClose} onSave={async () => { await onSave(rows.filter((r) => r.name.trim())); onClose(); }}>
      {rows.map((k, i) => (
        <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
          <input placeholder="KPI name" value={k.name} onChange={(e) => set(i, { name: e.target.value })} style={{ flex: 2 }} />
          <input type="number" placeholder="Target" value={k.target} onChange={(e) => set(i, { target: Number(e.target.value) })} style={{ flex: 1 }} aria-label="Target" />
          <input type="number" placeholder="Actual" value={k.actual} onChange={(e) => set(i, { actual: Number(e.target.value) })} style={{ flex: 1 }} aria-label="Actual" />
          <button className="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
        </div>
      ))}
      <div><button className="small" onClick={() => setRows((rs) => [...rs, { name: '', target: 0, actual: 0 }])}>+ Add KPI</button></div>
      <p className="faint">KPIs with "cost", "CPL", "CPA" or "CPC" in the name are treated as lower-is-better.</p>
    </FormModalShell>
  );
}

function FormModalShell({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => Promise<void>; children: ReactNode }) {
  return (
    <Modal title={title} onClose={onClose} footer={<><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => void onSave()}>Save</button></>}>
      {children}
    </Modal>
  );
}
