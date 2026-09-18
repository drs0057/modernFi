import { Router } from 'express';
import { pool } from '../db';
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

  const { rows } = await pool.query(
    `INSERT INTO orders (term, amount) VALUES ($1, $2)
     RETURNING id, term, amount, submitted_at`,
    [term, amount]
  );

  res.status(201).json(rows[0]);
});

router.get('/', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, term, amount, submitted_at FROM orders ORDER BY submitted_at DESC`
  );
  res.json(rows);
});

export default router;
