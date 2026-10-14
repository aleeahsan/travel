import { useMemo } from 'react';
import { accountHealth, recentFlags, responsiveness, retainerHealth, retainerStats, summarizePayments } from './health';
import { useData } from './store';

/** Accounts with their computed health, payment summary, responsiveness and recent risk flags. */
export function useAccountRows() {
  const { data } = useData();
  return useMemo(
    () =>
      data.accounts.map((a) => ({
        account: a,
        health: accountHealth(a, data.payments, data.interactions),
        pay: summarizePayments(a, data.payments),
        resp: responsiveness(a.id, data.interactions),
        flags: [...recentFlags(a.id, data.interactions).keys()],
      })),
    [data.accounts, data.payments, data.interactions],
  );
}

export type AccountRow = ReturnType<typeof useAccountRows>[number];

export function useRetainerRows() {
  const { data } = useData();
  return useMemo(
    () =>
      data.retainers.map((r) => {
        const stats = retainerStats(r, data.deliverables, data.issues);
        return { retainer: r, stats, health: retainerHealth(stats) };
      }),
    [data.retainers, data.deliverables, data.issues],
  );
}

export type RetainerRow = ReturnType<typeof useRetainerRows>[number];
