import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, PageHead, Pill } from '../components/ui';
import { convertRows, IMPORT_SPECS, matchColumns, parseTable } from '../lib/importer';
import { useData } from '../lib/store';
import type { CollectionName } from '../lib/types';

const ROUTE_AFTER: Partial<Record<CollectionName, string>> = {
  sales: '/sales',
  paid: '/marketing/paid',
  organic: '/marketing/organic',
  payments: '/accounts',
  deliverables: '/retainers',
};

export default function Import() {
  const { data, canWrite, add, notify } = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const types = (Object.keys(IMPORT_SPECS) as CollectionName[]).filter((c) => canWrite(c));
  const type = (types.includes(params.get('type') as CollectionName) ? params.get('type') : types[0]) as CollectionName | undefined;
  const spec = type ? IMPORT_SPECS[type] : undefined;
  const [text, setText] = useState('');
  const [dayFirst, setDayFirst] = useState(true);
  const [mapping, setMapping] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);

  const table = useMemo(() => parseTable(text), [text]);
  const headers = table[0] ?? [];
  const body = table.slice(1);
  const autoMap = useMemo(() => (spec ? matchColumns(headers, spec.fields) : {}), [spec, headers]);
  const columns = mapping ?? autoMap;

  // Resolve names to record ids where the import references another record.
  const lookup = useMemo(() => {
    const accounts = new Map(data.accounts.map((a) => [a.name.trim().toLowerCase(), a.id]));
    const retainers = new Map(data.retainers.map((r) => [r.client.trim().toLowerCase(), r.id]));
    return { accounts, retainers };
  }, [data.accounts, data.retainers]);

  const parsed = useMemo(() => {
    if (!spec || !type) return [];
    return convertRows(body, spec.fields, columns, dayFirst).map((r) => {
      const v = { ...r.values };
      const errors = [...r.errors];
      if (type === 'payments' && v.accountId) {
        const id = lookup.accounts.get(String(v.accountId).toLowerCase());
        if (!id) errors.push(`No account named "${v.accountId}"`);
        v.accountId = id ?? null;
      }
      if (type === 'deliverables' && v.retainerId) {
        const id = lookup.retainers.get(String(v.retainerId).toLowerCase());
        if (!id) errors.push(`No retainer for client "${v.retainerId}"`);
        v.retainerId = id ?? null;
      }
      return { values: v, errors };
    });
  }, [spec, type, body, columns, dayFirst, lookup]);

  const valid = parsed.filter((r) => !r.errors.length);

  if (!types.length || !spec || !type)
    return (
      <div className="page">
        <PageHead title="Import from spreadsheet" />
        <Card>Your role can't add data. Ask the COO for edit access.</Card>
      </div>
    );

  const doImport = async () => {
    setBusy(true);
    try {
      const rows = valid.map(({ values }) => {
        const out: Record<string, unknown> = {};
        for (const f of spec.fields) {
          const v = values[f.key];
          out[f.key] = f.type === 'number' ? (v ?? (f.key === 'qualityScore' ? null : 0)) : (v ?? (f.type === 'date' ? null : ''));
        }
        if (type === 'paid' && !out.clientBrand) out.clientBrand = out.brand;
        if (type === 'payments' && out.paidDate && !out.paidAmount) out.paidAmount = out.amount;
        if (type === 'deliverables') {
          out.status ||= out.deliveredDate ? 'delivered' : 'not-started';
          out.status = String(out.status).toLowerCase().replace(/\s+/g, '-');
          if (out.status === 'delivered') out.progress = 100;
          if (!out.plannedQty) out.plannedQty = 1;
        }
        return out;
      });
      await add(type, rows as never);
      notify(`Imported ${rows.length} rows`);
      nav(ROUTE_AFTER[type] ?? '/');
    } catch (e) {
      notify(`Import failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHead title="Import from spreadsheet" sub="Copy rows from Google Sheets or Excel (including the header row) and paste them below. Nothing is saved until you click Import." />

      <Card>
        <div className="form-grid">
          <label className="field">
            What are you importing?
            <select
              value={type}
              onChange={(e) => {
                setParams({ type: e.target.value });
                setMapping(null);
              }}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {IMPORT_SPECS[t]!.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Dates like 03/04/2026 mean
            <select value={dayFirst ? 'dmy' : 'mdy'} onChange={(e) => setDayFirst(e.target.value === 'dmy')}>
              <option value="dmy">3 April (day first)</option>
              <option value="mdy">March 4 (month first)</option>
            </select>
          </label>
        </div>
        <p className="faint" style={{ margin: '12px 0 6px' }}>
          Expected columns: {spec.fields.map((f) => `${f.label}${f.required ? '*' : ''}`).join(' · ')}
        </p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMapping(null);
          }}
          rows={8}
          placeholder={spec.fields.map((f) => f.label).join('\t')}
          style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}
          aria-label="Pasted data"
        />
      </Card>

      {headers.length > 0 && (
        <Card title="Match columns" sub="We matched what we could from your header row. Fix anything that's wrong.">
          <div className="form-grid">
            {spec.fields.map((f) => (
              <label className="field" key={f.key}>
                {f.label}
                {f.required && ' *'}
                <select value={columns[f.key] ?? -1} onChange={(e) => setMapping({ ...columns, [f.key]: Number(e.target.value) })}>
                  <option value={-1}>— not in sheet —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Card>
      )}

      {body.length > 0 && (
        <Card
          title="Preview"
          sub={`${valid.length} of ${parsed.length} rows ready`}
          actions={
            <button className="primary" disabled={!valid.length || busy} onClick={doImport}>
              {busy ? 'Importing…' : `Import ${valid.length} rows`}
            </button>
          }
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  {spec.fields.map((f) => (
                    <th key={f.key}>{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.slice(0, 50).map((r, i) => (
                  <tr key={i}>
                    <td>{r.errors.length ? <Pill tone="bad">✕ {r.errors.join('; ')}</Pill> : <Pill tone="good">✓</Pill>}</td>
                    {spec.fields.map((f) => (
                      <td key={f.key} className={f.type === 'number' ? 'r' : ''}>
                        {f.key === 'accountId' || f.key === 'retainerId' ? (body[i][columns[f.key]] ?? '') : String(r.values[f.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.length > 50 && <p className="faint">Showing first 50 of {parsed.length} rows.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
