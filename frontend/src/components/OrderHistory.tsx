import { Order } from '../types';

export default function OrderHistory({ orders }: { orders: Order[] }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Order History</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders submitted yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4">Term</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-100">
                <td className="py-2 pr-4 font-medium text-gray-800">{order.term}</td>
                <td className="py-2 pr-4 text-gray-800">
                  ${Number(order.amount).toLocaleString()}
                </td>
                <td className="py-2 text-gray-500">
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
