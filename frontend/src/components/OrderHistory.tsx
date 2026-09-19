import { Order } from '../types';

export default function OrderHistory({ orders }: { orders: Order[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-ink mb-4">Order History</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-muted">No orders submitted yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-hairline">
              <th className="py-2 pr-4">Term</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2">Submitted</th>
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
