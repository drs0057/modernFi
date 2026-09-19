import { useEffect, useState } from 'react';
import { getOrders, getYieldCurve, submitOrder } from './api';
import { Order, Term, YieldCurve } from './types';
import YieldCurveChart from './components/YieldCurveChart';
import OrderPanel from './components/OrderPanel';
import OrderHistory from './components/OrderHistory';

type Tab = 'market' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [curve, setCurve] = useState<YieldCurve | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefillTerm, setPrefillTerm] = useState<Term | undefined>(undefined);

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

  function openOrderPanel(term?: Term) {
    setPrefillTerm(term);
    setPanelOpen(true);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">ModernFi Liquidity Desk</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-4">
            {loadError}
          </div>
        )}

        <nav className="flex gap-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('market')}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
              activeTab === 'market'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            History
          </button>
        </nav>

        {activeTab === 'market' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => openOrderPanel()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
              >
                Place Order
              </button>
            </div>
            {curve && (
              <YieldCurveChart
                points={curve.points}
                date={curve.date}
                onPointClick={openOrderPanel}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && <OrderHistory orders={orders} />}
      </main>

      <OrderPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmitted={handleOrderSubmitted}
        initialTerm={prefillTerm}
        onViewHistory={() => {
          setPanelOpen(false);
          setActiveTab('history');
        }}
      />
    </div>
  );
}
