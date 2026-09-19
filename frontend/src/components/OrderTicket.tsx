import { formatDate, formatRate, formatUsd } from '../lib/format';
import { TicketView } from '../lib/order';

export default function OrderTicket({ ticket }: { ticket: TicketView }) {
  const rows: [string, string][] = [
    ['Term', ticket.term],
    ['Amount', formatUsd(ticket.amount)],
    ['Yield locked', formatRate(ticket.rate)],
    ['Settlement date', formatDate(ticket.settlementDate)],
    ['Maturity date', formatDate(ticket.maturityDate)],
    ['Est. interest', formatUsd(ticket.estInterest)],
  ];

  return (
    <dl className="rounded-lg border border-hairline bg-canvas p-4 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between py-1">
          <dt className="text-ink-muted">{label}</dt>
          <dd className="font-medium text-ink">{value}</dd>
        </div>
      ))}
      <p className="mt-2 text-xs text-ink-muted">
        {ticket.rateDate && `Yield as of ${formatDate(ticket.rateDate)}. `}
        Interest is simple, paid to maturity.
      </p>
    </dl>
  );
}
