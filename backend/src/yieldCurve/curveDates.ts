import { addDays, addMonths, daysBetween } from '../lib/dates';

// Treasury has no rows for weekends and holidays, so a comparison date falls
// back to the nearest earlier business day. A stretch of 4 closed days is the
// longest in a normal year. Beyond this gap there is no honest comparison.
const MAX_GAP_DAYS = 7;

export interface CompareDates<T = string> {
  d1: T;
  m1: T;
  y1: T;
}

// Calendar targets: one day, one month and one year before the latest date.
export function compareTargets(latest: string): CompareDates {
  return {
    d1: addDays(latest, -1),
    m1: addMonths(latest, -1),
    y1: addMonths(latest, -12),
  };
}

// Latest date on or before the target, or null when none is close enough.
export function pickOnOrBefore(dates: string[], target: string): string | null {
  let best: string | null = null;
  for (const date of dates) {
    if (date <= target && (best === null || date > best)) {
      best = date;
    }
  }
  return best !== null && daysBetween(target, best) <= MAX_GAP_DAYS ? best : null;
}

export function pickCompareDates(dates: string[], latest: string): CompareDates<string | null> {
  const targets = compareTargets(latest);
  return {
    d1: pickOnOrBefore(dates, targets.d1),
    m1: pickOnOrBefore(dates, targets.m1),
    y1: pickOnOrBefore(dates, targets.y1),
  };
}
