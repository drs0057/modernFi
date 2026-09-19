import { pickCompareDates } from './curveDates';
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
function changeInBp(rate: number, prevRate: number | undefined): number | null {
  return prevRate === undefined ? null : Math.round((rate - prevRate) * 100);
}

// Old comparison dates pile up in the table as days pass, so the dates in
// play are picked from the latest date, not by taking the newest few.
const MAX_STORED_DATES = 400;

async function queryLatest(): Promise<CachedCurve | null> {
  const { rows: dateRows } = await pool.query<{ date: string }>(
    `SELECT DISTINCT date::text AS date FROM yield_curve_rates ORDER BY date DESC LIMIT ${MAX_STORED_DATES}`
  );
  if (dateRows.length === 0) {
    return null;
  }

  const dates = dateRows.map((row) => row.date);
  const date = dates[0];
  const compareDates = pickCompareDates(dates, date);
  const wanted = [date, ...Object.values(compareDates).filter((d): d is string => d !== null)];

  const { rows } = await pool.query<CurveRow>(
    `SELECT date::text, term, rate, fetched_at FROM yield_curve_rates WHERE date = ANY($1::date[])`,
    [wanted]
  );

  const ratesOn = (day: string | null) =>
    toRateMap(day === null ? [] : rows.filter((row) => row.date === day));
  const latestRows = rows.filter((row) => row.date === date);
  if (latestRows.length === 0) {
    return null;
  }

  const latest = ratesOn(date);
  const previous = {
    d1: ratesOn(compareDates.d1),
    m1: ratesOn(compareDates.m1),
    y1: ratesOn(compareDates.y1),
  };

  const points: YieldPoint[] = TERM_ORDER
    .filter((term) => latest.has(term))
    .map((term) => {
      const rate = latest.get(term)!;
      return {
        term,
        rate,
        changes: {
          d1: changeInBp(rate, previous.d1.get(term)),
          m1: changeInBp(rate, previous.m1.get(term)),
          y1: changeInBp(rate, previous.y1.get(term)),
        },
      };
    });

  return { curve: { date, compareDates, points }, fetchedAt: latestRows[0].fetched_at };
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
