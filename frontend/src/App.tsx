import { useEffect, useState } from 'react';
import { getOrders, getYieldCurve, submitOrder } from './api';
import { Order, YieldCurve } from './types';
import YieldCurveChart from './components/YieldCurveChart';
import OrderForm from './components/OrderForm';
import OrderHistory from './components/OrderHistory';

export default function App() {
  const [curve, setCurve] = useState<YieldCurve | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadCurve() {
    try {
      setCurve(await getYieldCurve());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'failed to load yield curve');
    }
  }

  async function loadOrders() {
    setOrders(await getOrders());
  }

  useEffect(() => {
    loadCurve();
    loadOrders();
  }, []);

  async function handleOrderSubmitted(term: string, amount: number) {
    await submitOrder(term, amount);
    await loadOrders();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">ModernFi Liquidity Desk</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-4">
            {loadError}
          </div>
        )}
        {curve && <YieldCurveChart points={curve.points} date={curve.date} />}
        <OrderForm onSubmitted={handleOrderSubmitted} />
        <OrderHistory orders={orders} />
      </main>
    </div>
  );
}
