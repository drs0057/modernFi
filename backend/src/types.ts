import { Term } from './terms';

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
