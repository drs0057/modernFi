import { parseOrderListQuery } from './listQuery';

describe('parseOrderListQuery', () => {
  it('defaults to page 1, 10 per page, newest first', () => {
    expect(parseOrderListQuery({})).toEqual({
      page: 1,
      pageSize: 10,
      sortBy: 'submitted_at',
      sortDir: 'desc',
    });
  });

  it('caps the page size and ignores non-positive or non-numeric values', () => {
    expect(parseOrderListQuery({ pageSize: '500' }).pageSize).toBe(50);
    expect(parseOrderListQuery({ pageSize: '0' }).pageSize).toBe(10);
    expect(parseOrderListQuery({ page: '-3' }).page).toBe(1);
    expect(parseOrderListQuery({ page: 'abc' }).page).toBe(1);
  });

  it('accepts only known sort columns and directions', () => {
    expect(parseOrderListQuery({ sortBy: 'amount', sortDir: 'asc' })).toMatchObject({
      sortBy: 'amount',
      sortDir: 'asc',
    });
    expect(parseOrderListQuery({ sortBy: 'constructor' }).sortBy).toBe('submitted_at');
    expect(parseOrderListQuery({ sortDir: 'sideways' }).sortDir).toBe('desc');
  });
});
