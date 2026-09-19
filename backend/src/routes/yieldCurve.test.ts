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

function buildApp() {
  const app = express();
  app.use('/api/yield-curve', yieldCurveRouter);
  return app;
}

function rowsFor(fetchedAt: string) {
  return [
    { date: '2026-09-19', term: '1yr', rate: '4.40', fetched_at: fetchedAt },
    { date: '2026-09-19', term: '5yr', rate: '4.78', fetched_at: fetchedAt },
  ];
}

describe('GET /api/yield-curve', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedRefresh.mockReset();
  });

  it('serves from the cache without calling Treasury when the row is fresh', async () => {
    mockedQuery.mockResolvedValue({ rows: rowsFor(new Date().toISOString()) } as never);

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
    expect(res.body.prevDate).toBeNull();
    expect(res.body.points).toContainEqual({
      term: '1yr',
      rate: 4.4,
      prevRate: null,
      changeBp: null,
    });
    expect(mockedRefresh).not.toHaveBeenCalled();
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('computes the change in basis points against the previous date', async () => {
    const fetchedAt = new Date().toISOString();
    mockedQuery.mockResolvedValue({
      rows: [
        { date: '2026-09-18', term: '1yr', rate: '4.37', fetched_at: fetchedAt },
        { date: '2026-09-18', term: '5yr', rate: '4.80', fetched_at: fetchedAt },
        { date: '2026-09-19', term: '1yr', rate: '4.40', fetched_at: fetchedAt },
        { date: '2026-09-19', term: '5yr', rate: '4.78', fetched_at: fetchedAt },
        { date: '2026-09-19', term: '10yr', rate: '4.94', fetched_at: fetchedAt },
      ],
    } as never);

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.body.date).toBe('2026-09-19');
    expect(res.body.prevDate).toBe('2026-09-18');
    expect(res.body.points).toEqual([
      { term: '1yr', rate: 4.4, prevRate: 4.37, changeBp: 3 },
      { term: '5yr', rate: 4.78, prevRate: 4.8, changeBp: -2 },
      { term: '10yr', rate: 4.94, prevRate: null, changeBp: null },
    ]);
  });

  it('fetches from Treasury when the cache is empty', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: rowsFor(new Date().toISOString()) } as never);
    mockedRefresh.mockResolvedValue({ dates: ['2026-09-19'], inserted: 13 });

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
    expect(mockedQuery).toHaveBeenCalledTimes(2);
  });

  it('re-fetches from Treasury when the cached row is older than the TTL', async () => {
    const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mockedQuery
      .mockResolvedValueOnce({ rows: rowsFor(staleTimestamp) } as never)
      .mockResolvedValueOnce({ rows: rowsFor(new Date().toISOString()) } as never);
    mockedRefresh.mockResolvedValue({ dates: ['2026-09-19'], inserted: 13 });

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the stale cache when a refresh attempt fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const staleTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mockedQuery.mockResolvedValueOnce({ rows: rowsFor(staleTimestamp) } as never);
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(200);
    expect(res.body.date).toBe('2026-09-19');
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('returns 502 when the cache is empty and the refresh attempt fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
    mockedRefresh.mockRejectedValue(new Error('treasury fetch failed: 503'));

    const res = await request(buildApp()).get('/api/yield-curve');

    expect(res.status).toBe(502);
  });
});
