import { readFileSync } from 'fs';
import { join } from 'path';
import { HEADER_TO_TERM, TERMS, TERM_MONTHS, TERM_ORDER } from './terms';

describe('terms', () => {
  it('derives the order, months and Treasury header maps from one table', () => {
    expect(TERM_ORDER).toEqual(TERMS.map((term) => term.code));
    expect(TERM_MONTHS['2yr']).toBe(24);
    expect(HEADER_TO_TERM['10 Yr']).toBe('10yr');
    expect(Object.keys(HEADER_TO_TERM)).toHaveLength(TERMS.length);
  });

  it('lists shorter terms first', () => {
    const months = TERM_ORDER.map((term) => TERM_MONTHS[term]);
    expect(months).toEqual([...months].sort((a, b) => a - b));
  });

  it('matches the term CHECK constraints in db/init.sql', () => {
    const sql = readFileSync(join(__dirname, '../../db/init.sql'), 'utf8');
    const lists = [...sql.matchAll(/term\s+TEXT NOT NULL CHECK \(term IN \(([^)]*)\)\)/g)];

    expect(lists).toHaveLength(2);
    for (const [, list] of lists) {
      const codes = [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
      expect(codes).toEqual([...TERM_ORDER]);
    }
  });
});
