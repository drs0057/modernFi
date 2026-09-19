import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Term, YieldChanges, YieldPoint } from '../types';

const PERIODS: { key: keyof YieldChanges; label: string }[] = [
  { key: 'd1', label: '1D' },
  { key: 'm1', label: '1M' },
  { key: 'y1', label: '1Y' },
];

function ChangeValue({ bp }: { bp: number | null }) {
  if (bp === null) {
    return <span className="text-ink-muted">-</span>;
  }
  if (bp === 0) {
    return <span className="text-ink-muted">0 bp</span>;
  }
  // Green when the yield rose, red when it fell.
  const up = bp > 0;
  return (
    <span className={up ? 'text-success' : 'text-error-text'}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{bp} bp
    </span>
  );
}

function CurveTooltip({ active, payload }: { active?: boolean; payload?: { payload: YieldPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm shadow">
      <p className="font-medium text-ink">{point.term}</p>
      <p className="text-ink">Yield {point.rate.toFixed(2)}%</p>
      <dl className="mt-2 min-w-[9rem] border-t border-hairline pt-2">
        {PERIODS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-6 py-0.5">
            <dt className="text-xs text-ink-muted">{label}</dt>
            <dd className="font-medium tabular-nums">
              <ChangeValue bp={point.changes[key]} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

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
              content={<CurveTooltip />}
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
