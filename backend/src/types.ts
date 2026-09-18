export const TERM_ORDER = [
  '1mo', '2mo', '3mo', '4mo', '6mo',
  '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '20yr', '30yr',
] as const;

export type Term = typeof TERM_ORDER[number];

export interface YieldPoint {
  term: Term;
  rate: number;
}

export interface Order {
  id: number;
  term: Term;
  amount: number;
  submitted_at: string;
}
