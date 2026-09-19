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

export interface YieldPoint {
  term: Term;
  rate: number;
  prevRate: number | null;
  changeBp: number | null;
}

export interface YieldCurve {
  date: string;
  prevDate: string | null;
  points: YieldPoint[];
}

export interface Order {
  id: number;
  term: Term;
  amount: number;
  submitted_at: string;
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
