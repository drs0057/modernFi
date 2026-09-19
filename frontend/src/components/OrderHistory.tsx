import { OrderSortColumn, OrdersPage } from '../types';

const COLUMNS: { key: OrderSortColumn; label: string }[] = [
  { key: 'term', label: 'Term' },
  { key: 'amount', label: 'Amount' },
  { key: 'submitted_at', label: 'Submitted' },
];

export default function OrderHistory({
  data,
  onPageChange,
  onSortChange,
}: {
  data: OrdersPage;
  onPageChange: (page: number) => void;
  onSortChange: (column: OrderSortColumn) => void;
}) {
  const { orders, total, page, pageSize, sortBy, sortDir } = data;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4 gap-4">
        <h2 className="text-lg font-semibold text-ink">Order History</h2>
        {orders.length > 0 && (
          <div className="flex items-center gap-3 text-sm text-ink-muted shrink-0">
            <span>
              Showing {rangeStart}–{rangeEnd} of {total}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-ink/20 text-ink hover:border-electric disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-ink/20"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-ink/20 text-ink hover:border-electric disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-ink/20"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-ink-muted">No orders submitted yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-hairline">
              {COLUMNS.map((col) => (
                <th key={col.key} className="py-2 pr-4">
                  <button
                    type="button"
                    onClick={() => onSortChange(col.key)}
                    className="flex items-center gap-1 font-medium text-ink-muted hover:text-ink"
                  >
                    {col.label}
                    {sortBy === col.key && (
                      <span className="text-electric">{sortDir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-hairline">
                <td className="py-2 pr-4 font-medium text-ink">{order.term}</td>
                <td className="py-2 pr-4 text-ink">
                  ${Number(order.amount).toLocaleString()}
                </td>
                <td className="py-2 text-ink-muted">
                  {new Date(order.submitted_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
