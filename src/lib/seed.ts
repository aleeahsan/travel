// Demo data so the hub is explorable before real data is connected.
// Everything here is fictional and generated relative to today's date.

import { addDays, todayKey } from './dates';
import type {
  Account,
  DataSet,
  Deliverable,
  Interaction,
  OrganicEntry,
  PaidEntry,
  Payment,
  Report,
  Retainer,
  RetainerIssue,
  SalesEntry,
} from './types';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

let counter = 0;
const id = (p: string) => `${p}_${(++counter).toString(36)}`;

export function buildSeed(today = todayKey()): DataSet {
  counter = 0;
  const r = rng(42);
  const between = (a: number, b: number) => Math.round(a + r() * (b - a));
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  const brands = ['Northwind Digital', 'Bluepeak Studio', 'Atlas Growth'];
  const reps = ['Sara K.', 'Omar F.', 'Hina R.', 'Bilal A.', 'Zoe M.'];

  // ---- Sales (60 days)
  const sales: SalesEntry[] = [];
  for (let d = 59; d >= 0; d--) {
    const date = addDays(today, -d);
    for (const rep of reps) {
      const calls = between(8, 30);
      const deals = between(0, Math.max(1, Math.round(calls / 9)));
      const booked = deals * between(900, 3200);
      sales.push({
        id: id('sal'),
        date,
        brand: pick(brands),
        rep,
        leads: between(5, 25),
        calls,
        dealsClosed: deals,
        revenueBooked: booked,
        revenueCollected: Math.round(booked * (0.4 + r() * 0.5)),
        refunds: r() < 0.06 ? between(200, 1200) : 0,
        notes: '',
      });
    }
  }

  // ---- Paid marketing (60 days)
  const paid: PaidEntry[] = [];
  const campaigns: { brand: string; clientBrand: string; channel: string; campaign: string; base: number }[] = [
    { brand: 'Northwind Digital', clientBrand: 'Lumen Skincare', channel: 'Meta', campaign: 'Lumen – Prospecting', base: 420 },
    { brand: 'Northwind Digital', clientBrand: 'Lumen Skincare', channel: 'TikTok', campaign: 'Lumen – UGC Spark', base: 260 },
    { brand: 'Northwind Digital', clientBrand: 'Harbor Realty', channel: 'Google', campaign: 'Harbor – Search', base: 310 },
    { brand: 'Bluepeak Studio', clientBrand: 'Vertex Fitness', channel: 'Meta', campaign: 'Vertex – Leads', base: 280 },
    { brand: 'Bluepeak Studio', clientBrand: 'Copperleaf Cafe', channel: 'Meta', campaign: 'Copperleaf – Local', base: 90 },
    { brand: 'Atlas Growth', clientBrand: 'Nimbus SaaS', channel: 'LinkedIn', campaign: 'Nimbus – ABM', base: 350 },
    { brand: 'Atlas Growth', clientBrand: 'Nimbus SaaS', channel: 'Google', campaign: 'Nimbus – Brand Search', base: 120 },
    { brand: 'Atlas Growth', clientBrand: 'Atlas Growth', channel: 'Meta', campaign: 'Atlas – In-house lead gen', base: 150 },
    { brand: 'Bluepeak Studio', clientBrand: 'Orbit Travel', channel: 'Google', campaign: 'Orbit – Performance Max', base: 240 },
  ];
  for (let d = 59; d >= 0; d--) {
    const date = addDays(today, -d);
    for (const c of campaigns) {
      const spend = Math.round(c.base * (0.75 + r() * 0.5));
      const cpm = c.channel === 'LinkedIn' ? 32 : c.channel === 'Google' ? 18 : 9;
      const impressions = Math.round((spend / cpm) * 1000);
      const ctr = c.channel === 'Google' ? 0.035 + r() * 0.03 : 0.008 + r() * 0.012;
      const clicks = Math.round(impressions * ctr);
      const leads = Math.round(clicks * (0.04 + r() * 0.06));
      const conversions = Math.round(leads * (0.12 + r() * 0.2));
      paid.push({
        id: id('pd'),
        date,
        ...c,
        spend,
        impressions,
        clicks,
        leads,
        conversions,
        revenue: Math.round(conversions * between(40, 140)),
      });
    }
  }
  paid.forEach((p) => delete (p as Partial<PaidEntry & { base: number }>).base);

  // ---- Organic (60 days)
  const organic: OrganicEntry[] = [];
  const orgSets = [
    ['Northwind Digital', 'Instagram'],
    ['Northwind Digital', 'LinkedIn'],
    ['Bluepeak Studio', 'TikTok'],
    ['Bluepeak Studio', 'Instagram'],
    ['Atlas Growth', 'YouTube'],
    ['Atlas Growth', 'LinkedIn'],
  ];
  for (let d = 59; d >= 0; d--) {
    const date = addDays(today, -d);
    for (const [brand, platform] of orgSets) {
      const posts = between(0, 3);
      const views = posts ? between(800, platform === 'TikTok' ? 22000 : 7000) * posts : between(100, 600);
      const likes = Math.round(views * (0.02 + r() * 0.04));
      organic.push({
        id: id('org'),
        date,
        brand,
        platform,
        posts,
        views,
        reach: Math.round(views * (0.6 + r() * 0.3)),
        likes,
        comments: Math.round(likes * (0.05 + r() * 0.1)),
        shares: Math.round(likes * (0.03 + r() * 0.08)),
        saves: Math.round(likes * (0.04 + r() * 0.1)),
        clicks: Math.round(views * (0.002 + r() * 0.006)),
        followersGained: between(0, posts * 25 + 5),
      });
    }
  }

  // ---- Retainers, deliverables, issues
  const retainers: Retainer[] = [
    {
      id: 'ret_lumen',
      client: 'Lumen Skincare',
      brand: 'Northwind Digital',
      owner: 'Ayesha N.',
      services: ['Paid social', 'UGC production', 'Monthly reporting'],
      monthlyFee: 6500,
      startDate: addDays(today, -210),
      renewalDate: addDays(today, 40),
      status: 'active',
      reportingCadence: 'Weekly update + monthly report',
      kpis: [
        { name: 'ROAS', target: 3, actual: 3.4 },
        { name: 'UGC videos / month', target: 12, actual: 11 },
      ],
      notes: 'Client is happy with creative output; wants more TikTok testing.',
    },
    {
      id: 'ret_harbor',
      client: 'Harbor Realty',
      brand: 'Northwind Digital',
      owner: 'Daniyal S.',
      services: ['Google Ads', 'Landing pages', 'SEO'],
      monthlyFee: 4200,
      startDate: addDays(today, -120),
      renewalDate: addDays(today, 15),
      status: 'active',
      reportingCadence: 'Bi-weekly call + monthly report',
      kpis: [
        { name: 'Cost per lead', target: 45, actual: 61 },
        { name: 'Landing pages shipped', target: 4, actual: 2 },
      ],
      notes: 'Renewal coming up; CPL above target for 3 weeks.',
    },
    {
      id: 'ret_vertex',
      client: 'Vertex Fitness',
      brand: 'Bluepeak Studio',
      owner: 'Maria L.',
      services: ['Paid social', 'Content calendar', 'Community management'],
      monthlyFee: 3800,
      startDate: addDays(today, -60),
      renewalDate: addDays(today, 120),
      status: 'active',
      reportingCadence: 'Weekly report',
      kpis: [
        { name: 'Leads / month', target: 300, actual: 284 },
        { name: 'Posts / month', target: 20, actual: 20 },
      ],
      notes: '',
    },
    {
      id: 'ret_nimbus',
      client: 'Nimbus SaaS',
      brand: 'Atlas Growth',
      owner: 'Hamza Q.',
      services: ['LinkedIn ABM', 'Content marketing', 'Email nurture'],
      monthlyFee: 9000,
      startDate: addDays(today, -300),
      renewalDate: addDays(today, 65),
      status: 'active',
      reportingCadence: 'Monthly QBR-style report',
      kpis: [
        { name: 'SQLs / month', target: 40, actual: 22 },
        { name: 'Blog articles / month', target: 6, actual: 3 },
      ],
      notes: 'Writer capacity issue; client escalated on last call.',
    },
    {
      id: 'ret_orbit',
      client: 'Orbit Travel',
      brand: 'Bluepeak Studio',
      owner: 'Maria L.',
      services: ['Performance Max', 'Creative production'],
      monthlyFee: 2900,
      startDate: addDays(today, -14),
      renewalDate: addDays(today, 76),
      status: 'onboarding',
      reportingCadence: 'Weekly update',
      kpis: [{ name: 'Account setup complete', target: 1, actual: 0 }],
      notes: 'Onboarding — tracking and feed setup in progress.',
    },
  ];

  const dl = (
    retainerId: string,
    title: string,
    type: string,
    dueOffset: number,
    status: Deliverable['status'],
    progress: number,
    deliveredOffset: number | null,
    quality: number | null,
    planned = 1,
    delivered = status === 'delivered' ? planned : 0,
  ): Deliverable => ({
    id: id('dl'),
    retainerId,
    title,
    type,
    dueDate: addDays(today, dueOffset),
    deliveredDate: deliveredOffset === null ? null : addDays(today, deliveredOffset),
    status,
    progress,
    qualityScore: quality,
    plannedQty: planned,
    deliveredQty: delivered,
  });

  const deliverables: Deliverable[] = [
    dl('ret_lumen', 'September performance report', 'Report', -12, 'delivered', 100, -13, 5),
    dl('ret_lumen', 'UGC batch #9', 'Video', -6, 'delivered', 100, -6, 4, 6),
    dl('ret_lumen', 'UGC batch #10', 'Video', 4, 'in-progress', 55, null, null, 6, 3),
    dl('ret_lumen', 'Q4 creative refresh – statics', 'Design', 7, 'in-progress', 30, null, null, 10, 2),
    dl('ret_harbor', 'Landing page – waterfront listings', 'Web', -9, 'delivered', 100, -4, 3),
    dl('ret_harbor', 'Landing page – first-time buyers', 'Web', -3, 'in-review', 90, null, null),
    dl('ret_harbor', 'Search campaign restructure', 'Ads', -1, 'blocked', 40, null, null),
    dl('ret_harbor', 'Monthly report', 'Report', 5, 'not-started', 0, null, null),
    dl('ret_vertex', 'October content calendar', 'Content', -15, 'delivered', 100, -16, 5),
    dl('ret_vertex', 'Reels pack – week 2', 'Video', -5, 'delivered', 100, -5, 4, 5),
    dl('ret_vertex', 'Reels pack – week 3', 'Video', 2, 'in-progress', 60, null, null, 5, 3),
    dl('ret_vertex', 'Weekly report', 'Report', 1, 'in-progress', 50, null, null),
    dl('ret_nimbus', 'ABM audience refresh', 'Ads', -20, 'delivered', 100, -14, 3),
    dl('ret_nimbus', 'Blog: SOC2 guide', 'Article', -10, 'in-progress', 70, null, null),
    dl('ret_nimbus', 'Blog: Pricing teardown', 'Article', -4, 'not-started', 0, null, null),
    dl('ret_nimbus', 'Nurture sequence v2', 'Email', -2, 'in-review', 85, null, null, 5, 4),
    dl('ret_nimbus', 'Monthly report', 'Report', 3, 'not-started', 0, null, null),
    dl('ret_orbit', 'Conversion tracking setup', 'Tracking', 2, 'in-progress', 65, null, null),
    dl('ret_orbit', 'Product feed audit', 'Ads', 6, 'not-started', 0, null, null),
  ];

  const issue = (
    retainerId: string,
    title: string,
    severity: RetainerIssue['severity'],
    status: RetainerIssue['status'],
    owner: string,
    raisedOffset: number,
    details: string,
  ): RetainerIssue => ({
    id: id('iss'),
    retainerId,
    title,
    severity,
    status,
    owner,
    raisedAt: addDays(today, raisedOffset),
    resolvedAt: status === 'resolved' ? addDays(today, raisedOffset + 2) : null,
    details,
  });

  const issues: RetainerIssue[] = [
    issue('ret_harbor', 'CPL 35% above target', 'high', 'open', 'Daniyal S.', -18, 'Search terms drifting to rentals; restructure blocked on client approval.'),
    issue('ret_harbor', 'Waiting on client for listing photos', 'medium', 'open', 'Daniyal S.', -6, 'Blocks second landing page.'),
    issue('ret_nimbus', 'Writer capacity — 2 articles behind', 'critical', 'open', 'Hamza Q.', -9, 'Need freelance writer or reduce scope this month.'),
    issue('ret_nimbus', 'Client escalation on SQL volume', 'high', 'open', 'Hamza Q.', -3, 'Raised on last monthly call by VP Marketing.'),
    issue('ret_lumen', 'Pixel firing twice on checkout', 'medium', 'resolved', 'Ayesha N.', -25, 'Fixed via GTM dedupe.'),
    issue('ret_vertex', 'Creator missed shoot date', 'low', 'resolved', 'Maria L.', -11, 'Rescheduled; no impact on deadline.'),
    issue('ret_orbit', 'Merchant Center access pending', 'low', 'open', 'Maria L.', -2, 'Client IT to grant access.'),
  ];

  // ---- Accounts, payments, interactions
  const accounts: Account[] = [
    { id: 'acc_1', name: 'Greenline Dental', brand: 'Northwind Digital', salesRep: 'Sara K.', accountManager: 'Rida T.', projectManager: 'Usman J.', status: 'active', packageName: 'Growth website + SEO', contractValue: 12000, startDate: addDays(today, -95), paymentCycle: 'monthly', performanceRating: 4, performanceNotes: 'Site live, rankings climbing.' },
    { id: 'acc_2', name: 'Peak Logistics', brand: 'Atlas Growth', salesRep: 'Omar F.', accountManager: 'Rida T.', projectManager: 'Kiran P.', status: 'active', packageName: 'Mobile app MVP', contractValue: 28000, startDate: addDays(today, -70), paymentCycle: 'milestone', performanceRating: 2, performanceNotes: 'Milestone 2 slipped by two weeks.' },
    { id: 'acc_3', name: 'Sunrise Bakery', brand: 'Bluepeak Studio', salesRep: 'Hina R.', accountManager: 'Faraz M.', projectManager: 'Usman J.', status: 'active', packageName: 'Brand identity + social', contractValue: 4500, startDate: addDays(today, -40), paymentCycle: 'one-time', performanceRating: 4, performanceNotes: '' },
    { id: 'acc_4', name: 'Meridian Law', brand: 'Northwind Digital', salesRep: 'Bilal A.', accountManager: 'Faraz M.', projectManager: 'Kiran P.', status: 'active', packageName: 'Website redesign', contractValue: 9500, startDate: addDays(today, -55), paymentCycle: 'milestone', performanceRating: 3, performanceNotes: 'Client unhappy with design round 2.' },
    { id: 'acc_5', name: 'Coastal Yoga', brand: 'Bluepeak Studio', salesRep: 'Zoe M.', accountManager: 'Rida T.', projectManager: 'Usman J.', status: 'onboarding', packageName: 'Booking app', contractValue: 7800, startDate: addDays(today, -8), paymentCycle: 'monthly', performanceRating: 3, performanceNotes: 'Kickoff done.' },
    { id: 'acc_6', name: 'Trident Motors', brand: 'Atlas Growth', salesRep: 'Omar F.', accountManager: 'Faraz M.', projectManager: 'Kiran P.', status: 'active', packageName: 'E-commerce build', contractValue: 18500, startDate: addDays(today, -130), paymentCycle: 'monthly', performanceRating: 4, performanceNotes: 'Launched; in support phase.' },
  ];

  const pay = (accountId: string, dueOffset: number, amount: number, paidOffset: number | null, paidAmount = paidOffset === null ? 0 : amount): Payment => ({
    id: id('pay'),
    accountId,
    dueDate: addDays(today, dueOffset),
    amount,
    paidDate: paidOffset === null ? null : addDays(today, paidOffset),
    paidAmount,
    note: '',
  });

  const payments: Payment[] = [
    pay('acc_1', -95, 3000, -95), pay('acc_1', -65, 3000, -64), pay('acc_1', -35, 3000, -33), pay('acc_1', -5, 3000, -4),
    pay('acc_2', -70, 8000, -70), pay('acc_2', -30, 10000, null), pay('acc_2', 20, 10000, null),
    pay('acc_3', -40, 4500, -40),
    pay('acc_4', -55, 4000, -55), pay('acc_4', -12, 3000, -2, 1500), pay('acc_4', 25, 2500, null),
    pay('acc_5', -8, 1950, -7), pay('acc_5', 22, 1950, null), pay('acc_5', 52, 1950, null), pay('acc_5', 82, 1950, null),
    pay('acc_6', -130, 4625, -130), pay('acc_6', -100, 4625, -99), pay('acc_6', -70, 4625, -68), pay('acc_6', -40, 4625, -41),
  ];

  const ts = (dayOffset: number, hour: number) => `${addDays(today, dayOffset)}T${String(hour).padStart(2, '0')}:00:00`;
  const it = (
    accountId: string,
    dayOffset: number,
    hour: number,
    channel: Interaction['channel'],
    team: Interaction['team'],
    direction: Interaction['direction'],
    sentiment: Interaction['sentiment'],
    summary: string,
    flags: Interaction['flags'] = [],
    transcript = '',
  ): Interaction => ({
    id: id('int'),
    accountId,
    date: ts(dayOffset, hour),
    channel,
    team,
    direction,
    summary,
    transcript,
    recordingUrl: '',
    sentiment,
    flags,
    loggedBy: 'Compliance',
  });

  const interactions: Interaction[] = [
    it('acc_1', -2, 11, 'chat', 'account-management', 'inbound', 'positive', 'Client thanked team for September SEO report.'),
    it('acc_1', -9, 15, 'video-meeting', 'project-management', 'outbound', 'positive', 'Monthly review — traffic +18% MoM.'),
    it('acc_2', -1, 16, 'call', 'account-management', 'inbound', 'negative', 'Client says they will dispute the milestone 2 invoice with their bank if the app is not delivered this week.', ['chargeback-threat', 'payment-dispute'],
      'AM: Thanks for taking the call…\nClient: Honestly we are frustrated. Milestone 2 was due two weeks ago.\nClient: If we don\'t see the build by Friday we will dispute the charge with our bank.\nAM: Understood, I\'ll escalate to the PM today and confirm a date in writing.'),
    it('acc_2', -6, 10, 'chat', 'project-management', 'outbound', 'neutral', 'PM shared revised timeline for milestone 2.'),
    it('acc_2', -12, 14, 'video-meeting', 'project-management', 'inbound', 'negative', 'Client unhappy with slip; asked about refund options for delays.', ['refund-request']),
    it('acc_3', -4, 12, 'chat', 'account-management', 'inbound', 'positive', 'Approved final logo; excited for social rollout.'),
    it('acc_4', -3, 17, 'email', 'account-management', 'outbound', 'neutral', 'Sent design round 3 and payment reminder.'),
    it('acc_4', -13, 11, 'video-meeting', 'project-management', 'inbound', 'negative', 'Client disliked round 2 direction; asked to pause work.', ['complaint']),
    it('acc_4', -16, 10, 'call', 'sales', 'outbound', 'neutral', 'Sales follow-up on upsell (declined).'),
    it('acc_5', -1, 10, 'video-meeting', 'project-management', 'inbound', 'positive', 'Kickoff call — scope confirmed, assets shared.'),
    it('acc_5', -8, 15, 'call', 'sales', 'inbound', 'positive', 'Closing call; signed and paid first instalment.'),
    it('acc_6', -18, 13, 'chat', 'account-management', 'inbound', 'neutral', 'Asked for minor product page tweaks.'),
    it('acc_6', -2, 9, 'email', 'account-management', 'outbound', 'neutral', 'Monthly invoice + support summary sent; no reply yet.'),
  ];

  // ---- Hourly & daily reports (today hourly so far, plus 14 days of daily)
  const reports: Report[] = [];
  const nowHour = new Date().getHours();
  for (let h = 9; h < Math.min(nowHour, 18); h++) {
    if (h === 13) continue; // a missed hour, to show gap detection
    const period = ts(0, h);
    reports.push({
      id: id('rep'),
      team: 'compliance',
      cadence: 'hourly',
      periodStart: period,
      author: 'Compliance – Nadia',
      title: `Sales update ${h}:00`,
      metrics: {
        calls: between(10, 25),
        dealsClosed: between(0, 3),
        revenueBooked: between(0, 6000),
        revenueCollected: between(0, 4000),
        refundRequests: r() < 0.15 ? 1 : 0,
      },
      highlights: h === 11 ? 'Closed Greenline Dental upsell.' : '',
      blockers: '',
      createdAt: `${addDays(today, 0)}T${String(h).padStart(2, '0')}:55:00`,
    });
    if (h % 2 === 1) {
      reports.push({
        id: id('rep'),
        team: 'marketing',
        cadence: 'hourly',
        periodStart: period,
        author: 'Marketing – Ali',
        title: `Spend pacing ${h}:00`,
        metrics: { adSpend: between(80, 260), clicks: between(150, 600), leads: between(3, 20) },
        highlights: '',
        blockers: h === 15 ? 'Meta account flagged one ad for review.' : '',
        createdAt: `${addDays(today, 0)}T${String(h).padStart(2, '0')}:50:00`,
      });
    }
  }
  for (let d = 14; d >= 1; d--) {
    const day = addDays(today, -d);
    const dayStart = `${day}T00:00:00`;
    reports.push({
      id: id('rep'),
      team: 'compliance',
      cadence: 'daily',
      periodStart: dayStart,
      author: 'Compliance – Nadia',
      title: `Daily sales & account health — ${day}`,
      metrics: {
        calls: between(80, 160),
        dealsClosed: between(3, 12),
        revenueBooked: between(9000, 32000),
        revenueCollected: between(6000, 24000),
        refundRequests: between(0, 2),
        accountsReviewed: between(4, 12),
        accountsAtRisk: between(0, 3),
      },
      highlights: d === 1 ? 'Peak Logistics escalated — chargeback threat logged.' : '',
      blockers: '',
      createdAt: `${day}T19:10:00`,
    });
    if (d !== 4) {
      reports.push({
        id: id('rep'),
        team: 'marketing',
        cadence: 'daily',
        periodStart: dayStart,
        author: 'Marketing – Ali',
        title: `Daily marketing report — ${day}`,
        metrics: {
          adSpend: between(1800, 2600),
          clicks: between(2500, 5200),
          leads: between(60, 140),
          conversions: between(10, 35),
          postsPublished: between(4, 12),
          organicViews: between(15000, 60000),
          deliverablesCompleted: between(0, 4),
        },
        highlights: '',
        blockers: d === 2 ? 'Nimbus articles still waiting on writer.' : '',
        createdAt: `${day}T18:40:00`,
      });
    }
  }

  return { reports, sales, paid, organic, retainers, deliverables, issues, accounts, payments, interactions };
}
