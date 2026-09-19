import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Term, YieldPoint } from '../types';

export default function YieldCurveChart({
  points,
  date,
  onPointClick,
}: {
  points: YieldPoint[];
  date: string;
  onPointClick?: (term: Term) => void;
}) {
  function handleClick(state: any) {
    if (onPointClick && typeof state?.activeLabel === 'string') {
      onPointClick(state.activeLabel as Term);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800">Treasury Yield Curve</h2>
      <p className="text-sm text-gray-500 mb-4">
        As of {date}
        {onPointClick && ' — click anywhere on the graph to start an order at that term'}
      </p>
      <div className="h-[28rem]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            onClick={handleClick}
            style={{ cursor: onPointClick ? 'pointer' : 'default' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="term" stroke="#6b7280" fontSize={12} />
            <YAxis unit="%" stroke="#6b7280" fontSize={12} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Rate']}
              cursor={onPointClick ? { stroke: '#2563eb', strokeOpacity: 0.12, strokeWidth: 44 } : true}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: '#2563eb' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
