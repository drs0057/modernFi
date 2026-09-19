import { HttpError } from '../errors';
import { getCurrentCurve } from '../yieldCurve/curveService';
import { Order, Ticket } from '../types';
import { findOrderByKey, insertOrder } from './orderRepository';
import { submitToPaymentProcessor } from './paymentProcessor';
import { buildTicket } from './ticket';
import { OrderInput } from './validation';

export interface PlacedOrder {
  order: Order;
  replayed: boolean;
}

// Prices the order at the current cached yield. The client never sends a rate.
export async function quoteOrder({ term, amount }: OrderInput): Promise<Ticket> {
  const curve = await getCurrentCurve();
  const point = curve.points.find((p) => p.term === term);
  if (!point) {
    throw new HttpError(502, `no rate available for ${term}`);
  }
  return buildTicket({ term, amount, rate: point.rate, rateDate: curve.date });
}

// Requests currently talking to the payment processor, by idempotency key. A
// duplicate that arrives mid-flight waits for the first request's result
// instead of charging again. This only covers one process. The unique index
// on orders.idempotency_key covers several, but only for the stored row: two
// processes can still both call the processor before either inserts. A real
// processor dedupes on the key we pass it.
const inFlight = new Map<string, { input: OrderInput; result: Promise<PlacedOrder> }>();

// Accepts a stored order (amount is a NUMERIC string) or a request input.
function assertSameInput(
  existing: { term: string; amount: string | number },
  input: OrderInput
): void {
  if (existing.term !== input.term || Number(existing.amount) !== input.amount) {
    throw new HttpError(422, 'Idempotency-Key was already used with a different order');
  }
}

async function processOrder(key: string, input: OrderInput): Promise<PlacedOrder> {
  const existing = await findOrderByKey(key);
  if (existing) {
    assertSameInput(existing, input);
    return { order: existing, replayed: true };
  }

  const ticket = await quoteOrder(input);

  try {
    await submitToPaymentProcessor(key);
  } catch (err) {
    console.error('payment processor declined order', err);
    throw new HttpError(502, 'payment processor declined the order');
  }

  // The row is written only after the processor accepts, so a decline leaves
  // nothing behind and the same key can be retried.
  const inserted = await insertOrder(key, ticket);
  if (inserted) {
    return { order: inserted, replayed: false };
  }

  // Another process inserted this key first. Return its order.
  const winner = await findOrderByKey(key);
  if (!winner) {
    throw new Error('order vanished after idempotency conflict');
  }
  assertSameInput(winner, input);
  return { order: winner, replayed: true };
}

export async function placeOrder(key: string, input: OrderInput): Promise<PlacedOrder> {
  const pending = inFlight.get(key);
  if (pending) {
    assertSameInput(pending.input, input);
    const { order } = await pending.result;
    return { order, replayed: true };
  }

  const result = processOrder(key, input);
  inFlight.set(key, { input, result });
  try {
    return await result;
  } finally {
    inFlight.delete(key);
  }
}
