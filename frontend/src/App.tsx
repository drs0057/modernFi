import { useEffect, useState } from 'react';
import { getOrders, getYieldCurve, submitOrder } from './api';
import { Order, OrderSortColumn, OrdersPage, Term, YieldCurve } from './types';
import YieldCurveChart from './components/YieldCurveChart';
import OrderPanel from './components/OrderPanel';
import OrderHistory from './components/OrderHistory';
import OrderSuccessModal from './components/OrderSuccessModal';

type Tab = 'market' | 'history';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('market');
  const [curve, setCurve] = useState<YieldCurve | null>(null);
  const [ordersPage, setOrdersPage] = useState<OrdersPage>({
    orders: [],
    total: 0,
    page: 1,
    pageSize: 10,
    sortBy: 'submitted_at',
    sortDir: 'desc',
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefillTerm, setPrefillTerm] = useState<Term | undefined>(undefined);
  const [panelRequestId, setPanelRequestId] = useState(0);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  async function loadCurve() {
    try {
      setCurve(await getYieldCurve());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'failed to load yield curve');
    }
  }

  async function loadOrders(
    page = 1,
    sortBy: OrderSortColumn = ordersPage.sortBy,
    sortDir: 'asc' | 'desc' = ordersPage.sortDir
  ) {
    setOrdersPage(await getOrders(page, ordersPage.pageSize, sortBy, sortDir));
  }

  function handleSortChange(column: OrderSortColumn) {
    const nextDir =
      ordersPage.sortBy === column && ordersPage.sortDir === 'asc' ? 'desc' : 'asc';
    loadOrders(1, column, nextDir);
  }

  useEffect(() => {
    loadCurve();
    loadOrders();
  }, []);

  async function handleOrderSubmitted(term: string, amount: number, idempotencyKey: string) {
    const order = await submitOrder(term, amount, idempotencyKey);
    // A new order sorts to the top, so jump back to page 1 to show it. The
    // order is already placed, so a failed refresh must not read as a failed order.
    await loadOrders(1).catch((err) => console.error('failed to refresh orders', err));
    return order;
  }

  function openOrderPanel(term?: Term) {
    setPrefillTerm(term);
    setPanelRequestId((id) => id + 1);
    setPanelOpen(true);
  }

  function handleOrderSuccess(order: Order) {
    setPanelOpen(false);
    setPlacedOrder(order);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-hairline">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-center">
          <img src="/modernfi-logo.png" alt="ModernFi" className="h-16 w-auto" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
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
            Order History
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
                prevDate={curve.prevDate}
                onPointClick={openOrderPanel}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <OrderHistory data={ordersPage} onPageChange={loadOrders} onSortChange={handleSortChange} />
        )}
      </main>

      <OrderPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmitted={handleOrderSubmitted}
        onSubmitSuccess={handleOrderSuccess}
        initialTerm={prefillTerm}
        requestId={panelRequestId}
        onViewHistory={() => {
          setPanelOpen(false);
          setActiveTab('history');
        }}
      />

      <OrderSuccessModal
        order={placedOrder}
        onClose={() => setPlacedOrder(null)}
        onViewHistory={() => {
          setPlacedOrder(null);
          setActiveTab('history');
        }}
      />
    </div>
  );
}
