import { pool } from './db';
import { Term } from './types';

const HEADER_TO_TERM: Record<string, Term> = {
  '1 Mo': '1mo',
  '2 Mo': '2mo',
  '3 Mo': '3mo',
  '4 Mo': '4mo',
  '6 Mo': '6mo',
  '1 Yr': '1yr',
  '2 Yr': '2yr',
  '3 Yr': '3yr',
  '5 Yr': '5yr',
  '7 Yr': '7yr',
  '10 Yr': '10yr',
  '20 Yr': '20yr',
  '30 Yr': '30yr',
};

function treasuryUrl(year: number): string {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

async function fetchLatestCsv(): Promise<string> {
  const year = new Date().getFullYear();
  const res = await fetch(treasuryUrl(year));
  if (!res.ok) {
    throw new Error(`treasury fetch failed: ${res.status}`);
  }
  return res.text();
}

function parseCsvLine(line: string): string[] {
  return line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
}

function parseIsoDate(mmddyyyy: string): string {
  const [month, day, year] = mmddyyyy.split('/');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export interface ParsedRow {
  date: string;
  points: { term: Term; rate: number }[];
}

export function parseCsv(text: string): ParsedRow {
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);
  const latestRow = parseCsvLine(lines[1]);

  const date = parseIsoDate(latestRow[0]);
  const points: { term: Term; rate: number }[] = [];

  headers.forEach((header, i) => {
    const term = HEADER_TO_TERM[header];
    if (!term) return;
    const rate = parseFloat(latestRow[i]);
    if (Number.isFinite(rate)) {
      points.push({ term, rate });
    }
  });

  return { date, points };
}

export async function refreshYieldCurve(): Promise<{ date: string; inserted: number }> {
  const csv = await fetchLatestCsv();
  const { date, points } = parseCsv(csv);

  for (const point of points) {
    await pool.query(
      `INSERT INTO yield_curve_rates (date, term, rate, fetched_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (date, term) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = now()`,
      [date, point.term, point.rate]
    );
  }

  return { date, inserted: points.length };
}
