import express from 'express';
import request from 'supertest';

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../treasury', () => ({
  refreshYieldCurve: jest.fn(),
}));

import { pool } from '../db';
import { refreshYieldCurve } from '../treasury';
import yieldCurveRouter from './yieldCurve';

const mockedQuery = jest.mocked(pool.query);
const mockedRefresh = jest.mocked(refreshYieldCurve);

interface Row {
  date: string;
  term: string;
  rate: string;
  fetched_at: string;
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

function rowsFor(date: string, fetchedAt: string, rates: Record<string, string>): Row[] {
  return Object.entries(rates).map(([term, rate]) => ({ date, term, rate, fetched_at: fetchedAt }));
}

function buildApp() {
  const app = express();
  app.use('/api/yield-curve', yieldCurveRouter);
  return app;
}

const NOW = () => new Date().toISOString();
const STALE = () => new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

describe('GET /api/yield-curve', () => {
  beforeEach(() => {
    db.rows = [];
    mockedQuery.mockReset();
    mockedQuery.mockImplementation(fakeQuery as never);
    mockedRefresh.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves from the cache without calling Treasury when the row is fresh', async () => {
    db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40', '5yr': '4.78' });

    const res = await request(buildApp()).get('/api/yield-curve');

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

    const res = await request(buildApp()).get('/api/yield-curve');

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

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.body.compareDates).toEqual({ d1: '2026-09-17', m1: '2026-08-18', y1: '2025-09-18' });
    expect(res.body.points[0].changes).toEqual({ d1: 3, m1: -10, y1: 50 });
  });

  it('fetches from Treasury when the cache is empty', async () => {
    mockedRefresh.mockImplementation(async () => {
      db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40' });
      return { dates: ['2026-09-19'], inserted: 1 };
    });

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('re-fetches from Treasury when the cached row is older than the TTL', async () => {
    db.rows = rowsFor('2026-09-18', STALE(), { '1yr': '4.30' });
    mockedRefresh.mockImplementation(async () => {
      db.rows = rowsFor('2026-09-19', NOW(), { '1yr': '4.40' });
      return { dates: ['2026-09-19'], inserted: 1 };
    });

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stale cache when a refresh attempt fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    db.rows = rowsFor('2026-09-19', STALE(), { '1yr': '4.40' });
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
  });

  it('returns 502 when the cache is empty and the refresh attempt fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(502);
  });
});
