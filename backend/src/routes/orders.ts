import { Router } from 'express';
import { pool } from '../db';
import { getCurrentCurve } from '../curveService';
import { submitToPaymentProcessor } from '../paymentProcessor';
import { buildTicket } from '../ticket';
import { Order, TERM_ORDER, Term, Ticket } from '../types';

const router = Router();

const MAX_AMOUNT = 1_000_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// settlement_date and maturity_date are cast to text so pg does not turn a
// DATE into a JS Date and shift it by the server's timezone.
const ORDER_COLUMNS = `id, idempotency_key, term, amount, rate,
  settlement_date::text AS settlement_date, maturity_date::text AS maturity_date,
  est_interest, submitted_at`;

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

interface OrderInput {
  term: Term;
  amount: number;
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

// Returns an error message, or null when the input is valid.
function validateOrderInput(term: unknown, amount: unknown): string | null {
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

async function buildTicketAtCurrentRate({ term, amount }: OrderInput): Promise<Ticket> {
  let curve;
  try {
    curve = await getCurrentCurve();
  } catch {
    throw new HttpError(502, 'failed to fetch treasury data');
  }

  const point = curve.points.find((p) => p.term === term);
  if (!point) {
    throw new HttpError(502, `no rate available for ${term}`);
  }
  return buildTicket({ term, amount, rate: point.rate, rateDate: curve.date });
}

router.get('/quote', async (req, res) => {
  const term = req.query.term;
  const amount = Number(req.query.amount);

  const invalid = validateOrderInput(term, amount);
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }

  try {
    res.json(await buildTicketAtCurrentRate({ term: term as Term, amount }));
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('quote failed', err);
    res.status(500).json({ error: 'failed to build quote' });
  }
});

interface PlacedOrder {
  order: Order;
  replayed: boolean;
}

// Requests currently talking to the payment processor, by idempotency key. A
// duplicate that arrives mid-flight waits for the first request's result
// instead of charging again. This only covers one process. The unique index
// on orders.idempotency_key covers several.
const inFlight = new Map<string, { input: OrderInput; result: Promise<PlacedOrder> }>();

function assertSameInput(order: Order, input: OrderInput): void {
  if (order.term !== input.term || Number(order.amount) !== input.amount) {
    throw new HttpError(422, 'Idempotency-Key was already used with a different order');
  }
}

async function findOrderByKey(key: string): Promise<Order | null> {
  const { rows } = await pool.query<Order>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE idempotency_key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

async function processOrder(key: string, input: OrderInput): Promise<PlacedOrder> {
  const existing = await findOrderByKey(key);
  if (existing) {
    assertSameInput(existing, input);
    return { order: existing, replayed: true };
  }

  const ticket = await buildTicketAtCurrentRate(input);

  try {
    await submitToPaymentProcessor(key);
  } catch (err) {
    console.error('payment processor declined order', err);
    throw new HttpError(502, 'payment processor declined the order');
  }

  // The row is written only after the processor accepts, so a decline leaves
  // nothing behind and the same key can be retried.
  const { rows } = await pool.query<Order>(
    `INSERT INTO orders (idempotency_key, term, amount, rate, settlement_date, maturity_date, est_interest)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${ORDER_COLUMNS}`,
    [key, ticket.term, ticket.amount, ticket.rate, ticket.settlementDate, ticket.maturityDate, ticket.estInterest]
  );
  if (rows[0]) {
    return { order: rows[0], replayed: false };
  }

  // Another process inserted this key first. Return its order.
  const winner = await findOrderByKey(key);
  if (!winner) {
    throw new Error('order vanished after idempotency conflict');
  }
  assertSameInput(winner, input);
  return { order: winner, replayed: true };
}

async function placeOrder(key: string, input: OrderInput): Promise<PlacedOrder> {
  const pending = inFlight.get(key);
  if (pending) {
    if (pending.input.term !== input.term || pending.input.amount !== input.amount) {
      throw new HttpError(422, 'Idempotency-Key was already used with a different order');
    }
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

router.post('/', async (req, res) => {
  const key = req.header('Idempotency-Key');
  if (!key || !UUID_PATTERN.test(key)) {
    return res.status(400).json({ error: 'Idempotency-Key header must be a UUID' });
  }

  const { term, amount } = req.body ?? {};
  const invalid = validateOrderInput(term, amount);
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }

  try {
    const { order, replayed } = await placeOrder(key, { term, amount });
    if (replayed) {
      res.set('Idempotent-Replayed', 'true');
    }
    res.status(replayed ? 200 : 201).json(order);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('order failed', err);
    res.status(500).json({ error: 'failed to place order' });
  }
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// Whitelisted so sortBy/sortDir can be interpolated straight into ORDER BY
// without ever passing raw query-string input into the SQL string.
// Terms sort by maturity length, not alphabetically ('10yr' < '1mo').
const TERM_RANK = `array_position(ARRAY[${TERM_ORDER.map((t) => `'${t}'`).join(', ')}], term)`;
const SORT_EXPRESSIONS = {
  term: TERM_RANK,
  amount: 'amount',
  maturity_date: 'maturity_date',
  submitted_at: 'submitted_at',
} as const;
type SortColumn = keyof typeof SORT_EXPRESSIONS;

function parseSortBy(value: unknown): SortColumn {
  return Object.prototype.hasOwnProperty.call(SORT_EXPRESSIONS, String(value))
    ? (value as SortColumn)
    : 'submitted_at';
}

function parseSortDir(value: unknown): 'asc' | 'desc' {
  return value === 'asc' ? 'asc' : 'desc';
}

router.get('/', async (req, res) => {
  const pageParam = parseInt(String(req.query.page ?? '1'), 10);
  const pageSizeParam = parseInt(String(req.query.pageSize ?? DEFAULT_PAGE_SIZE), 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0
      ? Math.min(pageSizeParam, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const sortBy = parseSortBy(req.query.sortBy);
  const sortDir = parseSortDir(req.query.sortDir);

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT ${ORDER_COLUMNS} FROM orders
       ORDER BY ${SORT_EXPRESSIONS[sortBy]} ${sortDir}, id DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
    pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM orders`),
  ]);

  res.json({ orders: rows, total: countRows[0].count, page, pageSize, sortBy, sortDir });
});

export default router;
