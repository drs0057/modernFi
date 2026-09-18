import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { YieldPoint } from '../types';

export default function YieldCurveChart({ points, date }: { points: YieldPoint[]; date: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800">Treasury Yield Curve</h2>
      <p className="text-sm text-gray-500 mb-4">As of {date}</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="term" stroke="#6b7280" fontSize={12} />
            <YAxis unit="%" stroke="#6b7280" fontSize={12} />
            <Tooltip formatter={(value: number) => [`${value}%`, 'Rate']} />
            <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
