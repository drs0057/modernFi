import { CurveUnavailableError } from '../errors';
import { TERM_ORDER } from '../terms';
import { YieldCurve, YieldPoint } from '../types';
import { pickCompareDates } from './curveDates';
import { refreshYieldCurve } from './curveRefresh';
import { CurveRow, findRatesOnDates, findStoredDates } from './curveRepository';

// Treasury posts each day's curve after the close, at a time that varies. A
// stored curve can lag the new day by up to one TTL, so keep the TTL short.
// A refresh is one small CSV fetch per year and is idempotent.
const CACHE_TTL_MS = 60 * 60 * 1000;

// After a failed refresh, serve the stale curve for this long before trying
// Treasury again. Stops every request from waiting on a broken upstream.
const REFRESH_RETRY_COOLDOWN_MS = 60 * 1000;

interface CachedCurve {
  curve: YieldCurve;
  fetchedAt: Date;
}

function toRateMap(rows: CurveRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.term, parseFloat(row.rate)]));
}

// Rounded to whole basis points. 0.03 percentage points = 3 bp.
function changeInBp(rate: number, prevRate: number | undefined): number | null {
  return prevRate === undefined ? null : Math.round((rate - prevRate) * 100);
}

async function loadCachedCurve(): Promise<CachedCurve | null> {
  const dates = await findStoredDates();
  if (dates.length === 0) {
    return null;
  }

  const date = dates[0];
  const compareDates = pickCompareDates(dates, date);
  const wanted = [date, ...Object.values(compareDates).filter((d): d is string => d !== null)];
  const rows = await findRatesOnDates(wanted);

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

  const fetchedAt = new Date(Math.max(...latestRows.map((row) => new Date(row.fetched_at).getTime())));
  return { curve: { date, compareDates, points }, fetchedAt };
}

function isStale(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() > CACHE_TTL_MS;
}

// Requests that find a stale cache at the same time share one refresh.
let refreshing: Promise<void> | null = null;
let lastFailureAt: number | null = null;

function refreshOnce(): Promise<void> {
  if (!refreshing) {
    refreshing = refreshYieldCurve()
      .then(() => {
        lastFailureAt = null;
      })
      .catch((err) => {
        lastFailureAt = Date.now();
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function refreshFailedRecently(): boolean {
  return lastFailureAt !== null && Date.now() - lastFailureAt < REFRESH_RETRY_COOLDOWN_MS;
}

// For tests. Module state would otherwise leak between cases.
export function resetRefreshState(): void {
  refreshing = null;
  lastFailureAt = null;
}

// Serves from Postgres while fresh. Otherwise refetches from Treasury, and
// falls back to the stale row if that fails. Throws only when there is no
// data at all.
export async function getCurrentCurve(): Promise<YieldCurve> {
  const cached = await loadCachedCurve();

  if (cached && !isStale(cached.fetchedAt)) {
    return cached.curve;
  }
  if (cached && refreshFailedRecently()) {
    return cached.curve;
  }

  try {
    await refreshOnce();
  } catch (err) {
    if (cached) {
      console.error('refresh failed, serving stale cache', err);
      return cached.curve;
    }
    console.error('refresh failed, no cached data available', err);
    throw new CurveUnavailableError();
  }

  const refreshed = await loadCachedCurve();
  if (!refreshed) {
    throw new CurveUnavailableError();
  }
  return refreshed.curve;
}
