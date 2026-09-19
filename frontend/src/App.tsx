import { useEffect, useRef, useState } from 'react';
import { getOrders, getYieldCurve, submitOrder } from './api';
import { Order, OrderSortColumn, OrdersPage, SortDirection, Term, YieldCurve } from './types';
import YieldCurveChart from './components/YieldCurveChart';
import OrderPanel from './components/OrderPanel';
import OrderHistory from './components/OrderHistory';
import OrderSuccessModal from './components/OrderSuccessModal';
import Button from './components/ui/Button';
import TabButton from './components/ui/TabButton';

type Tab = 'market' | 'history';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

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
  const [curveError, setCurveError] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [prefillTerm, setPrefillTerm] = useState<Term | undefined>(undefined);
  const [panelRequestId, setPanelRequestId] = useState(0);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Only the newest orders request may update the table. A slow earlier
  // response must not overwrite a later page or sort.
  const latestOrdersRequest = useRef(0);

  async function loadCurve() {
    try {
      setCurve(await getYieldCurve());
      setCurveError(null);
    } catch (err) {
      setCurveError(errorMessage(err, 'failed to load yield curve'));
    }
  }

  // Never throws. A failed load shows a banner and keeps the current table.
  async function loadOrders(
    page = 1,
    sortBy: OrderSortColumn = ordersPage.sortBy,
    sortDir: SortDirection = ordersPage.sortDir
  ) {
    const requestId = ++latestOrdersRequest.current;
    try {
      const data = await getOrders(page, ordersPage.pageSize, sortBy, sortDir);
      if (requestId !== latestOrdersRequest.current) return;
      setOrdersPage(data);
      setOrdersError(null);
    } catch (err) {
      if (requestId !== latestOrdersRequest.current) return;
      setOrdersError(errorMessage(err, 'failed to load orders'));
    }
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
    // order is already placed, and a failed refresh only shows a banner.
    await loadOrders(1);
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
        {[curveError, ordersError].map(
          (message) =>
            message && (
              <div
                key={message}
                className="bg-error-bg border border-error-text/20 text-error-text text-sm rounded p-4"
              >
                {message}
              </div>
            )
        )}

        <nav className="flex gap-6 border-b border-hairline">
          <TabButton active={activeTab === 'market'} onClick={() => setActiveTab('market')}>
            Market
          </TabButton>
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
            Order History
          </TabButton>
        </nav>

        {activeTab === 'market' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => openOrderPanel()}>Place Order</Button>
            </div>
            {curve && (
              <YieldCurveChart
                points={curve.points}
                date={curve.date}
                compareDates={curve.compareDates}
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
