const SETTLEMENT_TZ = 'America/New_York';

// ISO date strings (YYYY-MM-DD) are handled as UTC midnights so that local
// timezone and DST never shift the day.
export function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Today's calendar date in New York, which is what Treasury settlement uses.
export function todayInSettlementZone(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SETTLEMENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

export function daysBetween(later: string, earlier: string): number {
  return Math.round((parseIso(later).getTime() - parseIso(earlier).getTime()) / 86_400_000);
}

// Treasuries settle T+1. Weekends are skipped, exchange holidays are not modeled.
export function addBusinessDays(iso: string, days: number): string {
  const date = parseIso(iso);
  let remaining = days;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return toIso(date);
}

// Jan 31 + 1 month = Feb 28 (or 29), not Mar 3.
export function addMonths(iso: string, months: number): string {
  const date = parseIso(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInTargetMonth));
  return toIso(date);
}
