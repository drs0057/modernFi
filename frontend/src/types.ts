export const TERM_ORDER = [
  '1mo', '2mo', '3mo', '4mo', '6mo',
  '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '20yr', '30yr',
] as const;

export type Term = typeof TERM_ORDER[number];

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

export type OrderSortColumn = 'term' | 'amount' | 'submitted_at';
export type SortDirection = 'asc' | 'desc';

export interface OrdersPage {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: OrderSortColumn;
  sortDir: SortDirection;
}
