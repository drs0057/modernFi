import request from 'supertest';

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('./curveRefresh', () => ({
  refreshYieldCurve: jest.fn(),
}));

import { createApp } from '../app';
import { pool } from '../db';
import { refreshYieldCurve } from './curveRefresh';
import { resetRefreshState } from './curveService';

const mockedQuery = jest.mocked(pool.query);
const mockedRefresh = jest.mocked(refreshYieldCurve);

interface Row {
  date: string;
  term: string;
  rate: string;
  fetched_at: Date;
}

// In-memory stand-in for the table. Answers the two queries the service makes.
const db: { rows: Row[] } = { rows: [] };

function fakeQuery(sql: unknown, params?: unknown) {
  if (String(sql).includes('DISTINCT date')) {
    const dates = [...new Set(db.rows.map((row) => row.date))].sort().reverse();
    return Promise.resolve({ rows: dates.map((date) => ({ date })) });
  }
  const wanted = (params as string[][])[0];
  return Promise.resolve({ rows: db.rows.filter((row) => wanted.includes(row.date)) });
}

function rowsFor(date: string, fetchedAt: Date, rates: Record<string, string>): Row[] {
  return Object.entries(rates).map(([term, rate]) => ({ date, term, rate, fetched_at: fetchedAt }));
}

const HOUR_MS = 60 * 60 * 1000;
const NOW = () => new Date();
const HOURS_AGO = (hours: number) => new Date(Date.now() - hours * HOUR_MS);
const STALE = () => HOURS_AGO(2);

describe('GET /api/yield-curve', () => {
  beforeEach(() => {
    db.rows = [];
    mockedQuery.mockReset();
    mockedQuery.mockImplementation(fakeQuery as never);
    mockedRefresh.mockReset();
    resetRefreshState();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves from the cache without calling Treasury when the row is fresh', async () => {
    db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40', '5yr': '4.78' });

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
    expect(res.body.compareDates).toEqual({ d1: null, m1: null, y1: null });
    expect(res.body.points).toContainEqual({
      term: '1yr',
      rate: 4.4,
      changes: { d1: null, m1: null, y1: null },
    });
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('computes 1D, 1M and 1Y change in basis points', async () => {
    const fetchedAt = NOW();
    db.rows = [
      ...rowsFor('2026-09-18', fetchedAt, { '1yr': '4.40', '5yr': '4.78', '10yr': '4.94' }),
      ...rowsFor('2026-09-17', fetchedAt, { '1yr': '4.37', '5yr': '4.80' }),
      ...rowsFor('2026-08-18', fetchedAt, { '1yr': '4.50', '5yr': '4.60' }),
      ...rowsFor('2025-09-18', fetchedAt, { '1yr': '3.90', '5yr': '4.20' }),
    ];

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.body.date).toBe('2026-09-18');
    expect(res.body.compareDates).toEqual({ d1: '2026-09-17', m1: '2026-08-18', y1: '2025-09-18' });
    expect(res.body.points).toEqual([
      { term: '1yr', rate: 4.4, changes: { d1: 3, m1: -10, y1: 50 } },
      { term: '5yr', rate: 4.78, changes: { d1: -2, m1: 18, y1: 58 } },
      { term: '10yr', rate: 4.94, changes: { d1: null, m1: null, y1: null } },
    ]);
  });

  it('ignores comparison dates left over from earlier days', async () => {
    const fetchedAt = NOW();
    db.rows = [
      // Yesterday's refresh stored these. They must not become today's comparisons.
      ...rowsFor('2026-09-17', fetchedAt, { '1yr': '4.37' }),
      ...rowsFor('2026-09-16', fetchedAt, { '1yr': '4.30' }),
      ...rowsFor('2026-08-17', fetchedAt, { '1yr': '4.45' }),
      ...rowsFor('2025-09-17', fetchedAt, { '1yr': '3.80' }),
      // Today's refresh.
      ...rowsFor('2026-09-18', fetchedAt, { '1yr': '4.40' }),
      ...rowsFor('2026-08-18', fetchedAt, { '1yr': '4.50' }),
      ...rowsFor('2025-09-18', fetchedAt, { '1yr': '3.90' }),
    ];

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.body.compareDates).toEqual({ d1: '2026-09-17', m1: '2026-08-18', y1: '2025-09-18' });
    expect(res.body.points[0].changes).toEqual({ d1: 3, m1: -10, y1: 50 });
  });

  it('fetches from Treasury when the cache is empty', async () => {
    mockedRefresh.mockImplementation(async () => {
      db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40' });
      return { dates: ['2026-09-19'], inserted: 1 };
    });

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from Treasury when the cached row is older than the TTL', async () => {
    db.rows = rowsFor('2026-09-18', STALE(), { '1yr': '4.30' });
    mockedRefresh.mockImplementation(async () => {
      db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40' });
      return { dates: ['2026-09-19'], inserted: 1 };
    });

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stale cache when a refresh attempt fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.rows = rowsFor('2026-09-19', STALE(), { '1yr': '4.40' });
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
  });

  it('returns 502 when the cache is empty and the refresh attempt fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'failed to fetch treasury data' });
  });

  it('serves a row fetched 30 minutes ago without refreshing', async () => {
    db.rows = rowsFor('2026-09-19', HOURS_AGO(0.5), { '1yr': '4.40' });

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('uses the newest fetched_at among the latest date rows', async () => {
    db.rows = [
      ...rowsFor('2026-09-19', HOURS_AGO(5), { '1yr': '4.40' }),
      ...rowsFor('2026-09-19', NOW(), { '5yr': '4.78' }),
    ];

    const res = await request(createApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(mockedRefresh).not.toHaveBeenCalled();
  });

  it('shares one Treasury refresh between concurrent requests on a stale cache', async () => {
    db.rows = rowsFor('2026-09-18', STALE(), { '1yr': '4.30' });
    let finishRefresh: () => void = () => {};
    mockedRefresh.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRefresh = () => {
            db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40' });
            resolve({ dates: ['2026-09-19'], inserted: 1 });
          };
        })
    );

    const app = createApp();
    const requests = Array.from({ length: 5 }, () => request(app).get('/api/yield-curve').then((res) => res));
    await new Promise((resolve) => setTimeout(resolve, 100));
    finishRefresh();
    const responses = await Promise.all(requests);

    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(responses.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
    expect(responses.every((res) => res.body.date === '2026-09-19')).toBe(true);
  });

  it('skips Treasury for a minute after a failed refresh and serves the stale cache', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.rows = rowsFor('2026-09-19', STALE(), { '1yr': '4.40' });
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const app = createApp();
    const first = await request(app).get('/api/yield-curve');
    const second = await request(app).get('/api/yield-curve');

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('tries Treasury again once the cooldown has passed', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.rows = rowsFor('2026-09-19', STALE(), { '1yr': '4.40' });
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const app = createApp();
    await request(app).get('/api/yield-curve');
    const realNow = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(realNow + 61 * 1000);
    await request(app).get('/api/yield-curve');

    expect(mockedRefresh).toHaveBeenCalledTimes(2);
  });
});
