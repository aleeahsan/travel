import { useState, type FormEvent } from 'react';
import { Modal } from './ui';

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'textarea' | 'multi' | 'list';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  wide?: boolean;
  options?: { value: string; label: string }[];
  /** Autocomplete suggestions for text fields (e.g. existing brand names). */
  suggestions?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  /** Number fields: store an empty input as null instead of 0. */
  nullable?: boolean;
}

type Values = Record<string, unknown>;

/**
 * One form component for every data-entry screen, so all teams see the same
 * layout and validation. `list` fields are comma-separated text stored as string[].
 */
export function FormModal({
  title,
  fields,
  initial,
  onSubmit,
  onClose,
  onDelete,
  submitLabel = 'Save',
}: {
  title: string;
  fields: FieldSpec[];
  initial: object;
  onSubmit: (values: Values) => Promise<void>;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Values>(() => ({ ...(initial as Values) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const missing = fields.filter((f) => f.required && (values[f.key] === '' || values[f.key] == null));
    if (missing.length) return setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
    const out: Values = { ...values };
    for (const f of fields) {
      if (f.type === 'number') out[f.key] = values[f.key] === '' || values[f.key] == null ? (f.nullable ? null : 0) : Number(values[f.key]);
      if (f.type === 'list' && typeof values[f.key] === 'string')
        out[f.key] = String(values[f.key]).split(',').map((s) => s.trim()).filter(Boolean);
      if (f.type === 'datetime' && typeof values[f.key] === 'string' && values[f.key]) out[f.key] = `${String(values[f.key]).slice(0, 16)}:00`;
      if ((f.type === 'date' || f.type === 'datetime') && values[f.key] === '') out[f.key] = null;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(out);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button
              className="danger"
              style={{ marginRight: 'auto' }}
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Delete this record? This cannot be undone.')) return;
                setBusy(true);
                try {
                  await onDelete();
                  onClose();
                } catch (err) {
                  setError((err as Error).message);
                  setBusy(false);
                }
              }}
            >
              Delete
            </button>
          )}
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        {fields.map((f) => (
          <label key={f.key} className={`field ${f.wide || f.type === 'textarea' || f.type === 'multi' ? 'wide' : ''}`}>
            <span>
              {f.label}
              {f.required && ' *'}
            </span>
            <Input field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
            {f.hint && <span className="faint">{f.hint}</span>}
          </label>
        ))}
        <button type="submit" hidden />
      </form>
      {error && <div className="alert bad">{error}</div>}
    </Modal>
  );
}

function Input({ field: f, value, onChange }: { field: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  const listId = f.suggestions?.length ? `dl-${f.key}` : undefined;
  switch (f.type) {
    case 'textarea':
      return <textarea value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} rows={4} />;
    case 'select':
      return (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {!f.required && <option value="">—</option>}
          {f.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="checks">
          {f.options?.map((o) => (
            <label key={o.value}>
              <input
                type="checkbox"
                checked={arr.includes(o.value)}
                onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))}
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case 'number':
      return (
        <input
          type="number"
          inputMode="decimal"
          value={value == null ? '' : String(value)}
          min={f.min}
          max={f.max}
          step={f.step ?? 'any'}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return <input type="date" value={String(value ?? '').slice(0, 10)} onChange={(e) => onChange(e.target.value)} />;
    case 'datetime':
      return <input type="datetime-local" value={String(value ?? '').slice(0, 16)} onChange={(e) => onChange(e.target.value)} />;
    case 'list':
      return (
        <input
          value={Array.isArray(value) ? (value as string[]).join(', ') : String(value ?? '')}
          placeholder={f.placeholder ?? 'Comma separated'}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <>
          <input value={String(value ?? '')} placeholder={f.placeholder} list={listId} onChange={(e) => onChange(e.target.value)} />
          {listId && (
            <datalist id={listId}>
              {f.suggestions!.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </>
      );
  }
}

export const unique = (xs: (string | null | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();
