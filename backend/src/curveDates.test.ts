import { addDays, compareTargets, pickCompareDates, pickOnOrBefore } from './curveDates';

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('compareTargets', () => {
  it('returns 1 day, 1 month and 1 year before the latest date', () => {
    expect(compareTargets('2026-09-18')).toEqual({
      d1: '2026-09-17',
      m1: '2026-08-18',
      y1: '2025-09-18',
    });
  });

  it('clamps a month-end target to the shorter month', () => {
    expect(compareTargets('2026-03-31').m1).toBe('2026-02-28');
    expect(compareTargets('2028-02-29').y1).toBe('2027-02-28');
  });
});

describe('pickOnOrBefore', () => {
  const dates = ['2026-09-18', '2026-09-17', '2026-08-14', '2025-09-19'];

  it('returns the target itself when it is a stored date', () => {
    expect(pickOnOrBefore(dates, '2026-09-17')).toBe('2026-09-17');
  });

  it('falls back to the nearest earlier date', () => {
    expect(pickOnOrBefore(dates, '2026-08-16')).toBe('2026-08-14');
  });

  it('never picks a date after the target', () => {
    expect(pickOnOrBefore(['2026-09-18'], '2026-09-17')).toBeNull();
  });

  it('returns null when the nearest earlier date is more than 7 days away', () => {
    expect(pickOnOrBefore(['2026-08-01'], '2026-08-18')).toBeNull();
    expect(pickOnOrBefore(['2026-08-11'], '2026-08-18')).toBe('2026-08-11');
  });
});

describe('pickCompareDates', () => {
  it('maps 1D, 1M and 1Y to the nearest earlier stored dates', () => {
    const dates = ['2026-09-18', '2026-09-17', '2026-08-18', '2025-09-19', '2025-09-18'];

    expect(pickCompareDates(dates, '2026-09-18')).toEqual({
      d1: '2026-09-17',
      m1: '2026-08-18',
      y1: '2025-09-18',
    });
  });

  it('skips a Sunday 1Y target back to the prior Friday', () => {
    // 2025-09-14 is a Sunday.
    const dates = ['2026-09-14', '2026-09-11', '2026-08-14', '2025-09-12'];

    expect(pickCompareDates(dates, '2026-09-14')).toEqual({
      d1: '2026-09-11',
      m1: '2026-08-14',
      y1: '2025-09-12',
    });
  });

  it('returns null for a comparison with no nearby date', () => {
    expect(pickCompareDates(['2026-09-18', '2026-09-17'], '2026-09-18')).toEqual({
      d1: '2026-09-17',
      m1: null,
      y1: null,
    });
  });
});
