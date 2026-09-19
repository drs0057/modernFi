import { pool } from '../db';
import { TERM_ORDER } from '../terms';
import { Order, Ticket } from '../types';
import { OrderListQuery, OrderSortColumn } from './listQuery';

// settlement_date and maturity_date are cast to text so pg does not turn a
// DATE into a JS Date and shift it by the server's timezone.
const ORDER_COLUMNS = `id, idempotency_key, term, amount, rate,
  settlement_date::text AS settlement_date, maturity_date::text AS maturity_date,
  est_interest, submitted_at`;

// Terms sort by maturity length, not alphabetically ('10yr' < '1mo').
const TERM_RANK = `array_position(ARRAY[${TERM_ORDER.map((t) => `'${t}'`).join(', ')}], term)`;
const SORT_EXPRESSIONS: Record<OrderSortColumn, string> = {
  term: TERM_RANK,
  amount: 'amount',
  maturity_date: 'maturity_date',
  submitted_at: 'submitted_at',
};

export async function findOrderByKey(key: string): Promise<Order | null> {
  const { rows } = await pool.query<Order>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE idempotency_key = $1`,
    [key]
  );
  return rows[0] ?? null;
}

// Returns null when another request already stored this key.
export async function insertOrder(key: string, ticket: Ticket): Promise<Order | null> {
  const { rows } = await pool.query<Order>(
    `INSERT INTO orders (idempotency_key, term, amount, rate, settlement_date, maturity_date, est_interest)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${ORDER_COLUMNS}`,
    [key, ticket.term, ticket.amount, ticket.rate, ticket.settlementDate, ticket.maturityDate, ticket.estInterest]
  );
  return rows[0] ?? null;
}

export async function listOrders(
  { page, pageSize, sortBy, sortDir }: OrderListQuery
): Promise<{ orders: Order[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query<Order>(
      `SELECT ${ORDER_COLUMNS} FROM orders
       ORDER BY ${SORT_EXPRESSIONS[sortBy]} ${sortDir}, id DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
    pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM orders`),
  ]);
  return { orders: rows, total: countRows[0].count };
}
