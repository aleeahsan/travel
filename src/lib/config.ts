import type { Cadence, Role, Team } from './types';

// Company-level settings. Edit these to match how your teams actually work.

export const COMPANY_NAME = 'Ops Hub';
export const CURRENCY = 'USD';

/** Working hours used to check whether every hourly report has come in (24h clock, local time). */
export const WORK_HOURS = { start: 9, end: 18 };

export const ROLE_LABELS: Record<Role, string> = {
  coo: 'COO / Admin',
  compliance: 'Compliance team',
  marketing: 'Marketing team',
  viewer: 'Viewer (CEO, leadership)',
};

export const TEAM_LABELS: Record<Team, string> = {
  compliance: 'Compliance',
  marketing: 'Marketing',
  operations: 'Operations',
};

/** Which teams each role may submit reports for. */
export const ROLE_TEAMS: Record<Role, Team[]> = {
  coo: ['compliance', 'marketing', 'operations'],
  compliance: ['compliance'],
  marketing: ['marketing'],
  viewer: [],
};

export interface MetricField {
  key: string;
  label: string;
  money?: boolean;
}

/**
 * Report templates: the fields a team fills in for each hourly / daily report.
 * Add, remove or rename fields here; old reports keep whatever they were saved with.
 */
export const REPORT_TEMPLATES: Record<Team, Record<Cadence, MetricField[]>> = {
  compliance: {
    hourly: [
      { key: 'calls', label: 'Sales calls made' },
      { key: 'dealsClosed', label: 'Deals closed' },
      { key: 'revenueBooked', label: 'Revenue booked', money: true },
      { key: 'revenueCollected', label: 'Revenue collected', money: true },
      { key: 'refundRequests', label: 'Refund requests' },
    ],
    daily: [
      { key: 'calls', label: 'Sales calls made' },
      { key: 'dealsClosed', label: 'Deals closed' },
      { key: 'revenueBooked', label: 'Revenue booked', money: true },
      { key: 'revenueCollected', label: 'Revenue collected', money: true },
      { key: 'refundRequests', label: 'Refund requests' },
      { key: 'accountsReviewed', label: 'Accounts reviewed' },
      { key: 'accountsAtRisk', label: 'Accounts flagged at risk' },
    ],
  },
  marketing: {
    hourly: [
      { key: 'adSpend', label: 'Ad spend', money: true },
      { key: 'clicks', label: 'Clicks' },
      { key: 'leads', label: 'Leads' },
    ],
    daily: [
      { key: 'adSpend', label: 'Ad spend', money: true },
      { key: 'clicks', label: 'Clicks' },
      { key: 'leads', label: 'Leads' },
      { key: 'conversions', label: 'Conversions' },
      { key: 'postsPublished', label: 'Organic posts published' },
      { key: 'organicViews', label: 'Organic views' },
      { key: 'deliverablesCompleted', label: 'Retainer deliverables completed' },
    ],
  },
  operations: {
    hourly: [{ key: 'ticketsResolved', label: 'Tickets resolved' }],
    daily: [
      { key: 'ticketsResolved', label: 'Tickets resolved' },
      { key: 'escalations', label: 'Escalations' },
    ],
  },
};

export const CHANNELS = ['Meta', 'Google', 'TikTok', 'LinkedIn', 'YouTube', 'Snapchat'];
export const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'X', 'Website / Blog'];

/** Hour slots (e.g. 9 = 9:00–10:00) in the working day that have fully ended by `now`. */
export function completedWorkHours(now = new Date()): number[] {
  const out: number[] = [];
  for (let h = WORK_HOURS.start; h < WORK_HOURS.end; h++) if (h < now.getHours()) out.push(h);
  return out;
}

/** All hour slots in the working day. */
export const ALL_WORK_HOURS = Array.from({ length: WORK_HOURS.end - WORK_HOURS.start }, (_, i) => WORK_HOURS.start + i);
