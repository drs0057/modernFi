// One row per Treasury term, shortest first. The list order is the curve
// order. `treasuryHeader` is the column name in Treasury's CSV feed.
// db/init.sql repeats the term codes in CHECK constraints.
export const TERMS = [
  { code: '1mo', months: 1, treasuryHeader: '1 Mo' },
  { code: '2mo', months: 2, treasuryHeader: '2 Mo' },
  { code: '3mo', months: 3, treasuryHeader: '3 Mo' },
  { code: '4mo', months: 4, treasuryHeader: '4 Mo' },
  { code: '6mo', months: 6, treasuryHeader: '6 Mo' },
  { code: '1yr', months: 12, treasuryHeader: '1 Yr' },
  { code: '2yr', months: 24, treasuryHeader: '2 Yr' },
  { code: '3yr', months: 36, treasuryHeader: '3 Yr' },
  { code: '5yr', months: 60, treasuryHeader: '5 Yr' },
  { code: '7yr', months: 84, treasuryHeader: '7 Yr' },
  { code: '10yr', months: 120, treasuryHeader: '10 Yr' },
  { code: '20yr', months: 240, treasuryHeader: '20 Yr' },
  { code: '30yr', months: 360, treasuryHeader: '30 Yr' },
] as const;

export type Term = typeof TERMS[number]['code'];

export const TERM_ORDER: readonly Term[] = TERMS.map((term) => term.code);

export const TERM_MONTHS = Object.fromEntries(
  TERMS.map((term) => [term.code, term.months])
) as Record<Term, number>;

export const HEADER_TO_TERM = Object.fromEntries(
  TERMS.map((term) => [term.treasuryHeader, term.code])
) as Record<string, Term>;
