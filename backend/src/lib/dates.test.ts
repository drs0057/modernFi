import { addBusinessDays, addDays, addMonths, daysBetween, todayInSettlementZone } from './dates';

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

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('daysBetween', () => {
  it('counts calendar days across a month end', () => {
    expect(daysBetween('2026-03-02', '2026-02-27')).toBe(3);
  });
});

describe('todayInSettlementZone', () => {
  it('returns the New York date, not the UTC date', () => {
    expect(todayInSettlementZone(new Date('2026-09-19T03:30:00Z'))).toBe('2026-09-18');
  });
});
