import { useMemo, useState } from 'react';
import { ColumnChart, TrendChart } from '../components/charts';
import { Card, DataTable, Empty, Modal, PageHead, Pill, RangePicker, Segmented } from '../components/ui';
import { ALL_WORK_HOURS, completedWorkHours, CURRENCY, REPORT_TEMPLATES, ROLE_TEAMS, TEAM_LABELS, type MetricField } from '../lib/config';
import { inRange, todayKey, toDateKey } from '../lib/dates';
import { dateLabel, dateTimeLabel, money, num } from '../lib/format';
import { useData } from '../lib/store';
import type { Cadence, Report, Team } from '../lib/types';

const TEAMS: Team[] = ['compliance', 'marketing', 'operations'];

const fieldsFor = (team: Team, cadence: Cadence) => REPORT_TEMPLATES[team][cadence];
const fmtMetric = (f: MetricField | undefined, v: number) => (f?.money ? money(v) : num(v));
const labelFor = (team: Team, cadence: Cadence, key: string) =>
  fieldsFor(team, cadence).find((f) => f.key === key)?.label ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export default function Reports() {
  const { data, range, session } = useData();
  const [cadence, setCadence] = useState<Cadence>('hourly');
  const [team, setTeam] = useState<Team>(ROLE_TEAMS[session!.role][0] ?? 'compliance');
  const [day, setDay] = useState(todayKey());
  const [open, setOpen] = useState<Report | null>(null);
  const [composing, setComposing] = useState(false);
  const fields = fieldsFor(team, cadence);
  const [metric, setMetric] = useState<string>(fields[0]?.key ?? '');
  const metricKey = fields.some((f) => f.key === metric) ? metric : fields[0]?.key;
  const metricField = fields.find((f) => f.key === metricKey);
  const canSubmit = ROLE_TEAMS[session!.role].length > 0;

  const teamReports = useMemo(
    () => data.reports.filter((r) => r.team === team && r.cadence === cadence).sort((a, b) => b.periodStart.localeCompare(a.periodStart)),
    [data.reports, team, cadence],
  );

  const visible = cadence === 'hourly' ? teamReports.filter((r) => r.periodStart.startsWith(day)) : teamReports.filter((r) => inRange(r.periodStart, range));

  const chartData = useMemo(() => {
    if (cadence === 'hourly') {
      return ALL_WORK_HOURS.map((h) => {
        const r = visible.find((x) => new Date(x.periodStart).getHours() === h);
        return { hour: `${h}:00`, value: r?.metrics[metricKey] ?? 0 };
      });
    }
    return [...visible]
      .reverse()
      .map((r) => ({ date: toDateKey(new Date(r.periodStart)), value: r.metrics[metricKey] ?? 0 }));
  }, [visible, cadence, metricKey]);

  const dayTotals = fields.map((f) => ({ f, total: visible.reduce((s, r) => s + (r.metrics[f.key] ?? 0), 0) }));

  return (
    <div className="page">
      <PageHead title="Reports hub" sub="Hourly and daily reports from every team. Missing hours are flagged automatically.">
        {canSubmit && (
          <button className="primary" onClick={() => setComposing(true)}>
            + Submit report
          </button>
        )}
      </PageHead>

      <div className="row">
        <Segmented
          value={cadence}
          onChange={setCadence}
          options={[
            { value: 'hourly', label: 'Hourly' },
            { value: 'daily', label: 'Daily' },
          ]}
        />
        <Segmented value={team} onChange={setTeam} options={TEAMS.map((t) => ({ value: t, label: TEAM_LABELS[t] }))} />
        <div style={{ flex: 1 }} />
        {cadence === 'hourly' ? (
          <input type="date" value={day} onChange={(e) => setDay(e.target.value || todayKey())} style={{ width: 'auto' }} aria-label="Day" />
        ) : (
          <RangePicker />
        )}
      </div>

      {cadence === 'hourly' && <HourCoverage day={day} />}

      <div className="kpis">
        {dayTotals.map(({ f, total }) => (
          <div className="kpi" key={f.key}>
            <div className="kpi-label">{f.label}</div>
            <div className="kpi-value">{fmtMetric(f, total)}</div>
            <div className="kpi-foot">{cadence === 'hourly' ? `Sum of ${visible.length} hourly reports` : `Sum of ${visible.length} daily reports`}</div>
          </div>
        ))}
      </div>

      <Card
        title={`${metricField?.label ?? 'Metric'} by ${cadence === 'hourly' ? 'hour' : 'day'}`}
        actions={
          <select value={metricKey} onChange={(e) => setMetric(e.target.value)} style={{ width: 'auto' }} aria-label="Metric">
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        }
      >
        {visible.length ? (
          cadence === 'hourly' ? (
            <ColumnChart data={chartData} x="hour" series={[{ key: 'value', label: metricField?.label ?? '' }]} fmt={(v) => fmtMetric(metricField, v)} />
          ) : (
            <TrendChart data={chartData} x="date" series={[{ key: 'value', label: metricField?.label ?? '' }]} fmt={(v) => fmtMetric(metricField, v)} />
          )
        ) : (
          <Empty>No {cadence} {TEAM_LABELS[team].toLowerCase()} reports for this {cadence === 'hourly' ? 'day' : 'period'}.</Empty>
        )}
      </Card>

      <Card title={`${TEAM_LABELS[team]} ${cadence} reports`} sub="Click a report to see everything in it">
        <DataTable
          rows={visible}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          initialSort={{ key: 'period', dir: 'desc' }}
          columns={[
            {
              key: 'period',
              label: cadence === 'hourly' ? 'Hour' : 'Day',
              sort: (r) => r.periodStart,
              render: (r) => (cadence === 'hourly' ? new Date(r.periodStart).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : dateLabel(r.periodStart)),
            },
            ...fields.slice(0, 5).map((f) => ({
              key: f.key,
              label: f.label,
              align: 'r' as const,
              sort: (r: Report) => r.metrics[f.key] ?? 0,
              render: (r: Report) => (r.metrics[f.key] == null ? '—' : fmtMetric(f, r.metrics[f.key])),
            })),
            {
              key: 'notes',
              label: 'Notes',
              render: (r) => (
                <>
                  {r.blockers && <Pill tone="bad">Blocker</Pill>} {r.highlights && <Pill tone="info">Highlight</Pill>}
                </>
              ),
            },
            { key: 'author', label: 'By', render: (r) => <span className="faint">{r.author}</span> },
          ]}
        />
      </Card>

      {open && <ReportDetail report={open} onClose={() => setOpen(null)} />}
      {composing && <ReportComposer defaultTeam={team} defaultCadence={cadence} onClose={() => setComposing(false)} />}
    </div>
  );
}

function HourCoverage({ day }: { day: string }) {
  const { data } = useData();
  const isToday = day === todayKey();
  const done = new Set(isToday ? completedWorkHours() : ALL_WORK_HOURS);
  const isFuture = day > todayKey();
  return (
    <Card title="Hourly reporting coverage" sub="Green = report received · Red = hour has passed with no report · Grey = not due yet">
      <div className="hour-grid" style={{ ['--cols' as string]: ALL_WORK_HOURS.length, overflowX: 'auto' }}>
        <div className="hrow">
          <span />
          {ALL_WORK_HOURS.map((h) => (
            <span key={h} className="faint" style={{ textAlign: 'center' }}>
              {h}
            </span>
          ))}
        </div>
        {(['compliance', 'marketing'] as Team[]).map((team) => {
          const got = new Set(
            data.reports.filter((r) => r.team === team && r.cadence === 'hourly' && r.periodStart.startsWith(day)).map((r) => new Date(r.periodStart).getHours()),
          );
          return (
            <div className="hrow" key={team}>
              <span>{TEAM_LABELS[team]}</span>
              {ALL_WORK_HOURS.map((h) => {
                const state = got.has(h) ? 'ok' : !isFuture && done.has(h) ? 'miss' : 'future';
                return (
                  <span key={h} className={`cell ${state}`} title={`${h}:00 – ${state === 'ok' ? 'received' : state === 'miss' ? 'missing' : 'not due yet'}`}>
                    {state === 'ok' ? '✓' : state === 'miss' ? '✕' : ''}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReportDetail({ report, onClose }: { report: Report; onClose: () => void }) {
  const { canWrite, remove, notify, session } = useData();
  const allowed = canWrite('reports') && ROLE_TEAMS[session!.role].includes(report.team);
  const fields = fieldsFor(report.team, report.cadence);
  return (
    <Modal
      title={report.title}
      onClose={onClose}
      footer={
        allowed ? (
          <button
            className="danger"
            onClick={async () => {
              if (!window.confirm('Delete this report?')) return;
              await remove('reports', report.id);
              notify('Report deleted');
              onClose();
            }}
          >
            Delete report
          </button>
        ) : undefined
      }
    >
      <div className="faint">
        {TEAM_LABELS[report.team]} · {report.cadence} · covers {report.cadence === 'hourly' ? dateTimeLabel(report.periodStart) : dateLabel(report.periodStart)} · submitted{' '}
        {dateTimeLabel(report.createdAt)} by {report.author}
      </div>
      <table>
        <tbody>
          {Object.entries(report.metrics).map(([k, v]) => {
            const f = fields.find((x) => x.key === k);
            return (
              <tr key={k}>
                <td>{labelFor(report.team, report.cadence, k)}</td>
                <td className="r">{fmtMetric(f, v)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {report.highlights && (
        <div>
          <h3>Highlights</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{report.highlights}</p>
        </div>
      )}
      {report.blockers && (
        <div className="alert bad">
          <b>Blockers:</b> {report.blockers}
        </div>
      )}
    </Modal>
  );
}

function ReportComposer({ defaultTeam, defaultCadence, onClose }: { defaultTeam: Team; defaultCadence: Cadence; onClose: () => void }) {
  const { add, session, notify } = useData();
  const teams = ROLE_TEAMS[session!.role];
  const [team, setTeam] = useState<Team>(teams.includes(defaultTeam) ? defaultTeam : teams[0]);
  const [cadence, setCadence] = useState<Cadence>(defaultCadence);
  const now = new Date();
  const lastHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.max(0, now.getHours() - 1));
  const [hour, setHour] = useState(`${toDateKey(lastHour)}T${String(lastHour.getHours()).padStart(2, '0')}`);
  const [day, setDay] = useState(todayKey());
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [highlights, setHighlights] = useState('');
  const [blockers, setBlockers] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = fieldsFor(team, cadence);

  const submit = async () => {
    const values: Record<string, number> = {};
    for (const f of fields) {
      const raw = metrics[f.key];
      if (raw === undefined || raw === '') continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) return setError(`${f.label} must be a number`);
      values[f.key] = n;
    }
    if (!Object.keys(values).length) return setError('Fill in at least one number.');
    const periodStart = cadence === 'hourly' ? `${hour.slice(0, 13)}:00:00` : `${day}T00:00:00`;
    setBusy(true);
    try {
      await add('reports', [
        {
          team,
          cadence,
          periodStart,
          author: session!.name,
          title:
            cadence === 'hourly'
              ? `${TEAM_LABELS[team]} hourly update ${Number(periodStart.slice(11, 13))}:00`
              : `${TEAM_LABELS[team]} daily report — ${day}`,
          metrics: values,
          highlights,
          blockers,
          createdAt: new Date().toISOString(),
        },
      ]);
      notify('Report submitted');
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Submit report"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <label className="field">
          Team
          <select value={team} onChange={(e) => setTeam(e.target.value as Team)}>
            {teams.map((t) => (
              <option key={t} value={t}>
                {TEAM_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Type
          <select value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        {cadence === 'hourly' ? (
          <label className="field">
            Hour starting
            <input type="datetime-local" step={3600} value={`${hour.slice(0, 13)}:00`} onChange={(e) => setHour(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            Day
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
        )}
      </div>
      <div className="form-grid">
        {fields.map((f) => (
          <label className="field" key={`${team}-${cadence}-${f.key}`}>
            {f.label}
            {f.money ? ` (${CURRENCY})` : ''}
            <input type="number" inputMode="decimal" value={metrics[f.key] ?? ''} onChange={(e) => setMetrics((m) => ({ ...m, [f.key]: e.target.value }))} />
          </label>
        ))}
      </div>
      <label className="field">
        Highlights / wins
        <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={2} />
      </label>
      <label className="field">
        Blockers / issues for the COO
        <textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} />
      </label>
      {error && <div className="alert bad">{error}</div>}
    </Modal>
  );
}
