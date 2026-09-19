import { TERM_MONTHS, Term, Ticket } from './types';

const SETTLEMENT_TZ = 'America/New_York';

// ISO date strings (YYYY-MM-DD) are handled as UTC midnights so that local
// timezone and DST never shift the day.
export function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Today's calendar date in New York, which is what Treasury settlement uses.
export function todayInSettlementZone(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SETTLEMENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// Treasuries settle T+1. Weekends are skipped, exchange holidays are not modeled.
export function addBusinessDays(iso: string, days: number): string {
  const date = parseIso(iso);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return toIso(date);
}

// Jan 31 + 1 month = Feb 28 (or 29), not Mar 3.
export function addMonths(iso: string, months: number): string {
  const date = parseIso(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInTargetMonth));
  return toIso(date);
}

// Simple interest to maturity: amount * rate * years, done in integer cents.
export function estimateInterest(amount: number, ratePercent: number, termMonths: number): number {
  const cents = Math.round(amount * 100);
  const interestCents = Math.round((cents * ratePercent * termMonths) / (100 * 12));
  return interestCents / 100;
}

export function buildTicket(input: {
  term: Term;
  amount: number;
  rate: number;
  rateDate: string;
  now?: Date;
}): Ticket {
  const { term, amount, rate, rateDate, now = new Date() } = input;
  const settlementDate = addBusinessDays(todayInSettlementZone(now), 1);
  const termMonths = TERM_MONTHS[term];

  return {
    term,
    amount,
    rate,
    rateDate,
    settlementDate,
    maturityDate: addMonths(settlementDate, termMonths),
    estInterest: estimateInterest(amount, rate, termMonths),
  };
}
