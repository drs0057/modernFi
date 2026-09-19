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

function ChangeLine({ changeBp }: { changeBp: number | null }) {
  if (changeBp === null || changeBp === 0) {
    return <span className="text-ink-muted">{changeBp === 0 ? '0 bp' : '-'}</span>;
  }
  // Green when the yield rose, red when it fell.
  const up = changeBp > 0;
  return (
    <span className={up ? 'text-success' : 'text-error-text'}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{changeBp} bp
    </span>
  );
}

function CurveTooltip({
  active,
  payload,
  prevDate,
}: {
  active?: boolean;
  payload?: { payload: YieldPoint }[];
  prevDate: string | null;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm shadow">
      <p className="font-medium text-ink">{point.term}</p>
      <p className="text-ink">Yield {point.rate.toFixed(2)}%</p>
      <p className="font-medium">
        <ChangeLine changeBp={point.changeBp} />
      </p>
      {prevDate && <p className="text-xs text-ink-muted">vs {prevDate}</p>}
    </div>
  );
}

export default function YieldCurveChart({
  points,
  date,
  prevDate,
  onPointClick,
}: {
  points: YieldPoint[];
  date: string;
  prevDate: string | null;
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
              content={<CurveTooltip prevDate={prevDate} />}
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
