import { TERM_ORDER, Term } from '../terms';

export interface OrderInput {
  term: Term;
  amount: number;
}

const MAX_AMOUNT = 1_000_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && UUID_PATTERN.test(key);
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

// Returns an error message, or null when the input is valid.
export function validateOrderInput(term: unknown, amount: unknown): string | null {
  if (!TERM_ORDER.includes(term as Term)) {
    return `term must be one of ${TERM_ORDER.join(', ')}`;
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'amount must be a positive number';
  }
  if (amount > MAX_AMOUNT) {
    return `amount must be at most ${MAX_AMOUNT}`;
  }
  if (!hasAtMostTwoDecimals(amount)) {
    return 'amount must have at most 2 decimal places';
  }
  return null;
}
