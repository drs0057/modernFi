import { YieldCurve } from './types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function getYieldCurve(): Promise<YieldCurve> {
  const res = await fetch(`${BASE}/api/yield-curve/latest`);
  if (!res.ok) throw new Error('failed to load yield curve');
  return res.json();
}
