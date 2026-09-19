import { Router } from 'express';
import { pool } from '../db';
import { refreshYieldCurve } from '../treasury';
import { TERM_ORDER, YieldPoint } from '../types';

const router = Router();

// Treasury publishes the par yield curve once per business day and it
// doesn't change intraday, so a day-long TTL is enough to stay current.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedCurve {
  date: string;
  points: YieldPoint[];
  fetchedAt: string;
}

async function queryLatest(): Promise<CachedCurve | null> {
  const { rows } = await pool.query<{ date: string; term: string; rate: string; fetched_at: string }>(
    `SELECT date::text, term, rate, fetched_at FROM yield_curve_rates
     WHERE date = (SELECT MAX(date) FROM yield_curve_rates)`
  );

  if (rows.length === 0) {
    return null;
  }

  const rateByTerm = new Map(rows.map((row) => [row.term, parseFloat(row.rate)]));
  const points: YieldPoint[] = TERM_ORDER
    .filter((term) => rateByTerm.has(term))
    .map((term) => ({ term, rate: rateByTerm.get(term)! }));

  return { date: rows[0].date, points, fetchedAt: rows[0].fetched_at };
}

function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > CACHE_TTL_MS;
}

router.get('/', async (_req, res) => {
  const cached = await queryLatest();

  if (cached && !isStale(cached.fetchedAt)) {
    return res.json({ date: cached.date, points: cached.points });
  }

  try {
    await refreshYieldCurve();
  } catch (err) {
    if (cached) {
      console.error('refresh failed, serving stale cache', err);
      return res.json({ date: cached.date, points: cached.points });
    }
    console.error('refresh failed, no cached data available', err);
    return res.status(502).json({ error: 'failed to fetch treasury data' });
  }

  const refreshed = await queryLatest();
  if (!refreshed) {
    return res.status(502).json({ error: 'failed to fetch treasury data' });
  }
  res.json({ date: refreshed.date, points: refreshed.points });
});

export default router;
