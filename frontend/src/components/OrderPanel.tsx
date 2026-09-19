import { useEffect } from 'react';
import { Term } from '../types';
import OrderForm from './OrderForm';

export default function OrderPanel({
  open,
  onClose,
  onSubmitted,
  initialTerm,
  requestId,
  onViewHistory,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (term: string, amount: number) => Promise<void>;
  initialTerm?: Term;
  requestId: number;
  onViewHistory: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Submit order"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Submit Order</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-none text-ink-muted hover:text-ink"
          >
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <OrderForm
            onSubmitted={onSubmitted}
            onSuccess={onClose}
            initialTerm={initialTerm}
            requestId={requestId}
          />
          <button
            type="button"
            onClick={onViewHistory}
            className="mt-4 text-sm text-electric hover:underline"
          >
            Order History
          </button>
        </div>
      </div>
    </>
  );
}
