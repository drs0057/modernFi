// Runs the real SQL against Postgres. Skipped unless TEST_DATABASE_URL is
// set. Each run works in its own schema and drops it afterward.
//
//   docker compose up -d postgres
//   TEST_DATABASE_URL=postgres://modernfi:modernfi@localhost:5432/modernfi npm run test:integration
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';
import { Term } from '../terms';
import { Ticket } from '../types';

const BASE_URL = process.env.TEST_DATABASE_URL;
const describeDb = BASE_URL ? describe : describe.skip;

const SCHEMA = `test_${randomUUID().replace(/-/g, '')}`;

function urlWithSchema(url: string): string {
  const options = encodeURIComponent(`-c search_path=${SCHEMA}`);
  return `${url}${url.includes('?') ? '&' : '?'}options=${options}`;
}

function ticket(term: Term, amount = 100): Ticket {
  return {
    term,
    amount,
    rate: 4.5,
    rateDate: '2026-09-18',
    settlementDate: '2026-09-21',
    maturityDate: '2027-09-21',
    estInterest: 4.5,
  };
}

function ratesFor(date: string, rates: Record<string, number>) {
  return {
    date,
    points: Object.entries(rates).map(([term, rate]) => ({ term: term as Term, rate })),
  };
}

describeDb('against Postgres', () => {
  let admin: Pool;
  let orders: typeof import('../orders/orderRepository');
  let curves: typeof import('../yieldCurve/curveRepository');
  let service: typeof import('../yieldCurve/curveService');
  let db: typeof import('../db');

  beforeAll(async () => {
    admin = new Pool({ connectionString: BASE_URL });
    await admin.query(`CREATE SCHEMA ${SCHEMA}`);

    process.env.DATABASE_URL = urlWithSchema(BASE_URL!);
    db = await import('../db');
    await db.pool.query(readFileSync(join(__dirname, '../../../db/init.sql'), 'utf8'));

    orders = await import('../orders/orderRepository');
    curves = await import('../yieldCurve/curveRepository');
    service = await import('../yieldCurve/curveService');
  });

  afterAll(async () => {
    await admin.query(`DROP SCHEMA ${SCHEMA} CASCADE`);
    await admin.end();
    await db.pool.end();
  });

  beforeEach(async () => {
    await db.pool.query('TRUNCATE orders, yield_curve_rates RESTART IDENTITY');
    service.resetRefreshState();
  });

  describe('orders', () => {
    it('stores one row when two requests insert the same key at once', async () => {
      const key = randomUUID();

      const results = await Promise.all([
        orders.insertOrder(key, ticket('5yr')),
        orders.insertOrder(key, ticket('5yr')),
      ]);

      expect(results.filter((order) => order !== null)).toHaveLength(1);
      const { rows } = await db.pool.query('SELECT count(*)::int AS count FROM orders');
      expect(rows[0].count).toBe(1);
      expect((await orders.findOrderByKey(key))?.term).toBe('5yr');
    });

    it('returns dates as YYYY-MM-DD text and amounts as strings', async () => {
      const order = await orders.insertOrder(randomUUID(), ticket('2yr', 1234.5));

      expect(order).toMatchObject({
        settlement_date: '2026-09-21',
        maturity_date: '2027-09-21',
        amount: '1234.50',
      });
    });

    it('sorts terms by maturity length, not alphabetically', async () => {
      for (const term of ['10yr', '1mo', '2yr', '3mo'] as Term[]) {
        await orders.insertOrder(randomUUID(), ticket(term));
      }

      const asc = await orders.listOrders({ page: 1, pageSize: 10, sortBy: 'term', sortDir: 'asc' });
      const desc = await orders.listOrders({ page: 1, pageSize: 10, sortBy: 'term', sortDir: 'desc' });

      expect(asc.orders.map((order) => order.term)).toEqual(['1mo', '3mo', '2yr', '10yr']);
      expect(desc.orders.map((order) => order.term)).toEqual(['10yr', '2yr', '3mo', '1mo']);
      expect(asc.total).toBe(4);
    });

    it('pages results and keeps the total', async () => {
      for (let i = 1; i <= 5; i += 1) {
        await orders.insertOrder(randomUUID(), ticket('1yr', i * 10));
      }

      const page = await orders.listOrders({ page: 2, pageSize: 2, sortBy: 'amount', sortDir: 'asc' });

      expect(page.orders.map((order) => order.amount)).toEqual(['30.00', '40.00']);
      expect(page.total).toBe(5);
    });

    it('rejects a zero amount and an unknown term', async () => {
      await expect(orders.insertOrder(randomUUID(), ticket('5yr', 0))).rejects.toThrow();
      await expect(orders.insertOrder(randomUUID(), ticket('99yr' as Term))).rejects.toThrow();
    });
  });

  describe('yield curve rates', () => {
    it('upserts the same rows twice without duplicating them', async () => {
      const rows = [ratesFor('2026-09-18', { '1yr': 4.4, '5yr': 4.78 })];

      expect(await curves.upsertRates(rows)).toBe(2);
      await curves.upsertRates([ratesFor('2026-09-18', { '1yr': 4.41, '5yr': 4.78 })]);

      const stored = await curves.findRatesOnDates(['2026-09-18']);
      expect(stored).toHaveLength(2);
      expect(stored.find((row) => row.term === '1yr')?.rate).toBe('4.410');
      expect(stored[0].fetched_at).toBeInstanceOf(Date);
    });

    it('lists stored dates newest first and finds rows by date array', async () => {
      await curves.upsertRates([
        ratesFor('2026-09-18', { '1yr': 4.4 }),
        ratesFor('2026-09-17', { '1yr': 4.37 }),
        ratesFor('2025-09-18', { '1yr': 3.9 }),
      ]);

      expect(await curves.findStoredDates()).toEqual(['2026-09-18', '2026-09-17', '2025-09-18']);
      const rows = await curves.findRatesOnDates(['2026-09-17', '2025-09-18']);
      expect(rows.map((row) => row.date).sort()).toEqual(['2025-09-18', '2026-09-17']);
    });

    it('does nothing when there are no rows to write', async () => {
      expect(await curves.upsertRates([])).toBe(0);
    });

    it('serves a fresh curve with change values and never calls Treasury', async () => {
      const realFetch = global.fetch;
      global.fetch = jest.fn(() => {
        throw new Error('Treasury must not be called for a fresh cache');
      }) as unknown as typeof fetch;
      try {
        await curves.upsertRates([
          ratesFor('2026-09-18', { '1yr': 4.4, '5yr': 4.78 }),
          ratesFor('2026-09-17', { '1yr': 4.37, '5yr': 4.8 }),
          ratesFor('2026-08-18', { '1yr': 4.5 }),
        ]);

        const curve = await service.getCurrentCurve();

        expect(curve.date).toBe('2026-09-18');
        expect(curve.compareDates).toEqual({ d1: '2026-09-17', m1: '2026-08-18', y1: null });
        expect(curve.points).toEqual([
          { term: '1yr', rate: 4.4, changes: { d1: 3, m1: -10, y1: null } },
          { term: '5yr', rate: 4.78, changes: { d1: -2, m1: null, y1: null } },
        ]);
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        global.fetch = realFetch;
      }
    });
  });
});
