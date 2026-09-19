import { Order } from '../types';
import OrderTicket from './OrderTicket';

export default function OrderSuccessModal({
  order,
  onClose,
  onViewHistory,
}: {
  order: Order | null;
  onClose: () => void;
  onViewHistory: () => void;
}) {
  if (!order) return null;

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mx-4 flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white px-6 py-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <svg className="h-7 w-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-center font-medium text-ink">Order successfully placed</p>
        </div>
        <OrderTicket
          ticket={{
            term: order.term,
            amount: Number(order.amount),
            rate: Number(order.rate),
            settlementDate: order.settlement_date,
            maturityDate: order.maturity_date,
            estInterest: Number(order.est_interest),
          }}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onViewHistory}
            className="flex-1 rounded-full border border-ink/20 px-4 py-2 text-sm font-medium text-ink hover:border-electric"
          >
            View history
          </button>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="flex-1 rounded-full bg-electric px-4 py-2 text-sm font-medium text-white shadow-cta transition hover:bg-electric-dark hover:shadow-cta-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
