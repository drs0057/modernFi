jest.mock('../db', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from '../db';
import { refreshYieldCurve, selectRowsToStore } from './curveRefresh';
import { HEADER_ROW, csvRow } from './testCsv';
import { parseCsv } from './treasuryClient';

const mockedQuery = jest.mocked(pool.query);

describe('selectRowsToStore', () => {
  it('keeps the latest date and its 1 day, 1 month and 1 year comparison dates', () => {
    const rows = parseCsv(
      [
        HEADER_ROW,
        csvRow('09/18/2026'),
        csvRow('09/17/2026'),
        csvRow('09/16/2026'),
        csvRow('08/18/2026'),
        csvRow('08/17/2026'),
        csvRow('09/19/2025'),
        csvRow('09/18/2025'),
        csvRow('09/17/2025'),
      ].join('\n')
    );

    expect(selectRowsToStore(rows).map((row) => row.date)).toEqual([
      '2026-09-18',
      '2026-09-17',
      '2026-08-18',
      '2025-09-18',
    ]);
  });
});

describe('refreshYieldCurve', () => {
  const realFetch = global.fetch;

  function stubFetch(byYear: Record<string, string | number>) {
    global.fetch = jest.fn(async (url: unknown) => {
      const year = /csv\/(\d{4})\//.exec(String(url))![1];
      const body = byYear[year];
      return typeof body === 'number'
        ? ({ ok: false, status: body } as Response)
        : ({ ok: true, status: 200, text: async () => body } as Response);
    }) as typeof fetch;
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-18T15:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    mockedQuery.mockReset();
    mockedQuery.mockResolvedValue({ rows: [] } as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = realFetch;
  });

  // The upsert is one statement whose first parameter is the array of dates.
  const storedDates = () => {
    const [, params] = mockedQuery.mock.calls[0];
    return [...new Set((params as [string[]])[0])];
  };

  it('fetches this year and last year and stores only the four comparison dates', async () => {
    stubFetch({
      '2026': [HEADER_ROW, csvRow('09/18/2026'), csvRow('09/17/2026'), csvRow('08/18/2026')].join('\n'),
      '2025': [HEADER_ROW, csvRow('09/19/2025'), csvRow('09/18/2025'), csvRow('09/17/2025')].join('\n'),
    });

    const result = await refreshYieldCurve();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.dates).toEqual(['2026-09-18', '2026-09-17', '2026-08-18', '2025-09-18']);
    expect(storedDates()).toEqual(['2026-09-18', '2026-09-17', '2026-08-18', '2025-09-18']);
    expect(result.inserted).toBe(4 * 13);
  });

  it('writes every row in one statement so readers never see a partial curve', async () => {
    stubFetch({
      '2026': [HEADER_ROW, csvRow('09/18/2026'), csvRow('09/17/2026')].join('\n'),
      '2025': [HEADER_ROW, csvRow('09/18/2025')].join('\n'),
    });

    await refreshYieldCurve();

    expect(mockedQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(String(sql)).toMatch(/ON CONFLICT \(date, term\)/);
    const [dates, terms, rates] = params as [string[], string[], number[]];
    expect(dates).toHaveLength(3 * 13);
    expect(terms).toHaveLength(3 * 13);
    expect(rates).toHaveLength(3 * 13);
  });

  it('gives every Treasury request a timeout signal', async () => {
    stubFetch({
      '2026': [HEADER_ROW, csvRow('09/18/2026')].join('\n'),
      '2025': [HEADER_ROW, csvRow('09/18/2025')].join('\n'),
    });

    await refreshYieldCurve();

    for (const [, init] of jest.mocked(global.fetch).mock.calls) {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('picks the year from New York time, not the server zone', async () => {
    // 03:00 UTC on Jan 1 is still Dec 31 evening in New York.
    jest.setSystemTime(new Date('2027-01-01T03:00:00Z'));
    stubFetch({
      '2026': [HEADER_ROW, csvRow('12/31/2026')].join('\n'),
      '2025': [HEADER_ROW, csvRow('12/31/2025')].join('\n'),
    });

    await refreshYieldCurve();

    const years = jest.mocked(global.fetch).mock.calls.map(([url]) => /csv\/(\d{4})\//.exec(String(url))![1]);
    expect(years.sort()).toEqual(['2025', '2026']);
  });

  it('still succeeds when the prior year fetch fails, leaving 1Y unavailable', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch({
      '2026': [HEADER_ROW, csvRow('09/18/2026'), csvRow('09/17/2026'), csvRow('08/18/2026')].join('\n'),
      '2025': 503,
    });

    const result = await refreshYieldCurve();

    expect(result.dates).toEqual(['2026-09-18', '2026-09-17', '2026-08-18']);
  });

  it('fails when the current year fetch fails', async () => {
    stubFetch({ '2026': 503, '2025': [HEADER_ROW, csvRow('12/31/2025')].join('\n') });

    await expect(refreshYieldCurve()).rejects.toThrow('treasury fetch failed for 2026: 503');
  });

  it('uses the prior year for the latest date when the current year has no rows yet', async () => {
    jest.setSystemTime(new Date('2027-01-01T15:00:00Z'));
    stubFetch({
      '2027': HEADER_ROW,
      '2026': [HEADER_ROW, csvRow('12/31/2026'), csvRow('12/30/2026'), csvRow('11/30/2026')].join('\n'),
    });

    const result = await refreshYieldCurve();

    expect(result.dates).toEqual(['2026-12-31', '2026-12-30', '2026-11-30']);
  });
});
