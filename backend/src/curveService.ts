import { pool } from './db';
import { refreshYieldCurve } from './treasury';
import { TERM_ORDER, YieldCurve, YieldPoint } from './types';

// Treasury publishes the par yield curve once per business day and it
// doesn't change intraday, so a day-long TTL is enough to stay current.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedCurve {
  curve: YieldCurve;
  fetchedAt: string;
}

interface CurveRow {
  date: string;
  term: string;
  rate: string;
  fetched_at: string;
}

function toRateMap(rows: CurveRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.term, parseFloat(row.rate)]));
}

// Rounded to whole basis points. 0.03 percentage points = 3 bp.
function changeInBp(rate: number, prevRate: number | null): number | null {
  return prevRate === null ? null : Math.round((rate - prevRate) * 100);
}

async function queryLatest(): Promise<CachedCurve | null> {
  const { rows } = await pool.query<CurveRow>(
    `SELECT date::text, term, rate, fetched_at FROM yield_curve_rates
     WHERE date IN (SELECT DISTINCT date FROM yield_curve_rates ORDER BY date DESC LIMIT 2)`
  );

  if (rows.length === 0) {
    return null;
  }

  const dates = [...new Set(rows.map((row) => row.date))].sort().reverse();
  const [date, prevDate = null] = dates;
  const latestRows = rows.filter((row) => row.date === date);
  const latest = toRateMap(latestRows);
  const previous = toRateMap(rows.filter((row) => row.date === prevDate));

  const points: YieldPoint[] = TERM_ORDER
    .filter((term) => latest.has(term))
    .map((term) => {
      const rate = latest.get(term)!;
      const prevRate = previous.get(term) ?? null;
      return { term, rate, prevRate, changeBp: changeInBp(rate, prevRate) };
    });

  return { curve: { date, prevDate, points }, fetchedAt: latestRows[0].fetched_at };
}

function isStale(fetchedAt: string): boolean {
  return Date.now() - new Date(fetchedAt).getTime() > CACHE_TTL_MS;
}

// Serves from Postgres while fresh. Otherwise refetches from Treasury, and
// falls back to the stale row if that fails. Throws only when there is no
// data at all.
export async function getCurrentCurve(): Promise<YieldCurve> {
  const cached = await queryLatest();

  if (cached && !isStale(cached.fetchedAt)) {
    return cached.curve;
  }

  try {
    await refreshYieldCurve();
  } catch (err) {
    if (cached) {
      console.error('refresh failed, serving stale cache', err);
      return cached.curve;
    }
    console.error('refresh failed, no cached data available', err);
    throw new Error('failed to fetch treasury data');
  }

  const refreshed = await queryLatest();
  if (!refreshed) {
    throw new Error('failed to fetch treasury data');
  }
  return refreshed.curve;
}
