import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FormModal, unique, type FieldSpec } from '../components/FormModal';
import { Card, DataTable, Empty, Kpi, Pill, ProgressBar, Score, Segmented } from '../components/ui';
import { daysBetween, todayKey } from '../lib/dates';
import { useAccountRows } from '../lib/derived';
import { dateLabel, dateTimeLabel, money, titleCase } from '../lib/format';
import { FLAG_LABELS, RESPONSIVENESS_LABELS, RISK_WINDOW_DAYS, type Responsiveness } from '../lib/health';
import { useData } from '../lib/store';
import type { Account, DataSet, Interaction, InteractionChannel, Payment, RiskFlag } from '../lib/types';

export const accountFields = (data: DataSet): FieldSpec[] => [
  { key: 'name', label: 'Account / client name', type: 'text', required: true },
  { key: 'brand', label: 'Our brand', type: 'text', required: true, suggestions: unique(data.accounts.map((a) => a.brand)) },
  { key: 'packageName', label: 'Package / project', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', required: true, options: ['onboarding', 'active', 'paused', 'closed'].map((v) => ({ value: v, label: titleCase(v) })) },
  { key: 'salesRep', label: 'Sales rep', type: 'text', suggestions: unique(data.accounts.map((a) => a.salesRep)) },
  { key: 'accountManager', label: 'Account manager', type: 'text', suggestions: unique(data.accounts.map((a) => a.accountManager)) },
  { key: 'projectManager', label: 'Project manager', type: 'text', suggestions: unique(data.accounts.map((a) => a.projectManager)) },
  { key: 'contractValue', label: 'Contract value', type: 'number', min: 0, required: true },
  { key: 'startDate', label: 'Start date', type: 'date', required: true },
  {
    key: 'paymentCycle',
    label: 'Payment cycle',
    type: 'select',
    required: true,
    options: ['one-time', 'monthly', 'quarterly', 'milestone'].map((v) => ({ value: v, label: titleCase(v) })),
  },
  { key: 'performanceRating', label: 'Performance rating (1–5)', type: 'number', min: 1, max: 5, step: 1, required: true, hint: 'How the account/project is performing' },
  { key: 'performanceNotes', label: 'Performance notes', type: 'textarea' },
];

const paymentFields: FieldSpec[] = [
  { key: 'dueDate', label: 'Due date', type: 'date', required: true },
  { key: 'amount', label: 'Amount due', type: 'number', min: 0, required: true },
  { key: 'paidDate', label: 'Paid on', type: 'date', hint: 'Leave blank if not yet paid' },
  { key: 'paidAmount', label: 'Amount paid', type: 'number', min: 0 },
  { key: 'note', label: 'Note', type: 'text', wide: true },
];

export const RESP_TONE: Record<Responsiveness, 'good' | 'warn' | 'bad' | undefined> = {
  responsive: 'good',
  slow: 'warn',
  unresponsive: 'bad',
  'no-contact': undefined,
};

const CHANNEL_LABELS: Record<InteractionChannel, string> = { chat: 'Chat', call: 'Call', 'video-meeting': 'Video meeting', email: 'Email' };
const CHANNEL_ICON: Record<InteractionChannel, string> = { chat: '💬', call: '📞', 'video-meeting': '🎥', email: '✉️' };
const FLAGS = Object.keys(FLAG_LABELS) as RiskFlag[];

const interactionFields: FieldSpec[] = [
  { key: 'date', label: 'Date & time', type: 'datetime', required: true },
  { key: 'channel', label: 'Type', type: 'select', required: true, options: (Object.keys(CHANNEL_LABELS) as InteractionChannel[]).map((v) => ({ value: v, label: CHANNEL_LABELS[v] })) },
  {
    key: 'team',
    label: 'Call / chat from',
    type: 'select',
    required: true,
    options: ['sales', 'account-management', 'project-management', 'compliance'].map((v) => ({ value: v, label: titleCase(v) })),
  },
  {
    key: 'direction',
    label: 'Who initiated / replied',
    type: 'select',
    required: true,
    options: [
      { value: 'inbound', label: 'Client (inbound / client replied)' },
      { value: 'outbound', label: 'Us (outbound, no client reply yet)' },
    ],
    hint: 'Inbound interactions count towards client responsiveness',
  },
  { key: 'sentiment', label: 'Client sentiment', type: 'select', required: true, options: ['positive', 'neutral', 'negative'].map((v) => ({ value: v, label: titleCase(v) })) },
  { key: 'summary', label: 'Summary', type: 'textarea', required: true },
  { key: 'flags', label: 'Client statements to flag', type: 'multi', options: FLAGS.map((f) => ({ value: f, label: FLAG_LABELS[f] })) },
  { key: 'transcript', label: 'Chat log / call transcript', type: 'textarea', placeholder: 'Paste the chat export or transcript here' },
  { key: 'recordingUrl', label: 'Recording / meeting link', type: 'text', wide: true, placeholder: 'https://…' },
];

export default function AccountDetail() {
  const { id } = useParams();
  const { data, canWrite, add, update, remove, notify, session } = useData();
  const row = useAccountRows().find((r) => r.account.id === id);
  const [editAcc, setEditAcc] = useState(false);
  const [editPay, setEditPay] = useState<Partial<Payment> | null>(null);
  const [editInt, setEditInt] = useState<Partial<Interaction> | null>(null);
  const [channel, setChannel] = useState<'all' | InteractionChannel | 'flagged'>('all');
  const can = canWrite('accounts');

  const interactions = useMemo(
    () => data.interactions.filter((i) => i.accountId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [data.interactions, id],
  );

  if (!row) return <div className="page"><Empty>Account not found. <Link to="/accounts">Back to accounts</Link></Empty></div>;
  const { account: a, health, pay, resp, flags } = row;
  const today = todayKey();
  const payments = data.payments.filter((p) => p.accountId === a.id);
  const shownInteractions = interactions.filter((i) => (channel === 'all' ? true : channel === 'flagged' ? i.flags.length > 0 : i.channel === channel));
  const flagged = interactions.filter((i) => i.flags.length && daysBetween(i.date, today) <= RISK_WINDOW_DAYS);

  return (
    <div className="page">
      <div className="faint">
        <Link to="/accounts">← Accounts</Link>
      </div>
      <div className="page-head">
        <div>
          <div className="row">
            <h1>{a.name}</h1>
            <Score score={health.score} />
            <Pill tone={a.status === 'active' ? 'info' : undefined}>{titleCase(a.status)}</Pill>
          </div>
          <p className="muted" style={{ marginTop: 4 }}>
            {a.brand} · {a.packageName} · Sales {a.salesRep} · AM {a.accountManager} · PM {a.projectManager}
          </p>
        </div>
        <div className="spacer" />
        {can && <button onClick={() => setEditAcc(true)}>Edit account</button>}
        {can && (
          <button className="primary" onClick={() => setEditInt({ date: `${today}T${new Date().toTimeString().slice(0, 5)}`, channel: 'call', team: 'account-management', direction: 'inbound', sentiment: 'neutral', flags: [] })}>
            + Log chat / call / meeting
          </button>
        )}
      </div>

      {flagged.length > 0 && (
        <div className="grid" style={{ gap: 8 }}>
          {flagged.map((i) => (
            <div key={i.id} className="alert bad">
              ⚑ <div><b>{i.flags.map((f) => FLAG_LABELS[f]).join(', ')}</b> — {dateTimeLabel(i.date)} ({CHANNEL_LABELS[i.channel]}, {titleCase(i.team)}): {i.summary}</div>
            </div>
          ))}
        </div>
      )}

      <div className="kpis">
        <Kpi label="Contract value" value={money(pay.contractValue)} foot={titleCase(a.paymentCycle)} />
        <Kpi label="Paid so far" value={money(pay.totalPaid)} foot={<ProgressBar value={(pay.totalPaid / (pay.contractValue || 1)) * 100} tone="good" />} />
        <Kpi label="Remaining" value={money(pay.remaining)} />
        <Kpi label="Last payment" value={pay.lastPaymentDate ? dateLabel(pay.lastPaymentDate) : 'None'} foot={pay.lastPaymentDate ? `${daysBetween(pay.lastPaymentDate, today)} days ago` : undefined} />
        <Kpi label="Next due" value={pay.nextDue ? money(pay.nextDue.amount - pay.nextDue.paidAmount) : '—'} foot={pay.nextDue ? dateLabel(pay.nextDue.dueDate) : 'Nothing scheduled'} />
        <Kpi label="Overdue" value={pay.overdueAmount ? money(pay.overdueAmount) : 'None'} foot={pay.overdue.length ? `${pay.overdue.length} instalment(s)` : undefined} />
        <Kpi
          label="Client responsiveness"
          value={<Pill tone={RESP_TONE[resp.level]}>{RESPONSIVENESS_LABELS[resp.level]}</Pill>}
          foot={resp.lastInbound ? `Last reply ${dateTimeLabel(resp.lastInbound)}` : undefined}
        />
        <Kpi label="Performance" value={`${a.performanceRating}/5`} foot={a.performanceNotes || undefined} />
      </div>

      <div className="grid g-2-1">
        <Card
          title="Interaction log"
          sub="Chat logs, call logs, transcripts and video meetings from sales, account management and project management"
          actions={
            <Segmented
              value={channel}
              onChange={setChannel}
              options={[
                { value: 'all', label: 'All' },
                { value: 'chat', label: 'Chats' },
                { value: 'call', label: 'Calls' },
                { value: 'video-meeting', label: 'Meetings' },
                { value: 'email', label: 'Email' },
                { value: 'flagged', label: '⚑ Flagged' },
              ]}
            />
          }
        >
          {shownInteractions.length ? (
            <div className="timeline">
              {shownInteractions.map((i) => (
                <div className="item" key={i.id}>
                  <div className="faint">
                    {dateTimeLabel(i.date)}
                    <div>
                      {CHANNEL_ICON[i.channel]} {CHANNEL_LABELS[i.channel]}
                    </div>
                  </div>
                  <div>
                    <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                      <Pill>{titleCase(i.team)}</Pill>
                      <Pill tone={i.direction === 'inbound' ? 'info' : undefined}>{i.direction === 'inbound' ? '← Client' : '→ Us'}</Pill>
                      <Pill tone={i.sentiment === 'positive' ? 'good' : i.sentiment === 'negative' ? 'bad' : undefined}>
                        {i.sentiment === 'positive' ? '☺' : i.sentiment === 'negative' ? '☹' : '–'} {titleCase(i.sentiment)}
                      </Pill>
                      {i.flags.map((f) => (
                        <Pill key={f} tone="bad">
                          ⚑ {FLAG_LABELS[f]}
                        </Pill>
                      ))}
                      {can && (
                        <button className="small ghost" onClick={() => setEditInt(i)} style={{ marginLeft: 'auto' }}>
                          Edit
                        </button>
                      )}
                    </div>
                    <p>{i.summary}</p>
                    {i.recordingUrl && (
                      <a href={i.recordingUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                        Open recording ↗
                      </a>
                    )}
                    {i.transcript && (
                      <details className="transcript">
                        <summary>{i.channel === 'chat' ? 'Chat log' : 'Transcript'}</summary>
                        <pre>{i.transcript}</pre>
                      </details>
                    )}
                    <div className="faint" style={{ marginTop: 4 }}>
                      Logged by {i.loggedBy}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty>Nothing logged here yet.</Empty>
          )}
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card title="Why this health score">
            <div className="row" style={{ marginBottom: 12 }}>
              <Score score={health.score} />
              <span className="muted">Starts at 100; adjusted by each item below.</span>
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
              <p className="muted">No risk signals.</p>
            )}
            {flags.length > 0 && <p className="faint" style={{ marginTop: 8 }}>Risk statements count for {RISK_WINDOW_DAYS} days after they're logged.</p>}
          </Card>

          <Card title="Payment schedule" actions={can && <button className="small primary" onClick={() => setEditPay({ dueDate: today, paidAmount: 0 })}>+ Add</button>}>
            <DataTable
              rows={payments}
              rowKey={(p) => p.id}
              onRowClick={can ? setEditPay : undefined}
              initialSort={{ key: 'due', dir: 'asc' }}
              empty="No payments scheduled."
              columns={[
                { key: 'due', label: 'Due', sort: (p) => p.dueDate, render: (p) => dateLabel(p.dueDate) },
                { key: 'amount', label: 'Amount', align: 'r', render: (p) => money(p.amount) },
                {
                  key: 'state',
                  label: 'Status',
                  render: (p) =>
                    p.paidAmount >= p.amount ? (
                      <Pill tone="good">✓ Paid {dateLabel(p.paidDate)}</Pill>
                    ) : p.dueDate < today ? (
                      <Pill tone="bad">
                        ✕ {p.paidAmount ? `Part-paid, ${money(p.amount - p.paidAmount)} ` : ''}overdue {daysBetween(p.dueDate, today)}d
                      </Pill>
                    ) : (
                      <Pill>{p.paidAmount ? `Part-paid ${money(p.paidAmount)}` : 'Upcoming'}</Pill>
                    ),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      {editAcc && (
        <FormModal
          title="Edit account"
          fields={accountFields(data)}
          initial={a}
          onClose={() => setEditAcc(false)}
          onSubmit={async (v) => {
            await update('accounts', a.id, v as Partial<Account>);
            notify('Saved');
          }}
        />
      )}
      {editPay && (
        <FormModal
          title={editPay.id ? 'Edit payment' : 'Add payment'}
          fields={paymentFields}
          initial={editPay}
          onClose={() => setEditPay(null)}
          onDelete={editPay.id ? () => remove('payments', editPay.id!) : undefined}
          onSubmit={async (v) => {
            const row = { note: '', ...v, accountId: a.id } as Payment;
            if (row.paidDate && !row.paidAmount) row.paidAmount = row.amount;
            if (editPay.id) await update('payments', editPay.id, row);
            else await add('payments', [row]);
            notify('Saved');
          }}
        />
      )}
      {editInt && (
        <FormModal
          title={editInt.id ? 'Edit interaction' : 'Log chat / call / meeting'}
          fields={interactionFields}
          initial={editInt}
          onClose={() => setEditInt(null)}
          onDelete={editInt.id ? () => remove('interactions', editInt.id!) : undefined}
          onSubmit={async (v) => {
            const row = { transcript: '', recordingUrl: '', flags: [], ...v, accountId: a.id, loggedBy: editInt.loggedBy || session!.name } as unknown as Interaction;
            if (editInt.id) await update('interactions', editInt.id, row);
            else await add('interactions', [row]);
            notify('Saved');
          }}
        />
      )}
    </div>
  );
}
