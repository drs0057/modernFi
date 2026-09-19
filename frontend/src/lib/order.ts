import { Order, Ticket } from '../types';

// A stored order has no rate date, so it is optional for display.
export type TicketView = Omit<Ticket, 'rateDate'> & { rateDate?: string };

// Order numeric columns arrive as strings from Postgres NUMERIC.
export function orderToTicketView(order: Order): TicketView {
  return {
    term: order.term,
    amount: Number(order.amount),
    rate: Number(order.rate),
    settlementDate: order.settlement_date,
    maturityDate: order.maturity_date,
    estInterest: Number(order.est_interest),
  };
}
