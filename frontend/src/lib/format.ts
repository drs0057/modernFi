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

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// crypto.randomUUID needs a secure context (https or localhost). Fall back
// so the app still works when opened over plain http on a LAN address.
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
