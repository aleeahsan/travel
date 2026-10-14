# Ops Hub

One window for the COO, leadership, and every team's reporting. It replaces the shared Google Sheets and the separate docs teams update by hand.

| Section | Who fills it in | What it shows |
|---|---|---|
| **Overview** | — | Company KPIs, revenue vs ad spend, today's hourly-report coverage, accounts and retainers needing attention |
| **Reports hub** | Every team | Hourly and daily reports, with a grid that flags any hour where a report is missing |
| **Sales performance** | Compliance | Revenue booked and collected, deals, close rate, refunds by brand and rep (the funnel stays in the Sales Hub) |
| **Account health** | Compliance | Every account's health score, payment cycle, last payment, remaining and overdue amounts, client responsiveness, and risk statements (refunds, chargeback threats…) |
| ↳ account page | Compliance | Full log of chats, calls, transcripts and video meetings from sales, account management and project management, plus the payment schedule |
| **Paid marketing** | Marketing | Spend per brand, per customer brand, per channel and campaign, plus CTR, CPC, CPM, CPL, CPA and ROAS |
| **Organic marketing** | Marketing | Posts, views, reach, likes, comments, shares, saves, clicks and followers by brand and platform |
| **Retainers** | Marketing | Each retainer's health, on-track status, project status, progress, deadlines met, quality, quantity and open issues |
| ↳ retainer page | Marketing | Deliverables, overdue alerts, issues, reporting details, client KPIs vs target, and paid media run for that client |
| **Import from sheet** | Compliance / Marketing | Copy rows out of Google Sheets or Excel, paste them in, check the preview, then import |

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for health scoring and sheet import
npm run build      # production build in dist/
```

With no configuration the app runs in **demo mode**. It loads fictional sample data stored only in your browser, and a "view as" switcher shows the hub as each team would see it.

## Sharing it with the teams (Supabase)

1. Create a Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key (Project Settings → API).
4. Deploy the `dist/` build to any static host (Netlify, Vercel, Cloudflare Pages…), setting the same two variables there.
5. Add the deployed URL to Supabase → Authentication → URL configuration, so the email sign-in links work.

**Access**

- People sign in with a link sent to their work email.
- **The first person to sign in becomes COO.** Everyone after that starts as a read-only *viewer* until the COO assigns their team on the **Team & access** page.
- Everyone signed in can see everything. Editing is limited by team, and the database itself enforces this through row-level security, not just the UI:

| | COO | Compliance | Marketing | Viewer |
|---|---|---|---|---|
| Sales, accounts, payments, interactions | edit | edit | view | view |
| Paid, organic, retainers, deliverables, issues | edit | view | edit | view |
| Hourly / daily reports | any team | own team | own team | view |

When anyone saves something, every open dashboard refreshes automatically.

## How the health scores work

Both scores start at 100 and lose points for specific reasons. Each detail page lists those reasons, so nobody has to guess why an account or retainer is red. Score bands: **75+ healthy**, **50–74 watch**, **below 50 at risk**.

**Account health** (`src/lib/health.ts → accountHealth`)

- Overdue payment: −15 each (max −30)
- Client statements logged in the last 30 days: chargeback threat −30, legal threat −30, refund request −20, cancellation −20, payment dispute −15, complaint −10 (total capped at −50)
- Responsiveness, measured from the last *inbound* client contact: 4–10 days −10; over 10 days −20; none logged −10
- Each negative interaction among the last three: −5
- Compliance's performance rating: (rating − 3) × 5, so a 5/5 rating adds 10 and a 1/5 rating subtracts 10

**Retainer health** (`retainerHealth`)

- On-time delivery below 100%: up to −40
- Each past-due deliverable: −8 (max −30)
- Each blocked deliverable: −5
- Each open issue: critical −20, high −10, medium −4, low −1
- Average quality below 4/5: −10 per point
- Under half the planned quantity delivered while work is overdue: −5
- **On track / At risk / Off track:** any past-due work or open high/critical issue makes a retainer *at risk*. A score under 50, or three or more past-due deliverables, makes it *off track*.

These weights are a starting point. Tune them with the compliance and marketing leads.

## Customising

All of these live in `src/lib/config.ts`:

- **Report fields:** `REPORT_TEMPLATES` sets which numbers each team enters in hourly and daily reports
- **Working hours:** `WORK_HOURS` sets which hours must have an hourly report
- **Currency:** `CURRENCY` (default USD)
- **Company name:** `COMPANY_NAME`
- **Channel and platform suggestions:** `CHANNELS`, `PLATFORMS`

## Known limitations

- **No automatic integrations yet.** Data comes in through forms and the paste-from-sheet importer. Nothing pulls automatically from Meta, Google Ads, your call or chat tools, or the payment processor.
- **Transcripts and chat logs are pasted in as text.** Recordings are stored as links, not uploaded files.
- **Report times use one local time zone.** Report hours and interaction times are stored as local wall-clock time, which assumes the teams share a time zone.
- **Everything loads into the browser.** Fine for thousands of rows; at much larger volumes, move aggregation into the database.
