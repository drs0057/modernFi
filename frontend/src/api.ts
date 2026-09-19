import { Order, OrderSortColumn, OrdersPage, SortDirection, YieldCurve } from './types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function getYieldCurve(): Promise<YieldCurve> {
  const res = await fetch(`${BASE}/api/yield-curve`);
  if (!res.ok) throw new Error('failed to load yield curve');
  return res.json();
}

export async function getOrders(
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
  const res = await fetch(`${BASE}/api/orders?${params}`);
  if (!res.ok) throw new Error('failed to load orders');
  return res.json();
}

export async function submitOrder(term: string, amount: number): Promise<Order> {
  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term, amount }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'failed to submit order');
  }
  return res.json();
}
