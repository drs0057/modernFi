import { useEffect, useRef, useState } from 'react';
import { ApiError, getQuote } from '../api';
import { newIdempotencyKey } from '../lib/format';
import { Order, Term, TERM_ORDER, Ticket } from '../types';
import OrderTicket from './OrderTicket';

const QUOTE_DEBOUNCE_MS = 300;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeSubmitError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 502 ? `${capitalize(err.message)}. Try again.` : capitalize(err.message);
  }
  return 'Could not reach the server. Try again.';
}

export default function OrderForm({
  onSubmitted,
  onSuccess,
  initialTerm,
  requestId,
}: {
  onSubmitted: (term: string, amount: number, idempotencyKey: string) => Promise<Order>;
  onSuccess?: (order: Order) => void;
  initialTerm?: Term;
  requestId: number;
}) {
  const [term, setTerm] = useState<Term>(initialTerm ?? TERM_ORDER[5]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // One key per order intent. It stays the same across retries, so if a
  // request times out but the server placed the order, the retry returns
  // that order instead of creating a second one. It changes when the user
  // edits the order, and after a successful submit.
  const idempotencyKey = useRef(newIdempotencyKey());
  // A ref, not state: two fast clicks can both run before a state update renders.
  const inFlight = useRef(false);

  function startNewIntent() {
    idempotencyKey.current = newIdempotencyKey();
  }

  useEffect(() => {
    setTerm(initialTerm ?? TERM_ORDER[5]);
    startNewIntent();
  }, [requestId]);

  useEffect(() => {
    const parsed = Number(amount);
    if (amount === '' || !Number.isFinite(parsed) || parsed <= 0) {
      setTicket(null);
      setQuoteError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setTicket(await getQuote(term, parsed, controller.signal));
        setQuoteError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setTicket(null);
        setQuoteError(err instanceof ApiError ? capitalize(err.message) : 'Could not load quote.');
      }
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    setError(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    try {
      const order = await onSubmitted(term, parsedAmount, idempotencyKey.current);
      startNewIntent();
      setAmount('');
      onSuccess?.(order);
    } catch (err) {
      console.error('order submission failed', err);
      setError(describeSubmitError(err));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm text-ink-muted mb-1">Term</label>
        <select
          value={term}
          onChange={(e) => {
            setTerm(e.target.value as Term);
            startNewIntent();
          }}
          className="w-full border border-ink/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-electric"
        >
          {TERM_ORDER.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-ink-muted mb-1">Amount ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            startNewIntent();
          }}
          placeholder="1000000"
          autoFocus
          className="w-full border border-ink/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-electric"
        />
      </div>
      {ticket && <OrderTicket ticket={ticket} />}
      {quoteError && <p className="text-sm text-error-text">{quoteError}</p>}
      {error && <p className="text-sm text-error-text">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="bg-electric hover:bg-electric-dark disabled:bg-electric/40 shadow-cta hover:shadow-cta-hover text-white text-sm font-medium px-4 py-2 rounded-full transition"
      >
        {submitting ? 'Submitting...' : 'Submit Order'}
      </button>
    </form>
  );
}
