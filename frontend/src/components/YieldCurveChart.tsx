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
      <h2 className="text-lg font-semibold text-ink">Treasury Yield Curve</h2>
      <p className="text-sm text-ink-muted mb-4">
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,26,0.08)" />
            <XAxis dataKey="term" stroke="#4D4D4D" fontSize={12} />
            <YAxis unit="%" stroke="#4D4D4D" fontSize={12} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Rate']}
              cursor={onPointClick ? { stroke: '#00A19C', strokeOpacity: 0.12, strokeWidth: 44 } : true}
            />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#00A19C"
              strokeWidth={2}
              dot={{ r: 4, fill: '#00A19C' }}
              activeDot={{ r: 7 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
