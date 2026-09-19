const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

// The only columns a client can sort by. The repository maps each one to a
// fixed SQL expression, so query-string input never reaches the SQL string.
export const ORDER_SORT_COLUMNS = ['term', 'amount', 'maturity_date', 'submitted_at'] as const;
export type OrderSortColumn = typeof ORDER_SORT_COLUMNS[number];
export type SortDirection = 'asc' | 'desc';

export interface OrderListQuery {
  page: number;
  pageSize: number;
  sortBy: OrderSortColumn;
  sortDir: SortDirection;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSortBy(value: unknown): OrderSortColumn {
  return ORDER_SORT_COLUMNS.find((column) => column === value) ?? 'submitted_at';
}

function parseSortDir(value: unknown): SortDirection {
  return value === 'asc' ? 'asc' : 'desc';
}

// Bad or missing values fall back to defaults. Page size is capped.
export function parseOrderListQuery(query: Record<string, unknown>): OrderListQuery {
  return {
    page: parsePositiveInt(query.page, 1),
    pageSize: Math.min(parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    sortBy: parseSortBy(query.sortBy),
    sortDir: parseSortDir(query.sortDir),
  };
}
