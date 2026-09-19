import { Order, OrderSortColumn, OrdersPage, SortDirection, Ticket, YieldCurve } from './types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

// Every failure carries the server's `error` message when it sent one.
async function request<T>(path: string, fallbackMessage: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || fallbackMessage);
  }
  return res.json();
}

export function getYieldCurve(): Promise<YieldCurve> {
  return request('/api/yield-curve', 'failed to load yield curve');
}

export function getOrders(
  page = 1,
  pageSize = 10,
  sortBy: OrderSortColumn = 'submitted_at',
  sortDir: SortDirection = 'desc'
): Promise<OrdersPage> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy,
    sortDir,
  });
  return request(`/api/orders?${params}`, 'failed to load orders');
}

export function getQuote(term: string, amount: number, signal?: AbortSignal): Promise<Ticket> {
  const params = new URLSearchParams({ term, amount: String(amount) });
  return request(`/api/orders/quote?${params}`, 'failed to load quote', { signal });
}

// The same idempotency key can be sent again after a failure. The server
// returns the original order if it already went through.
export function submitOrder(term: string, amount: number, idempotencyKey: string): Promise<Order> {
  return request('/api/orders', 'failed to submit order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ term, amount }),
  });
}
