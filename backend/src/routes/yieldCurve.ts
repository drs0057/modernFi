import { Router } from 'express';
import { pool } from '../db';
import { refreshYieldCurve } from '../treasury';
import { TERM_ORDER, YieldPoint } from '../types';

const router = Router();

router.post('/refresh', async (_req, res) => {
  try {
    const result = await refreshYieldCurve();
    res.json(result);
  } catch (err) {
    console.error('refresh failed', err);
    res.status(502).json({ error: 'failed to fetch treasury data' });
  }
});

router.get('/latest', async (_req, res) => {
  const { rows } = await pool.query<{ date: string; term: string; rate: string }>(
    `SELECT date::text, term, rate FROM yield_curve_rates
     WHERE date = (SELECT MAX(date) FROM yield_curve_rates)`
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'no yield curve data available' });
  }

  const rateByTerm = new Map(rows.map((row) => [row.term, parseFloat(row.rate)]));
  const points: YieldPoint[] = TERM_ORDER
    .filter((term) => rateByTerm.has(term))
    .map((term) => ({ term, rate: rateByTerm.get(term)! }));

  res.json({ date: rows[0].date, points });
});

export default router;
