const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatUsd(value: number | string): string {
  return USD.format(Number(value));
}

export function formatRate(value: number | string): string {
  return `${Number(value).toFixed(3)}%`;
}

// Dates arrive as YYYY-MM-DD. Parsing them as local dates avoids the UTC
// shift that turns 2026-09-21 into Sep 20 in US timezones.
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
