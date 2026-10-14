import { describe, expect, it } from 'vitest';
import { accountHealth, responsiveness, retainerHealth, retainerStats, summarizePayments } from './health';
import type { Account, Deliverable, Interaction, Payment, Retainer, RetainerIssue } from './types';

const TODAY = '2026-10-14';

const account: Account = {
  id: 'a1', name: 'Acme', brand: 'B', salesRep: '', accountManager: '', projectManager: '', status: 'active',
  packageName: '', contractValue: 10000, startDate: '2026-08-01', paymentCycle: 'monthly', performanceRating: 3, performanceNotes: '',
};
const pay = (dueDate: string, amount: number, paidDate: string | null, paidAmount = paidDate ? amount : 0): Payment => ({
  id: dueDate, accountId: 'a1', dueDate, amount, paidDate, paidAmount, note: '',
});
const it_ = (date: string, over: Partial<Interaction> = {}): Interaction => ({
  id: date, accountId: 'a1', date: `${date}T10:00:00`, channel: 'call', team: 'account-management', direction: 'inbound',
  summary: '', transcript: '', recordingUrl: '', sentiment: 'neutral', flags: [], loggedBy: '', ...over,
});

describe('payments', () => {
  it('computes paid, remaining, last payment and overdue', () => {
    const s = summarizePayments(account, [pay('2026-08-01', 4000, '2026-08-02'), pay('2026-09-01', 3000, '2026-09-20', 1000), pay('2026-11-01', 3000, null)], TODAY);
    expect(s.totalPaid).toBe(5000);
    expect(s.remaining).toBe(5000);
    expect(s.lastPaymentDate).toBe('2026-09-20');
    expect(s.overdue.map((p) => p.dueDate)).toEqual(['2026-09-01']);
    expect(s.overdueAmount).toBe(2000);
    expect(s.nextDue?.dueDate).toBe('2026-11-01');
  });
});

describe('account health', () => {
  it('is 100 for a responsive, paid-up account with no flags', () => {
    const h = accountHealth(account, [pay('2026-10-01', 1000, '2026-10-01')], [it_('2026-10-13')], TODAY);
    expect(h.score).toBe(100);
    expect(h.band).toBe('healthy');
  });

  it('penalises chargeback threats, overdue payments and silence, and explains why', () => {
    const h = accountHealth(
      account,
      [pay('2026-09-01', 1000, null)],
      [it_('2026-09-20', { flags: ['chargeback-threat'], sentiment: 'negative' })],
      TODAY,
    );
    // -15 overdue, -30 chargeback, -20 unresponsive (24 days), -5 negative sentiment
    expect(h.score).toBe(30);
    expect(h.band).toBe('at-risk');
    expect(h.reasons.map((r) => r.points).sort((a, b) => a - b)).toEqual([-30, -20, -15, -5]);
  });

  it('ignores risk statements older than the window', () => {
    const h = accountHealth(account, [], [it_('2026-08-01', { flags: ['refund-request'] }), it_('2026-10-13')], TODAY);
    expect(h.reasons.some((r) => r.label.includes('Refund'))).toBe(false);
  });

  it('caps the risk-statement penalty at 50', () => {
    const h = accountHealth(account, [], [it_('2026-10-13', { flags: ['chargeback-threat', 'legal-threat', 'refund-request'] })], TODAY);
    expect(h.score).toBe(50);
  });

  it('classifies responsiveness from the last inbound contact', () => {
    expect(responsiveness('a1', [it_('2026-10-12')], TODAY).level).toBe('responsive');
    expect(responsiveness('a1', [it_('2026-10-06')], TODAY).level).toBe('slow');
    expect(responsiveness('a1', [it_('2026-09-01')], TODAY).level).toBe('unresponsive');
    expect(responsiveness('a1', [it_('2026-10-13', { direction: 'outbound' })], TODAY).level).toBe('no-contact');
  });
});

describe('retainer health', () => {
  const retainer = { id: 'r1' } as Retainer;
  const dl = (over: Partial<Deliverable>): Deliverable => ({
    id: Math.random().toString(), retainerId: 'r1', title: '', type: '', dueDate: '2026-10-10', deliveredDate: null,
    status: 'in-progress', progress: 50, qualityScore: null, plannedQty: 1, deliveredQty: 0, ...over,
  });

  it('is on track when everything lands on time', () => {
    const s = retainerStats(retainer, [dl({ status: 'delivered', deliveredDate: '2026-10-09', qualityScore: 5, deliveredQty: 1 }), dl({ dueDate: '2026-10-20' })], [], TODAY);
    expect(s.onTimeRate).toBe(1);
    const h = retainerHealth(s);
    expect(h.score).toBe(100);
    expect(h.track).toBe('on-track');
  });

  it('flags past-due work and severe issues', () => {
    const issues: RetainerIssue[] = [{ id: 'i', retainerId: 'r1', title: '', severity: 'critical', status: 'open', owner: '', raisedAt: TODAY, resolvedAt: null, details: '' }];
    const s = retainerStats(retainer, [dl({ dueDate: '2026-10-01' }), dl({ status: 'delivered', dueDate: '2026-10-01', deliveredDate: '2026-10-05', deliveredQty: 1 })], issues, TODAY);
    expect(s.overdueOpen).toHaveLength(1);
    expect(s.late).toBe(1);
    expect(s.onTimeRate).toBe(0);
    const h = retainerHealth(s);
    // -40 on-time, -8 past due, -20 critical issue
    expect(h.score).toBe(32);
    expect(h.track).toBe('off-track');
  });
});
