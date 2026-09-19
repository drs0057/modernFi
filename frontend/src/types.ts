// Mirrors backend/src/types.ts and backend/src/terms.ts. Keep in sync.
export const TERM_ORDER = [
  '1mo', '2mo', '3mo', '4mo', '6mo',
  '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '20yr', '30yr',
] as const;

export type Term = typeof TERM_ORDER[number];

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

// What the bank sees before submitting, computed by the server.
export interface Ticket {
  term: Term;
  amount: number;
  rate: number;
  rateDate: string;
  settlementDate: string;
  maturityDate: string;
  estInterest: number;
}

// Numeric columns arrive as strings from Postgres NUMERIC.
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

export type OrderSortColumn = 'term' | 'amount' | 'maturity_date' | 'submitted_at';
export type SortDirection = 'asc' | 'desc';

export interface OrdersPage {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: OrderSortColumn;
  sortDir: SortDirection;
}
