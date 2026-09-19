import { HEADER_TO_TERM, Term } from '../terms';

// A hung Treasury request would otherwise hold every curve and quote request.
const TREASURY_TIMEOUT_MS = 10_000;

export interface ParsedRow {
  date: string;
  points: { term: Term; rate: number }[];
}

function treasuryUrl(year: number): string {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

async function fetchCsv(year: number): Promise<string> {
  const res = await fetch(treasuryUrl(year), { signal: AbortSignal.timeout(TREASURY_TIMEOUT_MS) });
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

// Every business day of one calendar year, newest first. Throws on a
// network error, a timeout or a non-2xx response.
export async function fetchYearRows(year: number): Promise<ParsedRow[]> {
  return parseCsv(await fetchCsv(year));
}
