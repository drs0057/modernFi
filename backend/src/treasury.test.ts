jest.mock('./db', () => ({
  pool: { query: jest.fn() },
}));

import { pool } from './db';
import { parseCsv, refreshYieldCurve, selectRowsToStore } from './treasury';

const mockedQuery = jest.mocked(pool.query);

const HEADER_ROW =
  'Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"';

describe('parseCsv', () => {
  it('maps the top data row to term codes and an ISO date', () => {
    const row =
      '09/17/2026,3.97,3.98,4.09,4.12,4.23,4.20,4.40,4.67,4.75,4.78,4.86,4.94,5.32,5.29';
    const [result] = parseCsv(`${HEADER_ROW}\n${row}`);

    expect(result.date).toBe('2026-09-17');
    expect(result.points).toEqual([
      { term: '1mo', rate: 3.97 },
      { term: '2mo', rate: 4.09 },
      { term: '3mo', rate: 4.12 },
      { term: '4mo', rate: 4.23 },
      { term: '6mo', rate: 4.2 },
      { term: '1yr', rate: 4.4 },
      { term: '2yr', rate: 4.67 },
      { term: '3yr', rate: 4.75 },
      { term: '5yr', rate: 4.78 },
      { term: '7yr', rate: 4.86 },
      { term: '10yr', rate: 4.94 },
      { term: '20yr', rate: 5.32 },
      { term: '30yr', rate: 5.29 },
    ]);
  });

  it('skips the 1.5 Month column since it is not one of our standard terms', () => {
    const row =
      '09/17/2026,3.97,3.98,4.09,4.12,4.23,4.20,4.40,4.67,4.75,4.78,4.86,4.94,5.32,5.29';
    const [result] = parseCsv(`${HEADER_ROW}\n${row}`);

    expect(result.points.find((p) => (p.term as string) === '1.5mo')).toBeUndefined();
    expect(result.points).toHaveLength(13);
  });

  it('returns every data row, newest first', () => {
    const rows = [
      '09/17/2026,3.97,3.98,4.09,4.12,4.23,4.20,4.40,4.67,4.75,4.78,4.86,4.94,5.32,5.29',
      '09/16/2026,3.90,3.91,4.00,4.05,4.10,4.15,4.30,4.60,4.70,4.75,4.80,4.90,5.30,5.25',
      '09/15/2026,3.80,3.81,3.90,3.95,4.00,4.05,4.20,4.50,4.60,4.65,4.70,4.80,5.20,5.15',
    ];
    const result = parseCsv(`${HEADER_ROW}\n${rows.join('\n')}`);

    expect(result.map((row) => row.date)).toEqual(['2026-09-17', '2026-09-16', '2026-09-15']);
    expect(result[0].points.find((p) => p.term === '1mo')?.rate).toBe(3.97);
    expect(result[1].points.find((p) => p.term === '1mo')?.rate).toBe(3.9);
  });

  it('returns no rows for a header-only CSV', () => {
    expect(parseCsv(HEADER_ROW)).toEqual([]);
  });

  it('returns a single row when the CSV has only one data row', () => {
    const row =
      '01/02/2027,3.97,3.98,4.09,4.12,4.23,4.20,4.40,4.67,4.75,4.78,4.86,4.94,5.32,5.29';
    const result = parseCsv(`${HEADER_ROW}\n${row}`);

    expect(result).toHaveLength(1);
  });

  it('drops a term whose cell is blank or non-numeric instead of throwing', () => {
    const row =
      '09/17/2026,3.97,3.98,4.09,4.12,4.23,4.20,4.40,4.67,4.75,N/A,4.86,4.94,5.32,5.29';
    const [result] = parseCsv(`${HEADER_ROW}\n${row}`);

    expect(result.points.find((p) => p.term === '5yr')).toBeUndefined();
    expect(result.points).toHaveLength(12);
  });
});

function csvRow(mmddyyyy: string, oneYear = '4.40') {
  return `${mmddyyyy},3.97,3.98,4.09,4.12,4.23,4.20,${oneYear},4.67,4.75,4.78,4.86,4.94,5.32,5.29`;
}

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

  const storedDates = () => [...new Set(mockedQuery.mock.calls.map(([, params]) => (params as string[])[0]))];

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
