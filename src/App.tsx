import { useEffect, useState, type FormEvent } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { backend, supabase } from './lib/backend';
import { COMPANY_NAME, ROLE_LABELS } from './lib/config';
import { useAccountRows, useRetainerRows } from './lib/derived';
import { StoreProvider, useStore } from './lib/store';
import type { Role } from './lib/types';
import AccountDetail from './pages/AccountDetail';
import Accounts from './pages/Accounts';
import Import from './pages/Import';
import OrganicMarketing from './pages/OrganicMarketing';
import Overview from './pages/Overview';
import PaidMarketing from './pages/PaidMarketing';
import Reports from './pages/Reports';
import RetainerDetail from './pages/RetainerDetail';
import Retainers from './pages/Retainers';
import Sales from './pages/Sales';
import Team from './pages/Team';

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </StoreProvider>
  );
}

function Gate() {
  const { session, data, error, toast } = useStore();
  if (!session) return <Login />;
  if (error)
    return (
      <div className="login">
        <div className="card">
          <h2>Couldn't load data</h2>
          <div className="alert bad">{error}</div>
          <p className="muted">If this is a new Supabase project, run the SQL in supabase/migrations first (see README).</p>
        </div>
      </div>
    );
  if (!data) return <div className="login muted">Loading…</div>;
  return (
    <>
      <Shell />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function Shell() {
  const { session, setDemoRole, signOut, resetDemo } = useStore();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const atRisk = useAccountRows().filter((a) => a.health.band === 'at-risk' && a.account.status !== 'closed').length;
  const offTrack = useRetainerRows().filter((r) => r.health.track === 'off-track' && r.retainer.status !== 'ended').length;

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">◆</span> {COMPANY_NAME}
        </div>
        <nav className="nav">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/reports">Reports hub</NavLink>
          <div className="nav-group">Compliance</div>
          <NavLink to="/sales">Sales performance</NavLink>
          <NavLink to="/accounts">
            Account health {atRisk > 0 && <span className="count" title="Accounts at risk">{atRisk}</span>}
          </NavLink>
          <div className="nav-group">Marketing</div>
          <NavLink to="/marketing/paid">Paid marketing</NavLink>
          <NavLink to="/marketing/organic">Organic marketing</NavLink>
          <NavLink to="/retainers">
            Retainers {offTrack > 0 && <span className="count" title="Retainers off track">{offTrack}</span>}
          </NavLink>
          <div className="nav-group">Data</div>
          <NavLink to="/import">Import from sheet</NavLink>
          <NavLink to="/team">Team & access</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div style={{ fontSize: 13 }}>
            <b>{session!.name}</b>
            <div className="faint">{ROLE_LABELS[session!.role]}</div>
          </div>
          {backend.kind === 'local' ? (
            <>
              <label className="field">
                Demo: view as
                <select value={session!.role} onChange={(e) => setDemoRole(e.target.value as Role)}>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>
              <button className="small" onClick={() => window.confirm('Reset all demo data back to the sample set?') && void resetDemo()}>
                Reset demo data
              </button>
            </>
          ) : (
            <button className="small" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            ☰
          </button>
          {backend.kind === 'local' && (
            <span className="pill warn" title="Data is stored in this browser only. Connect Supabase to share with the team.">
              ! Demo mode — sample data, saved in this browser only
            </span>
          )}
          <div className="spacer" />
          <span className="faint">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounts/:id" element={<AccountDetail />} />
          <Route path="/marketing/paid" element={<PaidMarketing />} />
          <Route path="/marketing/organic" element={<OrganicMarketing />} />
          <Route path="/retainers" element={<Retainers />} />
          <Route path="/retainers/:id" element={<RetainerDetail />} />
          <Route path="/import" element={<Import />} />
          <Route path="/team" element={<Team />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: err } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    if (err) setError(err.message);
    else setSent(true);
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">◆</span> {COMPANY_NAME}
        </div>
        <h2>Sign in</h2>
        {sent ? (
          <p className="muted">Check {email} for a sign-in link.</p>
        ) : (
          <>
            <label className="field">
              Work email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </label>
            <button className="primary" type="submit">
              Email me a sign-in link
            </button>
            <p className="faint">New users get view-only access until the COO assigns their team.</p>
          </>
        )}
        {error && <div className="alert bad">{error}</div>}
      </form>
    </div>
  );
}
