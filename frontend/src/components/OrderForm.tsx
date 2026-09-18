import { useState } from 'react';
import { TERM_ORDER } from '../types';

export default function OrderForm({ onSubmitted }: { onSubmitted: (term: string, amount: number) => Promise<void> }) {
  const [term, setTerm] = useState<string>(TERM_ORDER[5]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Submit Order</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Term</label>
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            {TERM_ORDER.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Amount ($)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1000000"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-40"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded"
        >
          {submitting ? 'Submitting...' : 'Submit Order'}
        </button>
        {error && <p className="text-sm text-red-600 w-full">{error}</p>}
      </form>
    </div>
  );
}
