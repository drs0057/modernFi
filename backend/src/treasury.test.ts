import { parseCsv } from './treasury';

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

  it('reads the latest and previous rows, ignoring older ones', () => {
    const rows = [
      '09/17/2026,3.97,3.98,4.09,4.12,4.23,4.20,4.40,4.67,4.75,4.78,4.86,4.94,5.32,5.29',
      '09/16/2026,3.90,3.91,4.00,4.05,4.10,4.15,4.30,4.60,4.70,4.75,4.80,4.90,5.30,5.25',
      '09/15/2026,3.80,3.81,3.90,3.95,4.00,4.05,4.20,4.50,4.60,4.65,4.70,4.80,5.20,5.15',
    ];
    const result = parseCsv(`${HEADER_ROW}\n${rows.join('\n')}`);

    expect(result.map((row) => row.date)).toEqual(['2026-09-17', '2026-09-16']);
    expect(result[0].points.find((p) => p.term === '1mo')?.rate).toBe(3.97);
    expect(result[1].points.find((p) => p.term === '1mo')?.rate).toBe(3.9);
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
