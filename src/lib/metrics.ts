import { eachDay, inRange, type DateRange } from './dates';
import { div } from './format';
import type { OrganicEntry, PaidEntry, SalesEntry } from './types';

export function sum<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((s, r) => s + (f(r) || 0), 0);
}

export function groupSum<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + (value(r) || 0));
  return [...m.entries()].map(([name, v]) => ({ name, value: v })).sort((a, b) => b.value - a.value);
}

export const filterRange = <T extends { date: string }>(rows: T[], r: DateRange | null) => (r ? rows.filter((x) => inRange(x.date, r)) : []);

/** One row per day in range (zero-filled), with the given numeric fields summed. */
export function dailySeries<T extends { date: string }>(rows: T[], range: DateRange, fields: Record<string, (r: T) => number>) {
  let days: string[];
  if (range.from.startsWith('0000')) {
    const dates = rows.map((r) => r.date).sort();
    days = dates.length ? eachDay({ from: dates[0], to: dates[dates.length - 1] }) : [];
  } else days = eachDay(range);
  const idx = new Map(days.map((d, i) => [d, i]));
  const out = days.map((d) => {
    const row: Record<string, number | string> = { date: d };
    for (const k of Object.keys(fields)) row[k] = 0;
    return row;
  });
  for (const r of rows) {
    const i = idx.get(r.date.slice(0, 10));
    if (i === undefined) continue;
    for (const [k, f] of Object.entries(fields)) out[i][k] = (out[i][k] as number) + (f(r) || 0);
  }
  return out;
}

export function paidTotals(rows: PaidEntry[]) {
  const spend = sum(rows, (r) => r.spend);
  const impressions = sum(rows, (r) => r.impressions);
  const clicks = sum(rows, (r) => r.clicks);
  const leads = sum(rows, (r) => r.leads);
  const conversions = sum(rows, (r) => r.conversions);
  const revenue = sum(rows, (r) => r.revenue);
  return {
    spend,
    impressions,
    clicks,
    leads,
    conversions,
    revenue,
    ctr: div(clicks, impressions),
    cpc: div(spend, clicks),
    cpm: div(spend, impressions) * 1000,
    cpl: div(spend, leads),
    cpa: div(spend, conversions),
    roas: div(revenue, spend),
  };
}

export function organicTotals(rows: OrganicEntry[]) {
  const views = sum(rows, (r) => r.views);
  const engagements = sum(rows, (r) => r.likes + r.comments + r.shares + r.saves);
  return {
    posts: sum(rows, (r) => r.posts),
    views,
    reach: sum(rows, (r) => r.reach),
    likes: sum(rows, (r) => r.likes),
    comments: sum(rows, (r) => r.comments),
    shares: sum(rows, (r) => r.shares),
    saves: sum(rows, (r) => r.saves),
    clicks: sum(rows, (r) => r.clicks),
    followersGained: sum(rows, (r) => r.followersGained),
    engagements,
    engagementRate: div(engagements, views),
  };
}

export function salesTotals(rows: SalesEntry[]) {
  const calls = sum(rows, (r) => r.calls);
  const deals = sum(rows, (r) => r.dealsClosed);
  const leads = sum(rows, (r) => r.leads);
  const booked = sum(rows, (r) => r.revenueBooked);
  const collected = sum(rows, (r) => r.revenueCollected);
  return {
    leads,
    calls,
    deals,
    booked,
    collected,
    refunds: sum(rows, (r) => r.refunds),
    closeRate: div(deals, leads),
    avgDeal: div(booked, deals),
    collectionRate: div(collected, booked),
  };
}
