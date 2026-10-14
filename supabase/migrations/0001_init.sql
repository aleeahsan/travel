-- Ops Hub schema.
-- Run once in a new Supabase project (SQL editor, or `supabase db push`).
--
-- Access model
--   * Everyone signed in can READ everything (the hub is the single source of truth).
--   * WRITE access depends on the role in public.profiles:
--       coo        – everything, and assigns roles to other people
--       compliance – sales, accounts, payments, interactions, compliance reports
--       marketing  – paid, organic, retainers, deliverables, issues, marketing reports
--       viewer     – read only (CEO, leadership, anyone not yet assigned)
--   * The first person to sign in becomes COO; everyone after starts as viewer.
--
-- Timestamps for report periods and interactions are stored WITHOUT time zone, i.e.
-- as the company's local wall-clock time, so "the 2pm report" means 2pm for everyone.

-- ------------------------------------------------------------------ profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'viewer' check (role in ('coo', 'compliance', 'marketing', 'viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles where role = 'coo') then 'viewer' else 'coo' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "coo manages roles" on public.profiles
  for update to authenticated using (public.app_role() = 'coo') with check (public.app_role() = 'coo');

-- ------------------------------------------------------------------- reports

create table public.reports (
  id text primary key default gen_random_uuid()::text,
  team text not null check (team in ('compliance', 'marketing', 'operations')),
  cadence text not null check (cadence in ('hourly', 'daily')),
  period_start timestamp not null,
  author text not null default '',
  title text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  highlights text not null default '',
  blockers text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index reports_period_idx on public.reports (team, cadence, period_start desc);

-- ------------------------------------------------------------------- sales

create table public.sales_entries (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  brand text not null,
  rep text not null,
  leads double precision not null default 0,
  calls double precision not null default 0,
  deals_closed double precision not null default 0,
  revenue_booked double precision not null default 0,
  revenue_collected double precision not null default 0,
  refunds double precision not null default 0,
  notes text not null default '',
  created_by uuid default auth.uid()
);
create index sales_entries_date_idx on public.sales_entries (date);

-- --------------------------------------------------------------- marketing

create table public.paid_entries (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  brand text not null,
  client_brand text not null default '',
  channel text not null,
  campaign text not null default '',
  spend double precision not null default 0,
  impressions double precision not null default 0,
  clicks double precision not null default 0,
  leads double precision not null default 0,
  conversions double precision not null default 0,
  revenue double precision not null default 0,
  created_by uuid default auth.uid()
);
create index paid_entries_date_idx on public.paid_entries (date);

create table public.organic_entries (
  id text primary key default gen_random_uuid()::text,
  date date not null,
  brand text not null,
  platform text not null,
  posts double precision not null default 0,
  views double precision not null default 0,
  reach double precision not null default 0,
  likes double precision not null default 0,
  comments double precision not null default 0,
  shares double precision not null default 0,
  saves double precision not null default 0,
  clicks double precision not null default 0,
  followers_gained double precision not null default 0,
  created_by uuid default auth.uid()
);
create index organic_entries_date_idx on public.organic_entries (date);

create table public.retainers (
  id text primary key default gen_random_uuid()::text,
  client text not null,
  brand text not null,
  owner text not null default '',
  services text[] not null default '{}',
  monthly_fee double precision not null default 0,
  start_date date not null,
  renewal_date date not null,
  status text not null default 'active' check (status in ('onboarding', 'active', 'paused', 'ended')),
  reporting_cadence text not null default '',
  kpis jsonb not null default '[]'::jsonb,
  notes text not null default '',
  created_by uuid default auth.uid()
);

create table public.deliverables (
  id text primary key default gen_random_uuid()::text,
  retainer_id text not null references public.retainers (id) on delete cascade,
  title text not null,
  type text not null default '',
  due_date date not null,
  delivered_date date,
  status text not null default 'not-started'
    check (status in ('not-started', 'in-progress', 'in-review', 'delivered', 'blocked')),
  progress double precision not null default 0 check (progress between 0 and 100),
  quality_score double precision check (quality_score between 1 and 5),
  planned_qty double precision not null default 1,
  delivered_qty double precision not null default 0,
  created_by uuid default auth.uid()
);
create index deliverables_retainer_idx on public.deliverables (retainer_id);

create table public.retainer_issues (
  id text primary key default gen_random_uuid()::text,
  retainer_id text not null references public.retainers (id) on delete cascade,
  title text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  owner text not null default '',
  raised_at date not null,
  resolved_at date,
  details text not null default '',
  created_by uuid default auth.uid()
);
create index retainer_issues_retainer_idx on public.retainer_issues (retainer_id);

-- ------------------------------------------------------------ account health

create table public.accounts (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  brand text not null,
  sales_rep text not null default '',
  account_manager text not null default '',
  project_manager text not null default '',
  status text not null default 'active' check (status in ('onboarding', 'active', 'paused', 'closed')),
  package_name text not null default '',
  contract_value double precision not null default 0,
  start_date date not null,
  payment_cycle text not null default 'monthly' check (payment_cycle in ('one-time', 'monthly', 'milestone', 'quarterly')),
  performance_rating double precision not null default 3 check (performance_rating between 1 and 5),
  performance_notes text not null default '',
  created_by uuid default auth.uid()
);

create table public.payments (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts (id) on delete cascade,
  due_date date not null,
  amount double precision not null,
  paid_date date,
  paid_amount double precision not null default 0,
  note text not null default '',
  created_by uuid default auth.uid()
);
create index payments_account_idx on public.payments (account_id);

create table public.interactions (
  id text primary key default gen_random_uuid()::text,
  account_id text not null references public.accounts (id) on delete cascade,
  date timestamp not null,
  channel text not null check (channel in ('chat', 'call', 'video-meeting', 'email')),
  team text not null check (team in ('sales', 'account-management', 'project-management', 'compliance')),
  direction text not null check (direction in ('inbound', 'outbound')),
  summary text not null default '',
  transcript text not null default '',
  recording_url text not null default '',
  sentiment text not null default 'neutral' check (sentiment in ('positive', 'neutral', 'negative')),
  flags text[] not null default '{}',
  logged_by text not null default '',
  created_by uuid default auth.uid()
);
create index interactions_account_idx on public.interactions (account_id, date desc);

-- ------------------------------------------------------------------- policies

do $$
declare
  t text;
  writers text[];
  spec jsonb := '{
    "sales_entries":   ["coo", "compliance"],
    "accounts":        ["coo", "compliance"],
    "payments":        ["coo", "compliance"],
    "interactions":    ["coo", "compliance"],
    "paid_entries":    ["coo", "marketing"],
    "organic_entries": ["coo", "marketing"],
    "retainers":       ["coo", "marketing"],
    "deliverables":    ["coo", "marketing"],
    "retainer_issues": ["coo", "marketing"]
  }';
begin
  for t in select jsonb_object_keys(spec) loop
    select array_agg(x) into writers from jsonb_array_elements_text(spec -> t) as x;
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read for signed-in users" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "team insert" on public.%I for insert to authenticated with check (public.app_role() = any (%L::text[]))', t, writers);
    execute format('create policy "team update" on public.%I for update to authenticated using (public.app_role() = any (%L::text[])) with check (public.app_role() = any (%L::text[]))', t, writers, writers);
    execute format('create policy "team delete" on public.%I for delete to authenticated using (public.app_role() = any (%L::text[]))', t, writers);
  end loop;
end;
$$;

-- Reports: each team writes only its own reports; the COO can write any.
alter table public.reports enable row level security;
create policy "read for signed-in users" on public.reports for select to authenticated using (true);
create policy "own team insert" on public.reports for insert to authenticated
  with check (public.app_role() = 'coo' or public.app_role() = team);
create policy "own team update" on public.reports for update to authenticated
  using (public.app_role() = 'coo' or public.app_role() = team)
  with check (public.app_role() = 'coo' or public.app_role() = team);
create policy "own team delete" on public.reports for delete to authenticated
  using (public.app_role() = 'coo' or public.app_role() = team);

-- ------------------------------------------------------------------ realtime
-- Lets every open dashboard refresh when anyone saves something.

alter publication supabase_realtime add table
  public.reports, public.sales_entries, public.paid_entries, public.organic_entries,
  public.retainers, public.deliverables, public.retainer_issues,
  public.accounts, public.payments, public.interactions;
