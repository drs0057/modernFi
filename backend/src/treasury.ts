import { pool } from './db';
import { pickCompareDates } from './curveDates';
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

async function fetchCsv(year: number): Promise<string> {
  const res = await fetch(treasuryUrl(year));
  if (!res.ok) {
    throw new Error(`treasury fetch failed for ${year}: ${res.status}`);
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

function parseRow(headers: string[], line: string): ParsedRow {
  const cells = parseCsvLine(line);
  const points: { term: Term; rate: number }[] = [];

  headers.forEach((header, i) => {
    const term = HEADER_TO_TERM[header];
    if (!term) return;
    const rate = parseFloat(cells[i]);
    if (Number.isFinite(rate)) {
      points.push({ term, rate });
    }
  });

  return { date: parseIsoDate(cells[0]), points };
}

// Treasury lists the newest date first. Returns every data row in that order.
export function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);

  return lines
    .slice(1)
    .filter((line) => line.trim() !== '')
    .map((line) => parseRow(headers, line));
}

// The prior year is needed for the 1 year comparison, and for the 1 day and
// 1 month ones early in January and February. If it fails, those comparisons
// show as unavailable and the refresh still succeeds.
async function fetchPriorYearRows(year: number): Promise<ParsedRow[]> {
  try {
    return parseCsv(await fetchCsv(year));
  } catch (err) {
    console.error('prior year fetch failed, comparisons may be missing', err);
    return [];
  }
}

// Only the latest date and its 1 day, 1 month and 1 year comparison dates
// are stored. That is at most 4 dates per refresh.
export function selectRowsToStore(rows: ParsedRow[]): ParsedRow[] {
  const latest = rows[0].date;
  const wanted = new Set<string>([latest]);
  for (const date of Object.values(pickCompareDates(rows.map((row) => row.date), latest))) {
    if (date) wanted.add(date);
  }
  return rows.filter((row) => wanted.has(row.date));
}

export async function refreshYieldCurve(): Promise<{ dates: string[]; inserted: number }> {
  const year = new Date().getFullYear();
  const [currentRows, priorRows] = await Promise.all([
    fetchCsv(year).then(parseCsv),
    fetchPriorYearRows(year - 1),
  ]);

  // Current year first, so rows stay newest first. Just after New Year the
  // current-year CSV can be empty, and the prior year supplies the latest date.
  const rows = [...currentRows, ...priorRows];
  if (rows.length === 0) {
    throw new Error('treasury returned no rows');
  }

  const toStore = selectRowsToStore(rows);
  let inserted = 0;

  for (const { date, points } of toStore) {
    for (const point of points) {
      await pool.query(
        `INSERT INTO yield_curve_rates (date, term, rate, fetched_at) VALUES ($1, $2, $3, now())
         ON CONFLICT (date, term) DO UPDATE SET rate = EXCLUDED.rate, fetched_at = now()`,
        [date, point.term, point.rate]
      );
      inserted += 1;
    }
  }

  return { dates: toStore.map((row) => row.date), inserted };
}
