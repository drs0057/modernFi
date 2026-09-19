import { Router } from 'express';
import { pool } from '../db';
import { submitToPaymentProcessor } from '../paymentProcessor';
import { TERM_ORDER } from '../types';

const router = Router();

router.post('/', async (req, res) => {
  const { term, amount } = req.body ?? {};

  if (!TERM_ORDER.includes(term)) {
    return res.status(400).json({ error: `term must be one of ${TERM_ORDER.join(', ')}` });
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  try {
    await submitToPaymentProcessor();
  } catch (err) {
    console.error('payment processor declined order', err);
    return res.status(502).json({ error: 'payment processor declined the order' });
  }

  const { rows } = await pool.query(
    `INSERT INTO orders (term, amount) VALUES ($1, $2)
     RETURNING id, term, amount, submitted_at`,
    [term, amount]
  );

  res.status(201).json(rows[0]);
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// Whitelisted so sortBy/sortDir can be interpolated straight into ORDER BY
// without ever passing raw query-string input into the SQL string.
const SORTABLE_COLUMNS = ['term', 'amount', 'submitted_at'] as const;
type SortColumn = typeof SORTABLE_COLUMNS[number];

function parseSortBy(value: unknown): SortColumn {
  return (SORTABLE_COLUMNS as readonly string[]).includes(String(value))
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
      `SELECT id, term, amount, submitted_at FROM orders
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
    pool.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM orders`),
  ]);

  res.json({ orders: rows, total: countRows[0].count, page, pageSize, sortBy, sortDir });
});

export default router;
