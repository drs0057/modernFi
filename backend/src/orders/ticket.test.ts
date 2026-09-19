import { buildTicket, estimateInterest } from './ticket';

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
