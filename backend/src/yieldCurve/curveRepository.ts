import { pool } from '../db';
import { ParsedRow } from './treasuryClient';

export interface CurveRow {
  date: string;
  term: string;
  rate: string;
  fetched_at: Date;
}

// Old comparison dates pile up in the table as days pass, so the dates in
// play are picked from the latest date, not by taking the newest few. Stored
// dates are business days, so one year holds at most about 262 of them and
// this cap always reaches the 1 year comparison date.
const MAX_STORED_DATES = 400;

// One statement, so a concurrent reader sees either none or all of the rows.
const UPSERT_RATES_SQL = `
  INSERT INTO yield_curve_rates (date, term, rate, fetched_at)
  SELECT date, term, rate, now()
  FROM unnest($1::date[], $2::text[], $3::numeric[]) AS t(date, term, rate)
  ON CONFLICT (date, term) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = now()`;

// Returns the number of rate rows written.
export async function upsertRates(rows: ParsedRow[]): Promise<number> {
  const dates: string[] = [];
  const terms: string[] = [];
  const rates: number[] = [];
  for (const { date, points } of rows) {
    for (const point of points) {
      dates.push(date);
      terms.push(point.term);
      rates.push(point.rate);
    }
  }
  if (dates.length > 0) {
    await pool.query(UPSERT_RATES_SQL, [dates, terms, rates]);
  }
  return dates.length;
}

// Stored dates, newest first.
export async function findStoredDates(): Promise<string[]> {
  const { rows } = await pool.query<{ date: string }>(
    `SELECT DISTINCT date::text AS date FROM yield_curve_rates ORDER BY date DESC LIMIT $1`,
    [MAX_STORED_DATES]
  );
  return rows.map((row) => row.date);
}

export async function findRatesOnDates(dates: string[]): Promise<CurveRow[]> {
  const { rows } = await pool.query<CurveRow>(
    `SELECT date::text, term, rate, fetched_at FROM yield_curve_rates WHERE date = ANY($1::date[])`,
    [dates]
  );
  return rows;
}
