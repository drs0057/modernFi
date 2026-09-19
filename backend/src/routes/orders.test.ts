import express from 'express';
import request from 'supertest';

jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../paymentProcessor', () => ({
  submitToPaymentProcessor: jest.fn(),
}));

import { pool } from '../db';
import { submitToPaymentProcessor } from '../paymentProcessor';
import ordersRouter from './orders';

const mockedQuery = jest.mocked(pool.query);
const mockedSubmit = jest.mocked(submitToPaymentProcessor);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', ordersRouter);
  return app;
}

describe('POST /api/orders', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedSubmit.mockReset();
  });

  it('rejects a term outside the known set', async () => {
    const res = await request(buildApp()).post('/api/orders').send({ term: '99yr', amount: 100 });

    expect(res.status).toBe(400);
    expect(mockedSubmit).not.toHaveBeenCalled();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount', async () => {
    const res = await request(buildApp()).post('/api/orders').send({ term: '5yr', amount: 0 });

    expect(res.status).toBe(400);
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('rejects an amount that is not a finite number', async () => {
    const res = await request(buildApp())
      .post('/api/orders')
      .send({ term: '5yr', amount: 'lots' });

    expect(res.status).toBe(400);
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('inserts the order only after the payment processor accepts it', async () => {
    mockedSubmit.mockResolvedValue(undefined);
    mockedQuery.mockResolvedValue({
      rows: [{ id: 1, term: '5yr', amount: '100.00', submitted_at: '2026-09-19T00:00:00.000Z' }],
    } as never);

    const res = await request(buildApp()).post('/api/orders').send({ term: '5yr', amount: 100 });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 1,
      term: '5yr',
      amount: '100.00',
      submitted_at: '2026-09-19T00:00:00.000Z',
    });
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(mockedQuery.mock.calls[0][0]).toMatch(/INSERT INTO orders/);
  });

  it('never writes to the database when the payment processor declines', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedSubmit.mockRejectedValue(new Error('payment processor declined the order'));

    const res = await request(buildApp()).post('/api/orders').send({ term: '5yr', amount: 100 });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'payment processor declined the order' });
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe('GET /api/orders', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('returns a page of orders with pagination and sort metadata, defaulting to page 1', async () => {
    const rows = [
      { id: 2, term: '2yr', amount: '50.00', submitted_at: '2026-09-19T01:00:00.000Z' },
      { id: 1, term: '5yr', amount: '100.00', submitted_at: '2026-09-18T00:00:00.000Z' },
    ];
    mockedQuery
      .mockResolvedValueOnce({ rows } as never)
      .mockResolvedValueOnce({ rows: [{ count: 2 }] } as never);

    const res = await request(buildApp()).get('/api/orders');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      orders: rows,
      total: 2,
      page: 1,
      pageSize: 10,
      sortBy: 'submitted_at',
      sortDir: 'desc',
    });
    expect(mockedQuery.mock.calls[0][0]).toMatch(/ORDER BY submitted_at desc/);
    expect(mockedQuery.mock.calls[0][1]).toEqual([10, 0]);
  });

  it('honors page and pageSize query params and computes the right offset', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ count: 25 }] } as never);

    const res = await request(buildApp()).get('/api/orders?page=3&pageSize=5');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ orders: [], total: 25, page: 3, pageSize: 5 });
    expect(mockedQuery.mock.calls[0][1]).toEqual([5, 10]);
  });

  it('clamps an oversized pageSize to the configured max', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ count: 0 }] } as never);

    const res = await request(buildApp()).get('/api/orders?pageSize=500');

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(50);
  });

  it('sorts by a whitelisted column and direction from query params', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ count: 0 }] } as never);

    const res = await request(buildApp()).get('/api/orders?sortBy=amount&sortDir=asc');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sortBy: 'amount', sortDir: 'asc' });
    expect(mockedQuery.mock.calls[0][0]).toMatch(/ORDER BY amount asc/);
  });

  it('falls back to the default sort when given a column outside the whitelist', async () => {
    mockedQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ count: 0 }] } as never);

    // A column name that isn't in SORTABLE_COLUMNS should never reach the
    // SQL string, since it's built via string interpolation.
    const res = await request(buildApp()).get(
      '/api/orders?sortBy=id;%20DROP%20TABLE%20orders;--'
    );

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sortBy: 'submitted_at', sortDir: 'desc' });
    expect(mockedQuery.mock.calls[0][0]).toMatch(/ORDER BY submitted_at desc/);
  });
});
