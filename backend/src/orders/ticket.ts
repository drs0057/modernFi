import { addBusinessDays, addMonths, todayInSettlementZone } from '../lib/dates';
import { TERM_MONTHS, Term } from '../terms';
import { Ticket } from '../types';

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
