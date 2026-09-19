export const TERM_ORDER = [
  '1mo', '2mo', '3mo', '4mo', '6mo',
  '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '20yr', '30yr',
] as const;

export type Term = typeof TERM_ORDER[number];

export const TERM_MONTHS: Record<Term, number> = {
  '1mo': 1,
  '2mo': 2,
  '3mo': 3,
  '4mo': 4,
  '6mo': 6,
  '1yr': 12,
  '2yr': 24,
  '3yr': 36,
  '5yr': 60,
  '7yr': 84,
  '10yr': 120,
  '20yr': 240,
  '30yr': 360,
};

// Change in basis points vs 1 day, 1 month and 1 year earlier. Null when
// there is no comparison date close enough.
export interface YieldChanges {
  d1: number | null;
  m1: number | null;
  y1: number | null;
}

export interface YieldPoint {
  term: Term;
  rate: number;
  changes: YieldChanges;
}

export interface YieldCurve {
  date: string;
  compareDates: { d1: string | null; m1: string | null; y1: string | null };
  points: YieldPoint[];
}

export interface Ticket {
  term: Term;
  amount: number;
  rate: number;
  rateDate: string;
  settlementDate: string;
  maturityDate: string;
  estInterest: number;
}

export interface Order {
  id: number;
  idempotency_key: string;
  term: Term;
  amount: string;
  rate: string;
  settlement_date: string;
  maturity_date: string;
  est_interest: string;
  submitted_at: string;
}
