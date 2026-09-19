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
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-hairline">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-ink">ModernFi Liquidity Desk</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {loadError && (
          <div className="bg-error-bg border border-error-text/20 text-error-text text-sm rounded p-4">
            {loadError}
          </div>
        )}

        <nav className="flex gap-6 border-b border-hairline">
          <button
            onClick={() => setActiveTab('market')}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
              activeTab === 'market'
                ? 'border-electric text-electric'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
              activeTab === 'history'
                ? 'border-electric text-electric'
                : 'border-transparent text-ink-muted hover:text-ink'
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
                className="bg-electric hover:bg-electric-dark shadow-cta hover:shadow-cta-hover text-white text-sm font-medium px-4 py-2 rounded-full transition"
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
