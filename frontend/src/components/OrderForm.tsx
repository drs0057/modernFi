import { useEffect, useState } from 'react';
import { Term, TERM_ORDER } from '../types';

export default function OrderForm({
  onSubmitted,
  onSuccess,
  initialTerm,
}: {
  onSubmitted: (term: string, amount: number) => Promise<void>;
  onSuccess?: () => void;
  initialTerm?: Term;
}) {
  const [term, setTerm] = useState<Term>(initialTerm ?? TERM_ORDER[5]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialTerm) {
      setTerm(initialTerm);
    }
  }, [initialTerm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitted(term, parsedAmount);
      setAmount('');
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm text-ink-muted mb-1">Term</label>
        <select
          value={term}
          onChange={(e) => setTerm(e.target.value as Term)}
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
          onChange={(e) => setAmount(e.target.value)}
          placeholder="1000000"
          autoFocus
          className="w-full border border-ink/20 rounded px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-electric"
        />
      </div>
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
