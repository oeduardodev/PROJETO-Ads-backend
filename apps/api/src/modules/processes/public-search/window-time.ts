import { Temporal } from '@js-temporal/polyfill';

export interface CompleteWindowCandidate {
  startDate: Date | null;
  startTime: string | null;
  endDate: Date | null;
  endTime: string | null;
  timezone: string | null;
}

function instant(date: Date | null, time: string | null, timezone: string | null): number | null {
  if (!date || !time || !timezone) return null;
  try {
    const civilDate = date.toISOString().slice(0, 10);
    return Temporal.PlainDateTime.from(`${civilDate}T${time}`)
      .toZonedDateTime(timezone, { disambiguation: 'reject' })
      .toInstant().epochMilliseconds;
  } catch {
    return null;
  }
}

export function completeWindowInterval(
  window: CompleteWindowCandidate,
): { start: number; end: number } | null {
  const start = instant(window.startDate, window.startTime, window.timezone);
  const end = instant(window.endDate, window.endTime, window.timezone);
  if (start === null || end === null || end <= start) return null;
  return { start, end };
}

export function isWindowOpen(window: CompleteWindowCandidate, nowMs: number): boolean {
  const interval = completeWindowInterval(window);
  return interval !== null && interval.start <= nowMs && nowMs < interval.end;
}

export function nextConfirmedDeadline(
  windows: CompleteWindowCandidate[],
  nowMs: number,
): number | null {
  const upcoming = windows
    .map(completeWindowInterval)
    .filter(
      (interval): interval is { start: number; end: number } =>
        interval !== null && interval.end > nowMs,
    )
    .map((interval) => interval.end);
  return upcoming.length ? Math.min(...upcoming) : null;
}
