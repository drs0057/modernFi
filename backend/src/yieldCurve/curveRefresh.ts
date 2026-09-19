import { todayInSettlementZone } from '../lib/dates';
import { pickCompareDates } from './curveDates';
import { upsertRates } from './curveRepository';
import { ParsedRow, fetchYearRows } from './treasuryClient';

// The prior year is needed for the 1 year comparison, and for the 1 day and
// 1 month ones early in January and February. If it fails, those comparisons
// show as unavailable and the refresh still succeeds.
async function fetchPriorYearRows(year: number): Promise<ParsedRow[]> {
  try {
    return await fetchYearRows(year);
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
  // The year in New York, where Treasury publishes, not the server's zone.
  const year = Number(todayInSettlementZone(new Date()).slice(0, 4));
  const [currentRows, priorRows] = await Promise.all([
    fetchYearRows(year),
    fetchPriorYearRows(year - 1),
  ]);

  // Current year first, so rows stay newest first. Just after New Year the
  // current-year CSV can be empty, and the prior year supplies the latest date.
  const rows = [...currentRows, ...priorRows];
  if (rows.length === 0) {
    throw new Error('treasury returned no rows');
  }

  const toStore = selectRowsToStore(rows);
  const inserted = await upsertRates(toStore);

  return { dates: toStore.map((row) => row.date), inserted };
}
