import { useEffect, useState } from 'react';
import { Card, DataTable, PageHead } from '../components/ui';
import { supabase } from '../lib/backend';
import { ROLE_LABELS } from '../lib/config';
import { useData, WRITE_ACCESS } from '../lib/store';
import type { CollectionName, Role } from '../lib/types';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
}

const COLLECTION_LABELS: Record<CollectionName, string> = {
  reports: 'Hourly & daily reports (own team)',
  sales: 'Sales performance',
  accounts: 'Accounts',
  payments: 'Payments',
  interactions: 'Chats, calls, meetings',
  paid: 'Paid marketing',
  organic: 'Organic marketing',
  retainers: 'Retainers',
  deliverables: 'Retainer deliverables',
  issues: 'Retainer issues',
};

export default function Team() {
  const { session, notify } = useData();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const isCoo = session!.role === 'coo';

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .order('email')
      .then(({ data }) => setProfiles((data as Profile[]) ?? []));
  }, []);

  const setRole = async (p: Profile, role: Role) => {
    const { error } = await supabase!.from('profiles').update({ role }).eq('id', p.id);
    if (error) return notify(error.message);
    setProfiles((ps) => ps!.map((x) => (x.id === p.id ? { ...x, role } : x)));
    notify(`${p.email} is now ${ROLE_LABELS[role]}`);
  };

  const roles = Object.keys(ROLE_LABELS) as Role[];

  return (
    <div className="page">
      <PageHead title="Team & access" sub="Everyone signed in can see every dashboard. Editing is limited by team." />

      <Card title="Who can edit what">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                {roles.map((r) => (
                  <th key={r}>{ROLE_LABELS[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(WRITE_ACCESS) as CollectionName[]).map((c) => (
                <tr key={c}>
                  <td>{COLLECTION_LABELS[c]}</td>
                  {roles.map((r) => (
                    <td key={r}>{WRITE_ACCESS[c].includes(r) ? '✓ Edit' : <span className="faint">View</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="People">
        {!supabase ? (
          <p className="muted">
            In demo mode there are no real accounts — use “Demo: view as” in the sidebar to see the hub as each team would. Once Supabase is connected,
            everyone who signs in appears here and the COO assigns their team.
          </p>
        ) : profiles === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            rows={profiles}
            rowKey={(p) => p.id}
            columns={[
              { key: 'email', label: 'Email', render: (p) => p.email },
              { key: 'name', label: 'Name', render: (p) => p.full_name || '—' },
              {
                key: 'role',
                label: 'Team / role',
                render: (p) =>
                  isCoo ? (
                    <select value={p.role} onChange={(e) => void setRole(p, e.target.value as Role)} style={{ width: 'auto' }}>
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[p.role]
                  ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
