// Core data model. Every collection maps 1:1 to a table in supabase/migrations.

export type Role = 'coo' | 'compliance' | 'marketing' | 'viewer';
export type Team = 'compliance' | 'marketing' | 'operations';
export type Cadence = 'hourly' | 'daily';

export interface Report {
  id: string;
  team: Team;
  cadence: Cadence;
  /** ISO timestamp of the start of the hour (hourly) or the day (daily) this report covers. */
  periodStart: string;
  author: string;
  title: string;
  metrics: Record<string, number>;
  highlights: string;
  blockers: string;
  createdAt: string;
}

export interface SalesEntry {
  id: string;
  date: string; // YYYY-MM-DD
  brand: string;
  rep: string;
  leads: number;
  calls: number;
  dealsClosed: number;
  revenueBooked: number;
  revenueCollected: number;
  refunds: number;
  notes: string;
}

export interface PaidEntry {
  id: string;
  date: string;
  /** Our internal brand that the spend belongs to. */
  brand: string;
  /** The customer's brand the campaign runs for (use the same value as brand for in-house campaigns). */
  clientBrand: string;
  channel: string; // Meta, Google, TikTok, LinkedIn…
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  conversions: number;
  revenue: number;
}

export interface OrganicEntry {
  id: string;
  date: string;
  brand: string;
  platform: string; // Instagram, TikTok, YouTube, LinkedIn, Website…
  posts: number;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  followersGained: number;
}

export type RetainerStatus = 'onboarding' | 'active' | 'paused' | 'ended';

export interface RetainerKpi {
  name: string;
  target: number;
  actual: number;
}

export interface Retainer {
  id: string;
  client: string;
  brand: string;
  owner: string;
  services: string[];
  monthlyFee: number;
  startDate: string;
  renewalDate: string;
  status: RetainerStatus;
  reportingCadence: string;
  kpis: RetainerKpi[];
  notes: string;
}

export type DeliverableStatus = 'not-started' | 'in-progress' | 'in-review' | 'delivered' | 'blocked';

export interface Deliverable {
  id: string;
  retainerId: string;
  title: string;
  type: string;
  dueDate: string;
  deliveredDate: string | null;
  status: DeliverableStatus;
  progress: number; // 0-100
  /** 1-5 quality rating given at review. null until reviewed. */
  qualityScore: number | null;
  plannedQty: number;
  deliveredQty: number;
}

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface RetainerIssue {
  id: string;
  retainerId: string;
  title: string;
  severity: Severity;
  status: 'open' | 'resolved';
  owner: string;
  raisedAt: string;
  resolvedAt: string | null;
  details: string;
}

export type AccountStatus = 'onboarding' | 'active' | 'paused' | 'closed';

export interface Account {
  id: string;
  name: string;
  brand: string;
  salesRep: string;
  accountManager: string;
  projectManager: string;
  status: AccountStatus;
  packageName: string;
  contractValue: number;
  startDate: string;
  paymentCycle: 'one-time' | 'monthly' | 'milestone' | 'quarterly';
  /** Compliance's 1-5 rating of how the account/project is performing. */
  performanceRating: number;
  performanceNotes: string;
}

export interface Payment {
  id: string;
  accountId: string;
  dueDate: string;
  amount: number;
  paidDate: string | null;
  paidAmount: number;
  note: string;
}

export type InteractionChannel = 'chat' | 'call' | 'video-meeting' | 'email';
export type InteractionTeam = 'sales' | 'account-management' | 'project-management' | 'compliance';
export type RiskFlag =
  | 'refund-request'
  | 'chargeback-threat'
  | 'legal-threat'
  | 'cancellation'
  | 'payment-dispute'
  | 'complaint';

export interface Interaction {
  id: string;
  accountId: string;
  date: string; // ISO timestamp
  channel: InteractionChannel;
  team: InteractionTeam;
  direction: 'inbound' | 'outbound';
  summary: string;
  transcript: string;
  recordingUrl: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  flags: RiskFlag[];
  loggedBy: string;
}

export interface Collections {
  reports: Report;
  sales: SalesEntry;
  paid: PaidEntry;
  organic: OrganicEntry;
  retainers: Retainer;
  deliverables: Deliverable;
  issues: RetainerIssue;
  accounts: Account;
  payments: Payment;
  interactions: Interaction;
}

export type CollectionName = keyof Collections;

export type DataSet = { [K in CollectionName]: Collections[K][] };
