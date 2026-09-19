import { addBusinessDays, addMonths, buildTicket, estimateInterest } from './ticket';

describe('addBusinessDays', () => {
  it('moves Monday to Tuesday', () => {
    expect(addBusinessDays('2026-09-14', 1)).toBe('2026-09-15');
  });

  it('moves Friday to the next Monday', () => {
    expect(addBusinessDays('2026-09-18', 1)).toBe('2026-09-21');
  });

  it('moves Saturday to the next Monday', () => {
    expect(addBusinessDays('2026-09-19', 1)).toBe('2026-09-21');
  });
});

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths('2026-09-21', 3)).toBe('2026-12-21');
  });

  it('crosses a year boundary', () => {
    expect(addMonths('2026-11-15', 6)).toBe('2027-05-15');
  });

  it('clamps to the last day of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
});

describe('estimateInterest', () => {
  it('computes simple interest to maturity', () => {
    expect(estimateInterest(1_000_000, 4, 24)).toBe(80_000);
  });

  it('prorates terms shorter than a year', () => {
    expect(estimateInterest(1_000_000, 4.2, 6)).toBe(21_000);
  });

  it('rounds to the cent', () => {
    expect(estimateInterest(100, 4.123, 1)).toBe(0.34);
  });
});

describe('buildTicket', () => {
  it('settles T+1 in New York time and matures term months later', () => {
    // 2026-09-18 23:30 in New York is already 2026-09-19 UTC. NY date is still Friday.
    const now = new Date('2026-09-19T03:30:00Z');
    const ticket = buildTicket({
      term: '2yr',
      amount: 1_000_000,
      rate: 4,
      rateDate: '2026-09-18',
      now,
    });

    expect(ticket).toEqual({
      term: '2yr',
      amount: 1_000_000,
      rate: 4,
      rateDate: '2026-09-18',
      settlementDate: '2026-09-21',
      maturityDate: '2028-09-21',
      estInterest: 80_000,
    });
  });
});
