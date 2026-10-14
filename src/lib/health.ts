// Health scoring for accounts and marketing retainers.
//
// Both scores start at 100 and lose points for specific, listed reasons, so anyone
// looking at a score can see exactly why it is what it is. The weights below are a
// starting point — tune them to match how your compliance and marketing leads judge risk.

import { daysBetween, todayKey } from './dates';
import type {
  Account,
  Deliverable,
  Interaction,
  Payment,
  Retainer,
  RetainerIssue,
  RiskFlag,
  Severity,
} from './types';

export type HealthBand = 'healthy' | 'watch' | 'at-risk';

export interface HealthReason {
  label: string;
  points: number; // negative = penalty, positive = bonus
}

export interface HealthResult {
  score: number;
  band: HealthBand;
  reasons: HealthReason[];
}

export const bandFor = (score: number): HealthBand => (score >= 75 ? 'healthy' : score >= 50 ? 'watch' : 'at-risk');

export const BAND_LABELS: Record<HealthBand, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  'at-risk': 'At risk',
};

function finish(reasons: HealthReason[]): HealthResult {
  const score = Math.max(0, Math.min(100, Math.round(100 + reasons.reduce((s, r) => s + r.points, 0))));
  return { score, band: bandFor(score), reasons: reasons.filter((r) => r.points !== 0) };
}

// ---------------------------------------------------------------- Accounts

export const FLAG_LABELS: Record<RiskFlag, string> = {
  'refund-request': 'Refund request',
  'chargeback-threat': 'Chargeback threat',
  'legal-threat': 'Legal threat',
  cancellation: 'Cancellation intent',
  'payment-dispute': 'Payment dispute',
  complaint: 'Complaint',
};

export const FLAG_PENALTY: Record<RiskFlag, number> = {
  'chargeback-threat': 30,
  'legal-threat': 30,
  'refund-request': 20,
  cancellation: 20,
  'payment-dispute': 15,
  complaint: 10,
};

/** Look-back window for risk statements and sentiment. */
export const RISK_WINDOW_DAYS = 30;

export interface PaymentSummary {
  contractValue: number;
  totalPaid: number;
  remaining: number;
  lastPaymentDate: string | null;
  nextDue: Payment | null;
  overdue: Payment[];
  overdueAmount: number;
}

export function summarizePayments(account: Account, payments: Payment[], today = todayKey()): PaymentSummary {
  const mine = payments.filter((p) => p.accountId === account.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const totalPaid = mine.reduce((s, p) => s + (p.paidAmount || 0), 0);
  const paidDates = mine.map((p) => p.paidDate).filter((d): d is string => !!d).sort();
  const unpaid = mine.filter((p) => (p.paidAmount || 0) < p.amount);
  const overdue = unpaid.filter((p) => p.dueDate < today);
  return {
    contractValue: account.contractValue,
    totalPaid,
    remaining: Math.max(0, account.contractValue - totalPaid),
    lastPaymentDate: paidDates.length ? paidDates[paidDates.length - 1] : null,
    nextDue: unpaid.find((p) => p.dueDate >= today) ?? null,
    overdue,
    overdueAmount: overdue.reduce((s, p) => s + p.amount - (p.paidAmount || 0), 0),
  };
}

export type Responsiveness = 'responsive' | 'slow' | 'unresponsive' | 'no-contact';

export const RESPONSIVENESS_LABELS: Record<Responsiveness, string> = {
  responsive: 'Responsive',
  slow: 'Slow to respond',
  unresponsive: 'Unresponsive',
  'no-contact': 'No client contact logged',
};

/** Based on days since the client last reached out / replied (an inbound interaction). */
export function responsiveness(accountId: string, interactions: Interaction[], today = todayKey()) {
  const inbound = interactions
    .filter((i) => i.accountId === accountId && i.direction === 'inbound')
    .map((i) => i.date)
    .sort();
  const last = inbound.length ? inbound[inbound.length - 1] : null;
  const days = last ? daysBetween(last, today) : null;
  const level: Responsiveness = days === null ? 'no-contact' : days <= 3 ? 'responsive' : days <= 10 ? 'slow' : 'unresponsive';
  return { lastInbound: last, daysSince: days, level };
}

export function recentFlags(accountId: string, interactions: Interaction[], today = todayKey()) {
  const flags = new Map<RiskFlag, Interaction[]>();
  for (const i of interactions) {
    if (i.accountId !== accountId || daysBetween(i.date, today) > RISK_WINDOW_DAYS) continue;
    for (const f of i.flags) flags.set(f, [...(flags.get(f) ?? []), i]);
  }
  return flags;
}

export function accountHealth(
  account: Account,
  payments: Payment[],
  interactions: Interaction[],
  today = todayKey(),
): HealthResult {
  const reasons: HealthReason[] = [];

  const pay = summarizePayments(account, payments, today);
  if (pay.overdue.length) {
    const worst = Math.max(...pay.overdue.map((p) => daysBetween(p.dueDate, today)));
    reasons.push({
      label: `${pay.overdue.length} overdue payment${pay.overdue.length > 1 ? 's' : ''} (oldest ${worst} days late)`,
      points: -Math.min(30, 15 * pay.overdue.length),
    });
  }

  let flagPenalty = 0;
  for (const [flag, hits] of recentFlags(account.id, interactions, today)) {
    const p = FLAG_PENALTY[flag];
    flagPenalty += p;
    reasons.push({ label: `${FLAG_LABELS[flag]} in last ${RISK_WINDOW_DAYS} days (${hits.length}×)`, points: -p });
  }
  // Cap the total from risk statements so one bad week doesn't swamp every other signal.
  if (flagPenalty > 50) reasons.push({ label: 'Risk-statement penalty capped at 50', points: flagPenalty - 50 });

  const resp = responsiveness(account.id, interactions, today);
  if (resp.level === 'unresponsive') reasons.push({ label: `No client response in ${resp.daysSince} days`, points: -20 });
  else if (resp.level === 'slow') reasons.push({ label: `Client last responded ${resp.daysSince} days ago`, points: -10 });
  else if (resp.level === 'no-contact') reasons.push({ label: 'No client response logged yet', points: -10 });

  const recent = interactions
    .filter((i) => i.accountId === account.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const negatives = recent.filter((i) => i.sentiment === 'negative').length;
  if (negatives) reasons.push({ label: `${negatives} of last ${recent.length} interactions negative`, points: -5 * negatives });

  const perf = (account.performanceRating - 3) * 5;
  if (perf) reasons.push({ label: `Performance rated ${account.performanceRating}/5`, points: perf });

  return finish(reasons);
}

// ---------------------------------------------------------------- Retainers

export type TrackStatus = 'on-track' | 'at-risk' | 'off-track';

export const TRACK_LABELS: Record<TrackStatus, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'off-track': 'Off track',
};

export const ISSUE_PENALTY: Record<Severity, number> = { critical: 20, high: 10, medium: 4, low: 1 };

export interface RetainerStats {
  total: number;
  delivered: number;
  onTime: number;
  late: number;
  overdueOpen: Deliverable[];
  dueSoon: Deliverable[];
  blocked: number;
  /** Share of due-or-delivered deliverables that landed on or before their due date. */
  onTimeRate: number;
  avgQuality: number | null;
  plannedQty: number;
  deliveredQty: number;
  avgProgress: number;
  openIssues: RetainerIssue[];
}

export function retainerStats(
  retainer: Retainer,
  deliverables: Deliverable[],
  issues: RetainerIssue[],
  today = todayKey(),
): RetainerStats {
  const ds = deliverables.filter((d) => d.retainerId === retainer.id);
  const delivered = ds.filter((d) => d.status === 'delivered');
  const onTime = delivered.filter((d) => d.deliveredDate && d.deliveredDate <= d.dueDate).length;
  const overdueOpen = ds.filter((d) => d.status !== 'delivered' && d.dueDate < today);
  const late = delivered.length - onTime;
  const measured = delivered.length + overdueOpen.length;
  const rated = ds.filter((d) => d.qualityScore != null);
  return {
    total: ds.length,
    delivered: delivered.length,
    onTime,
    late,
    overdueOpen,
    dueSoon: ds.filter((d) => d.status !== 'delivered' && d.dueDate >= today && daysBetween(today, d.dueDate) <= 3),
    blocked: ds.filter((d) => d.status === 'blocked').length,
    onTimeRate: measured ? onTime / measured : 1,
    avgQuality: rated.length ? rated.reduce((s, d) => s + (d.qualityScore ?? 0), 0) / rated.length : null,
    plannedQty: ds.reduce((s, d) => s + d.plannedQty, 0),
    deliveredQty: ds.reduce((s, d) => s + d.deliveredQty, 0),
    avgProgress: ds.length ? ds.reduce((s, d) => s + d.progress, 0) / ds.length : 0,
    openIssues: issues.filter((i) => i.retainerId === retainer.id && i.status === 'open'),
  };
}

export function retainerHealth(stats: RetainerStats): HealthResult & { track: TrackStatus } {
  const reasons: HealthReason[] = [];
  if (stats.onTimeRate < 1)
    reasons.push({ label: `On-time delivery ${Math.round(stats.onTimeRate * 100)}%`, points: -Math.round((1 - stats.onTimeRate) * 40) });
  if (stats.overdueOpen.length)
    reasons.push({
      label: `${stats.overdueOpen.length} deliverable${stats.overdueOpen.length > 1 ? 's' : ''} past due`,
      points: -Math.min(30, stats.overdueOpen.length * 8),
    });
  if (stats.blocked) reasons.push({ label: `${stats.blocked} deliverable(s) blocked`, points: -5 * stats.blocked });
  for (const sev of ['critical', 'high', 'medium', 'low'] as Severity[]) {
    const n = stats.openIssues.filter((i) => i.severity === sev).length;
    if (n) reasons.push({ label: `${n} open ${sev} issue${n > 1 ? 's' : ''}`, points: -ISSUE_PENALTY[sev] * n });
  }
  if (stats.avgQuality != null && stats.avgQuality < 4)
    reasons.push({ label: `Average quality ${stats.avgQuality.toFixed(1)}/5`, points: -Math.round((4 - stats.avgQuality) * 10) });
  if (stats.plannedQty && stats.deliveredQty / stats.plannedQty < 0.5 && stats.overdueOpen.length)
    reasons.push({ label: `Only ${stats.deliveredQty}/${stats.plannedQty} units delivered`, points: -5 });

  const result = finish(reasons);
  const hasSevere = stats.openIssues.some((i) => i.severity === 'critical' || i.severity === 'high');
  const track: TrackStatus =
    result.band === 'at-risk' || stats.overdueOpen.length >= 3
      ? 'off-track'
      : result.band === 'watch' || stats.overdueOpen.length > 0 || hasSevere
        ? 'at-risk'
        : 'on-track';
  return { ...result, track };
}
